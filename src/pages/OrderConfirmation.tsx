import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ArrowLeft, CheckCircle2, FileCheck, Package, Upload, FileText, X, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";

// Helper function to extract state from address string
const extractStateFromAddress = (address: string): string => {
  if (!address) return '';
  // Extract state from address string (e.g., "123 Main St, City, CA 12345" -> "CA")
  const stateMatch = address.match(/,\s*([A-Z]{2})\s+\d{5}/);
  return stateMatch ? stateMatch[1] : '';
};

export default function OrderConfirmation() {
  const { effectiveUserId, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [agreed, setAgreed] = useState(false);
  const [uploadingPrescriptions, setUploadingPrescriptions] = useState<Record<string, boolean>>({});
  const [prescriptionFiles, setPrescriptionFiles] = useState<Record<string, File>>({});
  const [prescriptionPreviews, setPrescriptionPreviews] = useState<Record<string, string>>({});

  const { data: cart, isLoading } = useQuery({
    queryKey: ["cart", effectiveUserId],
    queryFn: async () => {
      const { data: cartData, error: cartError } = await supabase
        .from("cart")
        .select("id")
        .eq("doctor_id", effectiveUserId)
        .maybeSingle();

      if (cartError) throw cartError;

      if (!cartData) return { lines: [] };

      const { data: lines, error: linesError } = await supabase
        .from("cart_lines")
        .select(`
          *,
          product:products(name, dosage, sig, image_url, base_price, requires_prescription)
        `)
        .eq("cart_id", cartData.id);

      if (linesError) throw linesError;

      return { id: cartData.id, lines: lines || [] };
    },
    enabled: !!effectiveUserId,
  });

  const hasPracticeOrder = (cart?.lines || []).some(
    (line: any) => line.patient_name === "Practice Order"
  );

  const { data: providerProfile } = useQuery({
    queryKey: ["provider-shipping", effectiveUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("shipping_address_street, shipping_address_city, shipping_address_state, shipping_address_zip, shipping_address_formatted, name")
        .eq("id", effectiveUserId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!effectiveUserId && hasPracticeOrder,
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!cart?.id || !cart.lines || cart.lines.length === 0) {
        throw new Error("Cart is empty");
      }

      if (!agreed) {
        throw new Error("You must agree to the terms before confirming your order");
      }

      const practiceLines = (cart.lines as any[]).filter(
        (line) => line.patient_name === "Practice Order"
      );
      const patientLines = (cart.lines as any[]).filter(
        (line) => line.patient_name !== "Practice Order"
      );

      const hasShippingAddress = providerProfile?.shipping_address_street && 
                                 providerProfile?.shipping_address_city && 
                                 providerProfile?.shipping_address_state && 
                                 providerProfile?.shipping_address_zip;
      
      if (practiceLines.length > 0 && !hasShippingAddress) {
        throw new Error("Please set your practice shipping address in your profile before placing practice orders");
      }

      if (patientLines.length > 0) {
        const hasPatientInfo = patientLines.every(
          (line) => line.patient_name && line.patient_id
        );
        if (!hasPatientInfo) {
          throw new Error("All items must have patient information for patient orders");
        }
      }

      const allLines = [...practiceLines, ...patientLines];
      const missingPrescriptions = allLines.filter((line: any) => 
        line.product?.requires_prescription && !line.prescription_url
      );

      if (missingPrescriptions.length > 0) {
        const productNames = missingPrescriptions
          .map((line: any) => line.product?.name)
          .join(", ");
        throw new Error(
          `The following products require prescriptions but none were uploaded: ${productNames}. Please go back to your cart and add prescriptions.`
        );
      }

      const doctorIdForOrder = effectiveUserId && effectiveUserId !== user?.id ? effectiveUserId : user?.id;
      const createdOrders = [];

      if (practiceLines.length > 0) {
        const practiceTotal = practiceLines.reduce<number>(
          (sum, line) => sum + ((line.price_snapshot || 0) * (line.quantity || 1)),
          0
        );

        const practiceAddress = providerProfile?.shipping_address_formatted || 
          `${providerProfile?.shipping_address_street}, ${providerProfile?.shipping_address_city}, ${providerProfile?.shipping_address_state} ${providerProfile?.shipping_address_zip}`;

        const { data: practiceOrder, error: practiceOrderError } = await supabase
          .from("orders")
          .insert({
            doctor_id: doctorIdForOrder,
            total_amount: practiceTotal,
            status: "pending",
            ship_to: "practice",
            practice_address: practiceAddress,
          })
          .select()
          .single();

        if (practiceOrderError) throw practiceOrderError;

        // Route each line to appropriate pharmacy
        const practiceOrderLines = await Promise.all(
          practiceLines.map(async (line: any) => {
            let assignedPharmacyId = null;
            const destinationState = extractStateFromAddress(line.patient_address || practiceAddress);
            
            // Call routing function
            try {
              const { data: routingResult, error: routingError } = await supabase.functions.invoke(
                'route-order-to-pharmacy',
                {
                  body: {
                    product_id: line.product_id,
                    destination_state: destinationState
                  }
                }
              );
              
              if (!routingError && routingResult?.pharmacy_id) {
                assignedPharmacyId = routingResult.pharmacy_id;
                console.log(`Routed to pharmacy: ${routingResult.reason}`);
              } else {
                // Pharmacy routing failed - this should have been caught at add-to-cart
                const productName = line.product?.name || 'Unknown product';
                throw new Error(
                  `Unable to fulfill order: No pharmacy available for "${productName}" in ${destinationState}. Please contact your representative or create a support ticket.`
                );
              }
            } catch (error) {
              console.error('Pharmacy routing failed:', error);
            }
            
            return {
              order_id: practiceOrder.id,
              product_id: line.product_id,
              quantity: line.quantity || 1,
              price: line.price_snapshot,
              patient_id: line.patient_id,
              patient_name: line.patient_name,
              patient_email: line.patient_email,
              patient_phone: line.patient_phone,
              patient_address: line.patient_address,
              prescription_url: line.prescription_url,
              provider_id: line.provider_id,
              assigned_pharmacy_id: assignedPharmacyId,
              destination_state: destinationState,
              status: "pending" as const,
              custom_sig: line.custom_sig,
              custom_dosage: line.custom_dosage,
              order_notes: line.order_notes,
              prescription_method: line.prescription_method,
            };
          })
        );

        const { error: practiceLinesError } = await supabase
          .from("order_lines")
          .insert(practiceOrderLines);

        if (practiceLinesError) throw practiceLinesError;
        createdOrders.push(practiceOrder);
      }

      if (patientLines.length > 0) {
        const patientTotal = patientLines.reduce<number>(
          (sum, line) => sum + ((line.price_snapshot || 0) * (line.quantity || 1)),
          0
        );

        const { data: patientOrder, error: patientOrderError } = await supabase
          .from("orders")
          .insert({
            doctor_id: doctorIdForOrder,
            total_amount: patientTotal,
            status: "pending",
            ship_to: "patient",
            practice_address: null,
          })
          .select()
          .single();

        if (patientOrderError) throw patientOrderError;

        // Route each line to appropriate pharmacy
        const patientOrderLines = await Promise.all(
          patientLines.map(async (line: any) => {
            let assignedPharmacyId = null;
            const destinationState = extractStateFromAddress(line.patient_address);
            
            // Call routing function
            try {
              const { data: routingResult, error: routingError } = await supabase.functions.invoke(
                'route-order-to-pharmacy',
                {
                  body: {
                    product_id: line.product_id,
                    destination_state: destinationState
                  }
                }
              );
              
              if (!routingError && routingResult?.pharmacy_id) {
                assignedPharmacyId = routingResult.pharmacy_id;
                console.log(`Routed to pharmacy: ${routingResult.reason}`);
              } else {
                // Pharmacy routing failed - this should have been caught at add-to-cart
                const productName = line.product?.name || 'Unknown product';
                throw new Error(
                  `Unable to fulfill order: No pharmacy available for "${productName}" in ${destinationState}. Please contact your representative or create a support ticket.`
                );
              }
            } catch (error) {
              console.error('Pharmacy routing failed:', error);
            }
            
            return {
              order_id: patientOrder.id,
              product_id: line.product_id,
              quantity: line.quantity || 1,
              price: line.price_snapshot,
              patient_id: line.patient_id,
              patient_name: line.patient_name,
              patient_email: line.patient_email,
              patient_phone: line.patient_phone,
              patient_address: line.patient_address,
              prescription_url: line.prescription_url,
              provider_id: line.provider_id,
              assigned_pharmacy_id: assignedPharmacyId,
              destination_state: destinationState,
              status: "pending" as const,
              custom_sig: line.custom_sig,
              custom_dosage: line.custom_dosage,
              order_notes: line.order_notes,
              prescription_method: line.prescription_method,
            };
          })
        );

        const { error: patientLinesError } = await supabase
          .from("order_lines")
          .insert(patientOrderLines);

        if (patientLinesError) throw patientLinesError;
        createdOrders.push(patientOrder);
      }

      const { error: deleteError } = await supabase
        .from("cart_lines")
        .delete()
        .eq("cart_id", cart.id);

      if (deleteError) throw deleteError;

      return createdOrders;
    },
    onSuccess: (orders) => {
      const orderCount = orders.length;
      toast({
        title: "Order Confirmed Successfully! 🎉",
        description: `${orderCount} order${orderCount > 1 ? 's' : ''} placed. You can view ${orderCount > 1 ? 'them' : 'it'} under "My Orders".`,
      });
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      navigate("/orders");
    },
    onError: (error: any) => {
      toast({
        title: "Order Confirmation Failed",
        description: error.message || "Failed to confirm order. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePrescriptionUpload = async (lineId: string, file: File) => {
    setUploadingPrescriptions(prev => ({ ...prev, [lineId]: true }));
    
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${effectiveUserId}/${Date.now()}_${Math.random()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("prescriptions")
        .upload(fileName, file, {
          contentType: file.type
        });

      if (uploadError) {
        // Provide friendlier error message for MIME type issues
        if (uploadError.message?.toLowerCase().includes('mime type')) {
          throw new Error("This file type isn't allowed by the server. Allowed types: PDF, PNG, JPG.");
        }
        throw uploadError;
      }

    const { data: urlData, error: urlError } = await supabase.storage
      .from("prescriptions")
      .createSignedUrl(fileName, 31536000); // 1 year expiry

    if (urlError) throw urlError;

    // Update cart line with prescription URL
    const { error: updateError } = await supabase
      .from("cart_lines")
      .update({ prescription_url: urlData.signedUrl })
      .eq("id", lineId);

      if (updateError) throw updateError;

      // Refetch cart data to update UI
      queryClient.invalidateQueries({ queryKey: ["cart", effectiveUserId] });
      
      toast({
        title: "Prescription Uploaded",
        description: "The prescription has been uploaded successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload prescription",
        variant: "destructive",
      });
    } finally {
      setUploadingPrescriptions(prev => ({ ...prev, [lineId]: false }));
      setPrescriptionFiles(prev => {
        const newFiles = { ...prev };
        delete newFiles[lineId];
        return newFiles;
      });
    }
  };

  const handlePrescriptionChange = (lineId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('File selected:', file.name, 'Type:', file.type);
      
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      const validExtensions = ['.pdf', '.png', '.jpg', '.jpeg'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      // Check both MIME type and file extension for maximum compatibility
      if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
        toast({
          title: "Invalid File Type",
          description: `File type not supported. Please upload a PDF or PNG/JPG file. Detected type: ${file.type || 'unknown'}`,
          variant: "destructive",
        });
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "File size must be less than 10MB",
          variant: "destructive",
        });
        return;
      }
      
      setPrescriptionFiles(prev => ({ ...prev, [lineId]: file }));
      toast({
        title: "Prescription Uploaded",
        description: "File uploaded successfully",
      });
      
      if (file.type.startsWith('image/') || fileExtension.match(/\.(png|jpg|jpeg)$/i)) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPrescriptionPreviews(prev => ({ ...prev, [lineId]: reader.result as string }));
        };
        reader.readAsDataURL(file);
      } else {
        setPrescriptionPreviews(prev => {
          const newPreviews = { ...prev };
          delete newPreviews[lineId];
          return newPreviews;
        });
      }
      
      // Auto-upload the file
      handlePrescriptionUpload(lineId, file);
    }
  };

  const calculateTotal = () => {
    return (cart?.lines || []).reduce<number>(
      (sum, line: any) => sum + ((line.price_snapshot || 0) * (line.quantity || 1)),
      0
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading order details...</div>
      </div>
    );
  }

  const cartLines = cart?.lines || [];
  const isEmpty = cartLines.length === 0;

  if (isEmpty) {
    navigate("/cart");
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <FileCheck className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Confirm Your Order</h1>
          <p className="text-muted-foreground mt-1">
            Please review your order details and confirm the medical attestation below
          </p>
        </div>
      </div>

      {/* Order Items Review */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order Items
          </CardTitle>
          <CardDescription>
            Review the items in your order
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {cartLines.map((line: any, index: number) => (
            <div key={line.id}>
              {index > 0 && <Separator className="my-4" />}
                  <div className="flex items-start gap-4">
                {line.product?.image_url && (
                  <img
                    src={line.product.image_url}
                    alt={line.product.name}
                    className="h-20 w-20 object-cover rounded-md border border-border"
                  />
                )}
                <div className="flex-1 space-y-1">
                  <h4 className="font-semibold text-lg">{line.product?.name}</h4>
                  <p className="text-sm text-muted-foreground">{line.product?.dosage}</p>
                  
                  {/* Display prescription details if present */}
                  {(line.custom_sig || line.custom_dosage) && line.patient_name !== "Practice Order" && (
                    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md text-sm space-y-1 border border-blue-200 dark:border-blue-800">
                      <p className="font-semibold text-xs text-blue-700 dark:text-blue-300 uppercase">Prescription Details:</p>
                      {line.custom_dosage && (
                        <p>
                          <strong className="text-blue-700 dark:text-blue-300">Dosage:</strong>{" "}
                          <span className="text-blue-600 dark:text-blue-400">{line.custom_dosage}</span>
                        </p>
                      )}
                      {line.custom_sig && (
                        <p>
                          <strong className="text-blue-700 dark:text-blue-300">SIG:</strong>{" "}
                          <span className="text-blue-600 dark:text-blue-400">{line.custom_sig}</span>
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Display order notes if present */}
                  {line.order_notes && (
                    <div className="mt-2 p-3 bg-accent/50 rounded-md text-sm border">
                      <p className="font-semibold text-xs text-muted-foreground uppercase mb-1">Notes:</p>
                      <p>{line.order_notes}</p>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline">
                      Qty: {line.quantity}
                    </Badge>
                    {line.patient_name === "Practice Order" ? (
                      <Badge variant="secondary">Practice Order</Badge>
                    ) : (
                      <Badge>Patient: {line.patient_name}</Badge>
                    )}
                  </div>
                  {line.product?.requires_prescription && (
                    <div className="mt-2 space-y-2">
                      {line.prescription_url ? (
                        <Badge variant="default" className="bg-green-600">
                          <FileCheck className="h-3 w-3 mr-1" />
                          Prescription Uploaded
                        </Badge>
                      ) : (
                        <div className="space-y-2">
                          <Badge variant="destructive">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Missing Prescription
                          </Badge>
                          
                          {/* Upload Interface */}
                          {prescriptionFiles[line.id] || uploadingPrescriptions[line.id] ? (
                            <div className="relative p-2 border rounded-md bg-background text-sm">
                              <div className="flex items-center gap-2">
                                {uploadingPrescriptions[line.id] ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Uploading prescription...</span>
                                  </>
                                ) : (
                                  <>
                                    {prescriptionPreviews[line.id] ? (
                                      <img
                                        src={prescriptionPreviews[line.id]}
                                        alt="Prescription preview"
                                        className="h-12 w-12 object-cover rounded"
                                      />
                                    ) : (
                                      <FileText className="h-4 w-4" />
                                    )}
                                    <span className="flex-1 truncate">{prescriptionFiles[line.id]?.name}</span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setPrescriptionFiles(prev => {
                                          const newFiles = { ...prev };
                                          delete newFiles[line.id];
                                          return newFiles;
                                        });
                                        setPrescriptionPreviews(prev => {
                                          const newPreviews = { ...prev };
                                          delete newPreviews[line.id];
                                          return newPreviews;
                                        });
                                      }}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          ) : (
                            <>
                              <Input
                                id={`prescription-upload-${line.id}`}
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg"
                                onChange={(e) => handlePrescriptionChange(line.id, e)}
                                className="hidden"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => document.getElementById(`prescription-upload-${line.id}`)?.click()}
                                className="w-full border-orange-300 hover:bg-orange-50"
                              >
                                <Upload className="h-4 w-4 mr-2" />
                                Upload Prescription
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-primary">
                    ${(line.price_snapshot * line.quantity).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ${line.price_snapshot.toFixed(2)} each
                  </p>
                </div>
              </div>
            </div>
          ))}
          
          <Separator className="my-4" />
          
          <div className="flex justify-between items-center text-lg font-bold pt-2">
            <span>Total Amount:</span>
            <span className="text-2xl text-primary">${calculateTotal().toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Medical Attestation */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <AlertCircle className="h-5 w-5" />
            Medical Attestation Required
          </CardTitle>
          <CardDescription>
            Please read and confirm the following statement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm leading-relaxed">
              By checking the box below, you attest that:
              <ul className="list-disc ml-6 mt-2 space-y-1">
                <li>All order(s) are medically necessary</li>
                <li>You have advised the patient(s) of any side effects</li>
                <li>You have seen the patient in person</li>
                <li>You have reviewed their medical record to avoid adverse medical effects</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="flex items-start space-x-3 p-4 rounded-lg bg-accent/50 border border-border">
            <Checkbox
              id="medical-attestation"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked as boolean)}
              className="mt-1"
            />
            <div className="flex-1">
              <Label
                htmlFor="medical-attestation"
                className="text-sm font-medium leading-relaxed cursor-pointer"
              >
                I agree to all of the above.
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={() => navigate("/cart")}
          disabled={checkoutMutation.isPending}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Cart
        </Button>
        <Button
          size="lg"
          className="flex-1"
          onClick={() => checkoutMutation.mutate()}
          disabled={checkoutMutation.isPending || !agreed}
        >
          {checkoutMutation.isPending ? (
            "Processing Order..."
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Confirm Order
            </>
          )}
        </Button>
      </div>

      {!agreed && (
        <p className="text-center text-sm text-muted-foreground">
          Please agree to the medical attestation to proceed
        </p>
      )}
    </div>
  );
}
