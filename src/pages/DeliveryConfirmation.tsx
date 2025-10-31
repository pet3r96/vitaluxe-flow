import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Package, Truck, MapPin, Edit, CheckCircle2, AlertCircle, ArrowLeft, ArrowRight } from "lucide-react";
import { DeliveryAddressEditor } from "@/components/orders/DeliveryAddressEditor";

export default function DeliveryConfirmation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, effectiveUserId } = useAuth();
  const queryClient = useQueryClient();
  
  const [editingAddress, setEditingAddress] = useState<{
    type: 'practice' | 'patient';
    patientId?: string;
    patientName?: string;
    lineIds?: string[];
    oldPatientAddress?: string;
    currentAddress?: any;
  } | null>(null);

  const discountState = location.state as { 
    discountCode?: string; 
    discountPercentage?: number;
    merchantFeePercentage?: number;
    merchantFeeAmount?: number;
  };

  // Fetch cart data with patient groupings
  const { data: cartData, isLoading: cartLoading } = useQuery({
    queryKey: ["cart", effectiveUserId],
    enabled: !!effectiveUserId,
    queryFn: async () => {
      const { data: cart, error: cartError } = await supabase
        .from("cart")
        .select("id")
        .eq("doctor_id", effectiveUserId!)
        .single();

      if (cartError) throw cartError;

      const { data: lines, error: linesError } = await supabase
        .from("cart_lines")
        .select(`
          *,
          product:products(*),
          patient:patient_accounts(
            address,
            city,
            state,
            zip_code
          )
        `)
        .eq("cart_id", cart.id);

      if (linesError) throw linesError;

      return { cart, lines: lines || [] };
    },
  });

  // Fetch practice profile for practice shipping address
  const { data: profile, isError: profileError, error: profileErrorDetails } = useQuery({
    queryKey: ["profile", effectiveUserId],
    enabled: !!effectiveUserId,
    queryFn: async () => {
      console.log("[DeliveryConfirmation] Fetching profile for:", effectiveUserId);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", effectiveUserId!)
        .single();

      if (error) {
        console.error("[DeliveryConfirmation] Profile fetch error:", error);
        throw error;
      }
      console.log("[DeliveryConfirmation] Profile data:", data);
      return data;
    },
  });

  // Update practice address mutation
  const updatePracticeAddress = useMutation({
    mutationFn: async (address: any) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          shipping_address_street: address.street,
          shipping_address_city: address.city,
          shipping_address_state: address.state,
          shipping_address_zip: address.zip,
          shipping_address_formatted: address.formatted,
        })
        .eq("id", effectiveUserId!);

      if (error) throw error;
    },
    onSuccess: () => {
      console.log('[DeliveryConfirmation] Practice address updated successfully');
      queryClient.invalidateQueries({ queryKey: ["profile", effectiveUserId] });
      toast.success("Practice address updated successfully");
      setEditingAddress(null);
    },
    onError: (error: any) => {
      console.error("Error updating practice address:", error);
      toast.error(`Failed to update practice address: ${error?.message || 'Unknown error'}`);
    },
  });

  // Update patient address mutation
  const updatePatientAddress = useMutation({
    mutationFn: async ({ patientName, lineIds, patientId, address }: { patientName: string; lineIds: string[]; patientId?: string; address: any }) => {
      console.log('[DeliveryConfirmation] Updating patient address for:', patientName, 'Line IDs:', lineIds, 'Patient ID:', patientId);
      console.log('[DeliveryConfirmation] Address data being saved:', {
        street: address.street,
        city: address.city,
        state: address.state,
        zip: address.zip,
        formatted: address.formatted,
        status: address.status
      });
      
      // Update cart_lines
      const { data, error } = await supabase
        .from("cart_lines")
        .update({
          patient_address_street: address.street,
          patient_address_city: address.city,
          patient_address_state: address.state,
          patient_address_zip: address.zip,
          patient_address_formatted: address.formatted,
          patient_address_validated: address.status === 'verified',
          patient_address_validation_source: address.source || 'manual',
          patient_address: null, // Clear legacy field
        })
        .in("id", lineIds)
        .select('id');

      // If Supabase returns error, throw it
      if (error) {
        console.error('[DeliveryConfirmation] Cart lines update error:', error);
        throw error;
      }
      
      // Log detailed result
      console.log('[DeliveryConfirmation] Cart lines update complete:', {
        rowsUpdated: data?.length || 0,
        lineIds,
        updatedRowIds: data?.map(d => d.id) || []
      });
      
      if (!data || data.length === 0) {
        console.warn('[DeliveryConfirmation] Warning: Cart update returned 0 rows. Check RLS policies.');
      }

      // Also update the patient record if patientId is provided
      if (patientId) {
        console.log('[DeliveryConfirmation] Updating patient record with ID:', patientId);
        const { data: patientData, error: patientError } = await supabase
          .from("patient_accounts")
          .update({
            address: address.street,
            city: address.city,
            state: address.state,
            zip_code: address.zip,
          })
          .eq("id", patientId)
          .select('id');

        if (patientError) {
          console.error('[DeliveryConfirmation] Patient record update failed:', patientError);
          // Non-blocking: still return success for cart_lines update
          toast.warning("Address saved for this order, but the patient record could not be updated.");
        } else {
          console.log('[DeliveryConfirmation] Patient record updated successfully:', patientData);
        }
      }
      
      return { lineIds, address, patientId };
    },
    // Optimistic update temporarily disabled for debugging
    // onMutate: async ({ lineIds, address }) => {
    //   await queryClient.cancelQueries({ queryKey: ["cart", effectiveUserId] });
    //   const previousData = queryClient.getQueryData(["cart", effectiveUserId]);
    //   
    //   queryClient.setQueryData(["cart", effectiveUserId], (old: any) => {
    //     if (!old?.lines) return old;
    //     return {
    //       ...old,
    //       lines: old.lines.map((line: any) => 
    //         lineIds.includes(line.id) ? {
    //           ...line,
    //           patient_address_street: address.street,
    //           patient_address_city: address.city,
    //           patient_address_state: address.state,
    //           patient_address_zip: address.zip,
    //           patient_address_formatted: address.formatted,
    //           patient_address_validated: address.status === 'verified',
    //           patient_address_validation_source: address.source || 'manual',
    //           patient_address: null,
    //         } : line
    //       ),
    //     };
    //   });
    //   
    //   return { previousData };
    // },
    onSuccess: (data) => {
      console.log('[DeliveryConfirmation] Patient address saved, invalidating cache');
      queryClient.invalidateQueries({ queryKey: ["cart", effectiveUserId] });
      
      if (data.patientId) {
        toast.success("Patient address updated and saved to patient record");
      } else {
        toast.success("Patient address updated successfully");
      }
      setEditingAddress(null);
    },
    onError: (error: any, variables, context: any) => {
      console.error("Error updating patient address:", error);
      // Rollback optimistic update
      if (context?.previousData) {
        queryClient.setQueryData(["cart", effectiveUserId], context.previousData);
      }
      toast.error(`Failed to update patient address: ${error?.message || 'Unknown error'}`);
    },
  });

  // Helper to identify practice orders (no patient or "Practice Order" label)
  const isPracticeOrder = (line: any) => !line.patient_name || line.patient_name === "Practice Order";

  // Group cart lines by destination
  const practiceOrders = cartData?.lines.filter(isPracticeOrder) || [];
  const patientGroups = cartData?.lines
    .filter(line => !isPracticeOrder(line))
    .reduce((groups, line) => {
      const key = line.patient_name || "Unknown Patient";
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(line);
      return groups;
    }, {} as Record<string, any[]>);

  const getShippingSpeedLabel = (speed: string) => {
    const labels = {
      ground: "Ground Shipping (5-7 business days)",
      priority: "Priority Shipping (3-5 business days)",
      express: "Express Shipping (2 business days)",
    };
    return labels[speed as keyof typeof labels] || speed;
  };

  const hasAllAddresses = () => {
    // Check practice address if there are practice orders
    if (practiceOrders.length > 0) {
      if (!profile?.shipping_address_street || !profile?.shipping_address_city || 
          !profile?.shipping_address_state || !profile?.shipping_address_zip) {
        return false;
      }
    }

    // Check patient addresses
    if (patientGroups && Object.keys(patientGroups).length > 0) {
      for (const lines of Object.values(patientGroups)) {
        const firstLine = lines[0];
        if (!firstLine.patient_address_street || !firstLine.patient_address_city ||
            !firstLine.patient_address_state || !firstLine.patient_address_zip) {
          return false;
        }
      }
    }

    return true;
  };

  const handleContinue = () => {
    if (!hasAllAddresses()) {
      toast.error("Please add delivery addresses for all orders");
      return;
    }

    navigate("/checkout", { 
      state: {
        ...discountState,
        addressesConfirmed: true
      }
    });
  };

  if (cartLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!cartData?.lines.length) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Your cart is empty</CardTitle>
          <CardDescription>Add some products to continue</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Progress Indicator */}
      <div className="flex items-center justify-center gap-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <span>Cart</span>
        </div>
        <div className="w-16 h-px bg-border" />
        <div className="flex items-center gap-2 text-primary font-medium">
          <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">2</div>
          <span>Delivery</span>
        </div>
        <div className="w-16 h-px bg-border" />
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-6 w-6 rounded-full border-2 flex items-center justify-center text-xs">3</div>
          <span>Payment</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Confirm Delivery Information
          </CardTitle>
          <CardDescription>
            Review and update shipping addresses for your orders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Practice Orders */}
          {practiceOrders.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Practice Order ({practiceOrders.length} {practiceOrders.length === 1 ? 'item' : 'items'})
                </h3>
              </div>

              <div className="space-y-2 pl-7 text-sm">
                {practiceOrders.map((line) => (
                  <div key={line.id} className="text-muted-foreground">
                    • {line.product?.name} (Qty: {line.quantity})
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pl-7">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{getShippingSpeedLabel(practiceOrders[0]?.shipping_speed || 'ground')}</span>
              </div>

              <div className="pl-7 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="font-medium flex items-center gap-2">
                      Delivery Address:
                      {profile?.shipping_address_street && (
                        <Badge variant="outline" className="text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    {profile?.shipping_address_street ? (
                      <div className="text-sm text-muted-foreground">
                        <div>{profile.name}</div>
                        <div>{profile.shipping_address_street}</div>
                        <div>{profile.shipping_address_city}, {profile.shipping_address_state} {profile.shipping_address_zip}</div>
                      </div>
                    ) : profile?.shipping_address_formatted ? (
                      <div className="text-sm text-muted-foreground">
                        <div>{profile.name}</div>
                        <div>{profile.shipping_address_formatted}</div>
                        <div className="flex items-center gap-2 text-amber-600 mt-1">
                          <AlertCircle className="h-4 w-4" />
                          Please update to structured format
                        </div>
                      </div>
                    ) : profileError ? (
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        Error loading address
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        No address on file - click Edit to add
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingAddress({
                      type: 'practice',
                      currentAddress: {
                        street: profile?.shipping_address_street || '',
                        city: profile?.shipping_address_city || '',
                        state: profile?.shipping_address_state || '',
                        zip: profile?.shipping_address_zip || '',
                      }
                    })}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </div>
            </div>
          )}

          {practiceOrders.length > 0 && patientGroups && Object.keys(patientGroups).length > 0 && (
            <Separator />
          )}

          {/* Patient Orders */}
          {patientGroups && Object.entries(patientGroups).map(([patientName, lines]) => (
            <div key={patientName} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Order for {patientName} ({lines.length} {lines.length === 1 ? 'item' : 'items'})
                </h3>
              </div>

              <div className="space-y-2 pl-7 text-sm">
                {lines.map((line) => (
                  <div key={line.id} className="text-muted-foreground">
                    • {line.product?.name} (Qty: {line.quantity})
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pl-7">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{getShippingSpeedLabel(lines[0]?.shipping_speed || 'ground')}</span>
              </div>

              <div className="pl-7 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="font-medium flex items-center gap-2">
                      Delivery Address:
                      {lines[0].patient_address_validated && (
                        <Badge variant="outline" className="text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    {lines[0].patient_address_street ? (
                      <div className="text-sm text-muted-foreground">
                        <div>{patientName}</div>
                        <div>{lines[0].patient_address_street}</div>
                        <div>{lines[0].patient_address_city}, {lines[0].patient_address_state} {lines[0].patient_address_zip}</div>
                      </div>
                    ) : lines[0].patient?.address_street ? (
                      <div className="text-sm">
                        <div className="text-muted-foreground">
                          <div>{patientName}</div>
                          <div>{lines[0].patient.address_street}</div>
                          <div>{lines[0].patient.address_city}, {lines[0].patient.address_state} {lines[0].patient.address_zip}</div>
                        </div>
                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mt-1 text-xs">
                          <CheckCircle2 className="h-3 w-3" />
                          From patient record
                        </div>
                      </div>
                    ) : lines[0].patient_address ? (
                      <div className="text-sm text-muted-foreground">
                        <div>{patientName}</div>
                        <div>{lines[0].patient_address}</div>
                        <div className="flex items-center gap-2 text-amber-600 mt-1">
                          <AlertCircle className="h-4 w-4" />
                          Please update to structured address format
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        No address on file
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!lines[0].patient_address_street && lines[0].patient?.address_street && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          console.log('[DeliveryConfirmation] Applying patient record address');
                          updatePatientAddress.mutate({
                            patientName,
                            lineIds: lines.map(l => l.id),
                            address: {
                              street: lines[0].patient.address_street,
                              city: lines[0].patient.address_city,
                              state: lines[0].patient.address_state,
                              zip: lines[0].patient.address_zip,
                              formatted: lines[0].patient.address_formatted || 
                                `${lines[0].patient.address_street}, ${lines[0].patient.address_city}, ${lines[0].patient.address_state} ${lines[0].patient.address_zip}`,
                              status: 'verified',
                              source: 'patient_record',
                            }
                          });
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Apply from Patient
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        console.log('[DeliveryConfirmation] Editing patient address. Lines:', lines.map(l => l.id), 'Patient ID:', lines[0].patient_id);
                        setEditingAddress({
                          type: 'patient',
                          patientId: lines[0].patient_id,
                          patientName,
                          lineIds: lines.map(l => l.id),
                          oldPatientAddress: lines[0].patient_address,
                          currentAddress: {
                            street: lines[0].patient_address_street || '',
                            city: lines[0].patient_address_city || '',
                            state: lines[0].patient_address_state || '',
                            zip: lines[0].patient_address_zip || '',
                          }
                        });
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      {!lines[0].patient_address_street && lines[0].patient_address ? (
                        <>
                          Edit
                          <Badge variant="secondary" className="ml-2 text-xs">Update Required</Badge>
                        </>
                      ) : (
                        'Edit'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <Separator className="my-6" />

          {/* Navigation Buttons */}
          <div className="flex justify-between gap-4">
            <Button
              variant="outline"
              onClick={() => navigate("/cart")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Cart
            </Button>
            <Button
              onClick={handleContinue}
              disabled={!hasAllAddresses()}
            >
              Continue to Payment
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>

          {!hasAllAddresses() && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              <AlertCircle className="h-4 w-4" />
              Please add delivery addresses for all orders before continuing
            </div>
          )}
        </CardContent>
      </Card>

      {/* Address Editor Dialog */}
      {editingAddress && (
        <DeliveryAddressEditor
          open={!!editingAddress}
          onOpenChange={(open) => !open && setEditingAddress(null)}
          addressType={editingAddress.type}
          currentAddress={editingAddress.currentAddress}
          oldPatientAddress={editingAddress.oldPatientAddress}
          onSave={(address) => {
            if (editingAddress.type === 'practice') {
              updatePracticeAddress.mutate(address);
            } else if (editingAddress.patientName && editingAddress.lineIds) {
              console.log('[DeliveryConfirmation] Saving patient address with patient ID:', editingAddress.patientId);
              updatePatientAddress.mutate({
                patientName: editingAddress.patientName,
                lineIds: editingAddress.lineIds,
                patientId: editingAddress.patientId,
                address
              });
            }
          }}
        />
      )}
    </div>
  );
}
