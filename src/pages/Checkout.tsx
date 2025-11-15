import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { resolveCartOwnerUserId } from "@/lib/cartOwnerResolver";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ArrowLeft, CheckCircle2, FileCheck, Package, Upload, FileText, X, Loader2, Truck, CreditCard, ShieldCheck, Building2, MapPin } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { getCSRFToken, validateCSRFToken } from "@/lib/csrf";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PaymentRetryDialog } from "@/components/orders/PaymentRetryDialog";
import { AddCreditCardDialog } from "@/components/profile/AddCreditCardDialog";
import { formatCardDisplay } from "@/lib/authorizenet-acceptjs";
import { useMerchantFee } from "@/hooks/useMerchantFee";
import { logger } from "@/lib/logger";
import { useStaffOrderingPrivileges } from "@/hooks/useStaffOrderingPrivileges";
import { Skeleton } from "@/components/ui/skeleton";

export default function Checkout() {
  const { effectiveUserId, effectivePracticeId, effectiveRole, user, isStaffAccount, isProviderAccount } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [agreed, setAgreed] = useState(false);
  const [uploadingPrescriptions, setUploadingPrescriptions] = useState<Record<string, boolean>>({});
  const [prescriptionFiles, setPrescriptionFiles] = useState<Record<string, File>>({});
  const [prescriptionPreviews, setPrescriptionPreviews] = useState<Record<string, string>>({});
  const { canOrder, isLoading: checkingPrivileges } = useStaffOrderingPrivileges();
  
  // Calculate the correct practice ID for shipping address
  // Providers and staff use effectivePracticeId, practice owners use effectiveUserId
  const practiceIdForShipping = (isProviderAccount || isStaffAccount) ? effectivePracticeId : effectiveUserId;
  
  // Resolve cart owner
  const { data: cartOwnerId } = useQuery({
    queryKey: ['cart-owner', effectiveUserId, effectiveRole, effectivePracticeId],
    queryFn: () => resolveCartOwnerUserId(effectiveUserId!, effectiveRole!, effectivePracticeId),
    enabled: !!effectiveUserId && !!effectiveRole,
    staleTime: 5 * 60 * 1000,
  });
  
  // Payment method state
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>("");
  const [showPaymentRetryDialog, setShowPaymentRetryDialog] = useState(false);
  const [paymentErrors, setPaymentErrors] = useState<any[]>([]);
  const [failedOrderIds, setFailedOrderIds] = useState<string[]>([]);
  const [showAddCardDialog, setShowAddCardDialog] = useState(false);
  
  // Get discount from navigation state - use useState to persist during async operations
  const location = useLocation();
  const [discountCode, setDiscountCode] = useState<string | null>(location.state?.discountCode || null);
  const [discountPercentage, setDiscountPercentage] = useState<number>(location.state?.discountPercentage || 0);
  
  // Get merchant fee
  const { calculateMerchantFee } = useMerchantFee();
  const merchantFeePercentage = location.state?.merchantFeePercentage || 3.75;

  // For staff members and providers with ordering privileges, use practice payment methods
  const practiceIdForPayment = (isStaffAccount || isProviderAccount) ? effectivePracticeId : effectiveUserId;

  // Track component mount state to prevent operations during navigation
  const [isMounted, setIsMounted] = useState(true);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Calculation functions - defined before useMemo to avoid initialization errors
  const calculateSubtotal = () => {
    return (cart?.lines || []).reduce<number>(
      (sum, line: any) => sum + ((line.price_snapshot || 0) * (line.quantity || 1)),
      0
    );
  };

  const calculateDiscountAmount = () => {
    if (!discountPercentage) return 0;
    return calculateSubtotal() * (discountPercentage / 100);
  };

  const calculateShipping = () => {
    // For checkout preview, we need actual rates from the cart which already has them calculated
    // Cart calculates real rates using useMultiplePharmacyRates
    // We just show what was passed from cart via navigation state
    return location.state?.shippingPreview || 0;
  };

  const calculateFinalTotal = () => {
    return calculateSubtotal() - calculateDiscountAmount() + calculateShipping() + merchantFeeAmount;
  };

  const { data: cart, isLoading} = useCart(cartOwnerId, {
    hydratePatients: true,
    enabled: !!cartOwnerId,
    staleTime: 5000,
    refetchOnWindowFocus: false,
  });

  // Staff privilege checks - compute after hooks
  const showStaffCheckoutLoading = checkingPrivileges && isStaffAccount;
  const showStaffCheckoutNoAccess = isStaffAccount && !canOrder;

  // Calculate merchant fee - must come after cart query to avoid TDZ
  const merchantFeeAmount = useMemo(() => {
    // Use passed merchant fee if available from navigation state
    if (location.state?.merchantFeeAmount !== undefined) {
      return location.state.merchantFeeAmount;
    }
    
    // Cart must be loaded to calculate
    if (!cart || !cart.lines) {
      return 0;
    }
    
    const subtotal = calculateSubtotal();
    const shipping = calculateShipping();
    const discount = calculateDiscountAmount();
    
    return calculateMerchantFee(subtotal - discount, shipping);
  }, [cart?.lines, discountPercentage, calculateMerchantFee, location.state?.merchantFeeAmount]);

  const hasPracticeOrder = (cart?.lines || []).some(
    (line: any) => line.patient_name === "Practice Order"
  );

  const { data: providerProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["provider-shipping", practiceIdForShipping],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("shipping_address_street, shipping_address_city, shipping_address_state, shipping_address_zip, shipping_address_formatted, name")
        .eq("id", practiceIdForShipping)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!practiceIdForShipping,
  });

  // Fetch staff user's provider record for provider_id (needed for RLS on order_lines)
  const { data: staffProviderRecord } = useQuery({
    queryKey: ["staff-provider-record", effectiveUserId],
    queryFn: async () => {
      if (!isStaffAccount) return null;
      
      const { data, error } = await supabase
        .from("providers")
        .select("id, user_id, practice_id, role_type, can_order")
        .eq("user_id", effectiveUserId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching staff provider record:", error);
        return null;
      }
      return data;
    },
    enabled: isStaffAccount && !!effectiveUserId,
  });

  // Fetch payment methods (credit cards only) - include both practice and personal cards for staff
  const { data: paymentMethods } = useQuery({
    queryKey: ["payment-methods", practiceIdForPayment, user?.id],
    queryFn: async () => {
      // For staff/providers, fetch cards from both practice AND their personal account
      const practiceIds = (isStaffAccount || isProviderAccount) 
        ? [practiceIdForPayment, user?.id].filter(Boolean)
        : [practiceIdForPayment];

      const { data, error } = await supabase
        .from("practice_payment_methods")
        .select("*")
        .in("practice_id", practiceIds)
        .eq("payment_type", "credit_card")
        .neq("status", "removed")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Auto-select default payment method
      if (data && data.length > 0 && !selectedPaymentMethodId) {
        const defaultMethod = data.find(pm => pm.is_default) || data[0];
        setSelectedPaymentMethodId(defaultMethod.id);
      }
      
      return data || [];
    },
    enabled: !!practiceIdForPayment && !!user,
  });

  // Fetch checkout attestation
  const { data: checkoutAttestation } = useQuery({
    queryKey: ["checkout-attestation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkout_attestation")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      // Prevent mutation during navigation/unmount
      if (!isMounted) {
        throw new Error("Navigation in progress. Please wait and try again.");
      }
      
      // Use current cart data from useCart hook
      if (!cart || !cart.id || !cart.lines || cart.lines.length === 0) {
        throw new Error("Cart is empty or unavailable");
      }

      const linesAll = (cart.lines as any[]) || [];

      // If there are any practice lines, make sure profile is loaded before proceeding
      const practiceLines = linesAll.filter((line) => line.patient_name === "Practice Order");
      
      if (practiceLines.length > 0 && isLoadingProfile) {
        throw new Error("Loading practice information... Please wait and try again.");
      }

      if (linesAll.length === 0) {
        throw new Error("Cart is empty");
      }

      if (!agreed) {
        throw new Error("You must agree to the terms before confirming your order");
      }

      // Validate payment method selected
      if (!selectedPaymentMethodId) {
        throw new Error("Please select a payment method before confirming your order");
      }

      // Validate CSRF token before order placement
      const csrfToken = getCSRFToken();
      if (!csrfToken) {
        throw new Error("Security token missing. Please refresh the page and try again.");
      }
      
      const isValid = await validateCSRFToken(csrfToken);
      if (!isValid) {
        throw new Error("Security token expired. Please refresh the page and try again.");
      }

      const patientLines = linesAll.filter(
        (line) => line.patient_name !== "Practice Order"
      );

      // Validate practice shipping address if needed
      if (practiceLines.length > 0) {
        const hasShippingAddress = providerProfile?.shipping_address_street && 
                                  providerProfile?.shipping_address_city && 
                                  providerProfile?.shipping_address_state && 
                                  providerProfile?.shipping_address_zip;
        
        if (!hasShippingAddress) {
          const missingFields = [];
          if (!providerProfile?.shipping_address_street) missingFields.push('street address');
          if (!providerProfile?.shipping_address_city) missingFields.push('city');
          if (!providerProfile?.shipping_address_state) missingFields.push('state');
          if (!providerProfile?.shipping_address_zip) missingFields.push('ZIP code');
          
          throw new Error(
            `Please set your practice shipping address in your profile before placing practice orders. Missing: ${missingFields.join(', ')}`
          );
        }
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
      
      // Validate shipping speed is selected for all lines
      const missingShippingSpeed = allLines.filter((line: any) => !line.shipping_speed);
      if (missingShippingSpeed.length > 0) {
        throw new Error("Please select shipping speed for all items in your cart before confirming your order");
      }
      
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

      logger.info('Starting checkout via edge function', logger.sanitize({ 
        cart_id: cart.id,
        total_lines: linesAll.length 
      }));

      // Call the optimized edge function
      const { data, error } = await supabase.functions.invoke('place-order', {
        body: {
          cart_id: cart.id,
          payment_method_id: selectedPaymentMethodId,
          discount_code: discountCode,
          discount_percentage: discountPercentage,
          merchant_fee_percentage: merchantFeePercentage,
          csrf_token: csrfToken,
        }
      });

      if (error) {
        logger.error('Edge function invocation failed', error instanceof Error ? error : new Error(String(error)), {});
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || "Order placement failed");
      }

      return {
        createdOrders: data.created_orders || [],
        failedPayments: data.failed_payments || [],
        failedOrders: data.failed_orders || [],
        deletedCartLineIds: data.deleted_cart_line_ids || [],
      };
    },
    onSuccess: async (result) => {
      const { createdOrders, failedPayments, failedOrders, deletedCartLineIds } = result;
      
      if (failedPayments.length === 0) {
        // All payments succeeded
        const orderCount = createdOrders.length;
        const deletedCount = deletedCartLineIds?.length || 0;
        console.log('[Checkout] Cart cleared confirmation', { deletedCount });
        
        // Send order notifications to patients - OPTIMIZED: Run in parallel for faster checkout
        const notificationPromises = createdOrders.map(async (order) => {
          if (order.ship_to === 'patient' && order.patient_id) {
            try {
              const { data: patientWithUser } = await supabase
                .from('patient_accounts')
                .select('user_id, first_name, last_name, email, phone')
                .eq('id', order.patient_id)
                .single();

              if (patientWithUser && patientWithUser.user_id) {
                const orderTotal = order.total_amount || 0;
                console.log('[Checkout] Sending notification for patient order');
                await supabase.functions.invoke('handleNotifications', {
                  body: {
                    user_id: patientWithUser.user_id,
                    type: 'order_placed',
                    title: 'Order Confirmed',
                    message: `Your order #${order.order_number} has been placed and will be shipped to you. Total: $${orderTotal.toFixed(2)}`,
                    metadata: {
                      orderId: order.id,
                      orderNumber: order.order_number,
                      orderTotal: orderTotal.toFixed(2)
                    }
                  }
                });
              }
            } catch (notifError) {
              console.error('[Checkout] Error sending order notification:', notifError);
            }
          }
        });
        
        // Wait for all notifications to complete (or fail) - don't block checkout
        await Promise.allSettled(notificationPromises);
        
        // CRITICAL: Clear cart using edge function (belt & suspenders)
        console.log('[Checkout] Clearing cart after successful order', { 
          cartOwnerId, 
          effectiveUserId,
          deletedCount 
        });
        
        // Call clear-cart edge function to ensure all lines are removed
        if (cartOwnerId) {
          try {
            const { error: clearError } = await supabase.functions.invoke('clear-cart', {
              body: { cartOwnerId }
            });
            
            if (clearError) {
              console.error('[Checkout] Error clearing cart via function:', clearError);
            } else {
              console.log('[Checkout] Successfully cleared cart via edge function');
            }
          } catch (err) {
            console.error('[Checkout] Exception calling clear-cart:', err);
          }
        }
        
        // CRITICAL: Invalidate cart queries using correct cartOwnerId
        queryClient.invalidateQueries({ queryKey: ["cart", cartOwnerId] });
        queryClient.invalidateQueries({ queryKey: ["cart-count", cartOwnerId] });
        queryClient.invalidateQueries({ queryKey: ["cart-owner"] });
        
        // Force refetch orders (not just invalidate) to ensure fresh data
        await queryClient.refetchQueries({ 
          predicate: (query) => {
            const key = query.queryKey[0];
            return key === 'orders';
          }
        });

        // Also invalidate for good measure
        await queryClient.invalidateQueries({ 
          predicate: (query) => query.queryKey[0] === 'orders'
        });
        
        toast({
          title: "Order Placed Successfully! 🎉",
          description: `${orderCount} order${orderCount > 1 ? 's' : ''} placed and paid. Cart cleared (${deletedCount} items). Redirecting to orders page...`,
        });
        
        // Navigate after ensuring cache updates propagate
        setTimeout(() => {
          navigate("/orders", {
            state: {
              orderPlaced: true,
              orderNumber: createdOrders[0]?.order_number,
              orderCount: createdOrders.length,
              _forceRefresh: Date.now() // Cache buster
            }
          });
        }, 300);
      } else {
        // Some payments failed - show retry dialog
        setPaymentErrors(failedPayments);
        setFailedOrderIds(failedOrders);
        setShowPaymentRetryDialog(true);
        // Don't invalidate cart query - keep cart intact so user can edit if needed
        
        toast({
          title: "Payment Declined",
          description: `${failedPayments.length} payment${failedPayments.length > 1 ? 's' : ''} failed. Your cart has been preserved. Fix payment details and try again, or go back to cart.`,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Order Placement Failed",
        description: error.message || "Failed to place order. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Safe mutation trigger that checks mount state
  const handlePlaceOrder = () => {
    if (!isMounted) {
      toast({
        title: "Please wait",
        description: "Page is still loading. Please try again in a moment.",
        variant: "destructive",
      });
      return;
    }
    checkoutMutation.mutate();
  };

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

    // Update cart line with prescription URL via edge function
    const { error: updateError } = await supabase.functions.invoke('update-cart-prescription', {
      body: {
        lineId,
        prescriptionUrl: urlData.signedUrl
      }
    });

      if (updateError) throw updateError;

      // Refetch cart data to update UI
      queryClient.invalidateQueries({ queryKey: ["cart", cartOwnerId] });
      
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading order details...</div>
      </div>
    );
  }

  const cartLines = cart?.lines || [];
  
  // Group practice orders together
  const practiceLines = cartLines.filter((l: any) => l.patient_name === "Practice Order");
  const otherLines = cartLines.filter((l: any) => l.patient_name !== "Practice Order");
  
  const isEmpty = !isLoading && cartLines.length === 0;

  if (isEmpty) {
    navigate("/cart");
    return null;
  }

  if (showStaffCheckoutLoading) {
    return (
      <div className="patient-container">
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (showStaffCheckoutNoAccess) {
    return (
      <div className="patient-container">
        <Card className="patient-card">
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl">Checkout</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                You don't have permission to place orders. Please contact your practice administrator to request ordering privileges.
              </AlertDescription>
            </Alert>
            <Button 
              variant="outline" 
              onClick={() => navigate('/cart')}
              className="mt-4 touch-target"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Cart
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress Indicator */}
      <div className="flex items-center justify-center gap-2 text-sm mb-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <span>Cart</span>
        </div>
        <div className="w-16 h-px bg-border" />
        <div className="flex items-center gap-2 text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <span>Delivery</span>
        </div>
        <div className="w-16 h-px bg-border" />
        <div className="flex items-center gap-2 text-primary font-medium">
          <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">3</div>
          <span>Payment</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <ShieldCheck className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Complete Checkout</h1>
          <p className="text-muted-foreground mt-1">
            Review your order, select payment method, and complete your purchase
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
          {/* Practice Orders Group */}
          {practiceLines.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Practice Order ({practiceLines.length} {practiceLines.length === 1 ? "item" : "items"})
              </h3>
              <div className="space-y-4 pl-7">
                {practiceLines.map((line: any, index: number) => (
                  <div key={line.id}>
                    {index > 0 && <Separator className="my-4" />}
                    <div className="flex items-start gap-4">
                      {line.product?.image_url && (
                        <img
                          src={line.product.image_url}
                          alt={line.product.name}
                          className="h-20 w-20 flex-shrink-0 object-cover rounded-md border border-border"
                        />
                      )}
                      <div className="flex-1 space-y-1">
                        <h4 className="font-semibold text-lg">{line.product?.name}</h4>
                        <p className="text-sm text-muted-foreground">{line.product?.dosage}</p>
                        
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
                          <Badge variant="outline" className="capitalize">
                            <Truck className="h-3 w-3 mr-1" />
                            {line.shipping_speed === '2day' ? '2-Day' : 
                             line.shipping_speed === 'overnight' ? 'Overnight' : 
                             'Ground'} Shipping
                          </Badge>
                          <Badge variant="secondary">Practice Order</Badge>
                        </div>
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
              </div>
              {otherLines.length > 0 && <Separator className="my-6" />}
            </div>
          )}

          {/* Patient Orders (non-practice) */}
          {otherLines.map((line: any, index: number) => (
            <div key={line.id}>
              {index > 0 && <Separator className="my-4" />}
              <div className="flex items-start gap-4">
                {line.product?.image_url && (
                  <img
                    src={line.product.image_url}
                    alt={line.product.name}
                    className="h-20 w-20 flex-shrink-0 object-cover rounded-md border border-border"
                  />
                )}
                <div className="flex-1 space-y-1">
                  <h4 className="font-semibold text-lg">{line.product?.name}</h4>
                  <p className="text-sm text-muted-foreground">{line.product?.dosage}</p>
                  
                  {(line.custom_sig || line.custom_dosage) && (
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
                    <Badge variant="outline" className="capitalize">
                      <Truck className="h-3 w-3 mr-1" />
                      {line.shipping_speed === '2day' ? '2-Day' : 
                       line.shipping_speed === 'overnight' ? 'Overnight' : 
                       'Ground'} Shipping
                    </Badge>
                    <Badge>Patient: {line.patient_name}</Badge>
                  </div>
                  {line.product?.requires_prescription && (
                    <div className="mt-2 space-y-2">
                      {line.prescription_url ? (
                        <Badge variant="success" size="sm">
                          <FileCheck className="h-3 w-3 mr-1" />
                          Prescription Uploaded
                        </Badge>
                      ) : (
                        <div className="space-y-2">
                          <Badge variant="destructive">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Missing Prescription
                          </Badge>
                          
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
                                className="w-full border-gold1/30 hover:bg-gold1/10"
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
          
          {/* Discount Summary */}
          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center text-base">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-semibold">${calculateSubtotal().toFixed(2)}</span>
            </div>
            
            {discountCode && discountPercentage > 0 && (
              <>
                <div className="flex justify-between items-center text-base">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Discount:</span>
                    <Badge variant="secondary" className="text-xs">
                      {discountCode} ({discountPercentage}% off)
                    </Badge>
                  </div>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    -${calculateDiscountAmount().toFixed(2)}
                  </span>
                </div>
                <Separator />
              </>
            )}
            
            <div className="flex justify-between items-center text-base">
              <span className="text-muted-foreground">Shipping & Handling:</span>
              <span className="font-semibold">${calculateShipping().toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between items-center text-base">
              <span className="text-muted-foreground">
                Merchant Processing Fee ({merchantFeePercentage.toFixed(2)}%):
              </span>
              <span className="font-semibold">${merchantFeeAmount.toFixed(2)}</span>
            </div>
            
            <Separator />
            
            <div className="flex justify-between items-center text-lg font-bold">
              <span>Grand Total:</span>
              <span className="text-2xl text-primary">${calculateFinalTotal().toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Method Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Method
          </CardTitle>
          <CardDescription>
            Select a payment method for this order
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {paymentMethods && paymentMethods.length > 0 ? (
            <>
              <RadioGroup value={selectedPaymentMethodId} onValueChange={setSelectedPaymentMethodId}>
                {paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    className="flex items-center space-x-3 p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                  >
                    <RadioGroupItem value={method.id} id={method.id} />
                    <Label htmlFor={method.id} className="flex-1 cursor-pointer flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {method.card_type} ••••{method.card_last_five}
                          </span>
                          {method.card_expiry && (
                            <span className="text-sm text-muted-foreground">
                              Exp: {method.card_expiry}
                            </span>
                          )}
                          {method.is_default && (
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                          )}
                        </div>
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              
              <Separator />
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddCardDialog(true)}
                  className="flex-1"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Add Card
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-8 space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-muted p-3">
                  <CreditCard className="h-8 w-8 text-muted-foreground" />
                </div>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">No payment methods added</p>
                <p className="text-sm text-muted-foreground">Add a payment method to continue</p>
              </div>
              <Button onClick={() => setShowAddCardDialog(true)}>
                <CreditCard className="h-4 w-4 mr-2" />
                Add Credit Card
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Medical Attestation - Dynamic */}
      {checkoutAttestation && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <AlertCircle className="h-5 w-5" />
              {checkoutAttestation.title}
            </CardTitle>
            <CardDescription>
              {checkoutAttestation.subtitle}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm leading-relaxed">
                By checking the box below, you attest that:
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  {checkoutAttestation.content.split('\n').map((line: string, idx: number) => {
                    const cleanedLine = line.trim().replace(/^-\s*/, '');
                    return cleanedLine ? <li key={idx}>{cleanedLine}</li> : null;
                  })}
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
                  {checkoutAttestation.checkbox_text}
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Practice Shipping Address Display - REMOVED, now handled in delivery confirmation */}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={() => navigate("/delivery-confirmation")}
          disabled={checkoutMutation.isPending}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Delivery
        </Button>
        <Button
          size="lg"
          className="flex-1"
          onClick={handlePlaceOrder}
          disabled={
            checkoutMutation.isPending || 
            !agreed ||
            isLoading ||
            !isMounted ||
            !(cart?.lines && cart.lines.length > 0)
          }
        >
          {checkoutMutation.isPending ? (
            "Processing Order..."
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Place Order
            </>
          )}
        </Button>
      </div>

      {!agreed && (
        <p className="text-center text-sm text-muted-foreground">
          Please agree to the medical attestation to proceed
        </p>
      )}

      <PaymentRetryDialog
        open={showPaymentRetryDialog}
        onOpenChange={setShowPaymentRetryDialog}
        paymentErrors={paymentErrors}
        failedOrderIds={failedOrderIds}
      />

      <AddCreditCardDialog
        open={showAddCardDialog}
        onOpenChange={setShowAddCardDialog}
        defaultBillingAddress={
          providerProfile
            ? {
                street: providerProfile.shipping_address_street,
                city: providerProfile.shipping_address_city,
                state: providerProfile.shipping_address_state,
                zip: providerProfile.shipping_address_zip,
              }
            : undefined
        }
        practiceId={effectiveUserId}
      />

    </div>
  );
}
