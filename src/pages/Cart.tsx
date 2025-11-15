import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Trash2, Package, FileCheck, Clock, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/hooks/useCart";
import { DiscountCodeInput } from "@/components/orders/DiscountCodeInput";
import { ShippingSpeedSelector } from "@/components/cart/ShippingSpeedSelector";
import { Separator } from "@/components/ui/separator";
import { useMerchantFee } from "@/hooks/useMerchantFee";
import { useStaffOrderingPrivileges } from "@/hooks/useStaffOrderingPrivileges";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useMultiplePharmacyRates } from "@/hooks/useMultiplePharmacyRates";
import React from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const Cart = React.memo(function Cart() {
  console.time('Cart-Render');
  console.log('[Cart] Render start');
  
  // ===== ALL HOOKS FIRST - NO EXCEPTIONS =====
  const authContext = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // All useState hooks
  const [discountCode, setDiscountCode] = useState<string | null>(null);
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);
  const normalizedGroupsRef = useRef<Set<string>>(new Set());
  
  // Custom hooks
  const { feePercentage, calculateMerchantFee } = useMerchantFee();
  const { canOrder, isLoading: checkingPrivileges, isStaffAccount } = useStaffOrderingPrivileges();
  
  // Extract auth with safe defaults
  const effectiveUserId = authContext?.effectiveUserId || null;
  const effectiveRole = authContext?.effectiveRole || null;
  const effectivePracticeId = authContext?.effectivePracticeId || null;
  const user = authContext?.user || null;

  console.log('[Cart] Auth state:', { effectiveUserId, effectiveRole });

  // Staff access flags
  const showStaffLoading = checkingPrivileges && isStaffAccount;
  const showStaffNoAccess = isStaffAccount && !canOrder && !checkingPrivileges;

  // Resolve cart owner
  const { data: cartOwnerId, isLoading: isLoadingCartOwner, error: cartOwnerError } = useQuery({
    queryKey: ["cart-owner-id", effectiveUserId, effectiveRole, effectivePracticeId],
    queryFn: async () => {
      const { resolveCartOwnerUserId } = await import("@/lib/cartOwnerResolver");
      const ownerId = await resolveCartOwnerUserId(effectiveUserId, effectiveRole, effectivePracticeId);
      
      if (!ownerId) {
        console.error('[Cart] Failed to resolve cart owner', { effectiveUserId, effectiveRole, effectivePracticeId });
        throw new Error('Unable to determine cart owner. Please contact support.');
      }
      
      return ownerId;
    },
    enabled: !!effectiveUserId && !showStaffLoading,
    retry: 2,
  });

  console.log('[Cart] Cart owner resolved:', cartOwnerId, 'error:', cartOwnerError);

  // Cart data query - always call with enabled flag
  const { data: cart, isLoading: isLoadingCart, error: cartError } = useCart(cartOwnerId || '', {
    productFields: "name, dosage, image_url",
    includePharmacy: true,
    includeProvider: true,
    enabled: !!cartOwnerId && !showStaffLoading && !showStaffNoAccess,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  
  const isLoading = isLoadingCartOwner || isLoadingCart;

  // Get unique pharmacy IDs
  const uniquePharmacyIds = useMemo(() => {
    if (!cart?.lines) return [];
    return [...new Set(cart.lines.map(line => line.assigned_pharmacy_id).filter(Boolean))] as string[];
  }, [cart?.lines]);

  // Fetch shipping rates
  const { data: pharmacyRatesMap = {}, isLoading: ratesLoading } = useMultiplePharmacyRates(uniquePharmacyIds);

  // All memoized values
  const cartLines = useMemo(() => (cart?.lines && Array.isArray(cart.lines)) ? cart.lines : [], [cart?.lines]);
  const isEmpty = useMemo(() => cartLines.length === 0, [cartLines]);

  const patientGroups = useMemo(() => {
    const groups: any[] = [];
    const groupMap = new Map();
    
    cartLines.forEach((line: any) => {
      const key = `${line.patient_id || 'practice'}_${line.assigned_pharmacy_id || 'unknown'}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          patient_id: line.patient_id,
          patient_name: line.patient_name,
          pharmacy_id: line.assigned_pharmacy_id,
          shipping_speed: line.shipping_speed || 'standard',
          lines: []
        });
      }
      groupMap.get(key).lines.push(line);
    });
    
    groupMap.forEach(group => groups.push(group));
    return groups;
  }, [cartLines]);

  const subtotal = useMemo(() => {
    return cartLines.reduce<number>(
      (sum, line: any) => sum + ((line.price_snapshot || 0) * (line.quantity || 1)),
      0
    );
  }, [cartLines]);

  const discountAmount = useMemo(() => {
    return subtotal * (discountPercentage / 100);
  }, [subtotal, discountPercentage]);

  const subtotalAfterDiscount = useMemo(() => {
    return subtotal - discountAmount;
  }, [subtotal, discountAmount]);

  const shippingPreview = useMemo(() => {
    return patientGroups.reduce((total, group) => {
      const pharmacyRates = pharmacyRatesMap[group.pharmacy_id];
      const rate = pharmacyRates?.[group.shipping_speed] || 0;
      return total + rate;
    }, 0);
  }, [patientGroups, pharmacyRatesMap]);

  const merchantFee = useMemo(() => {
    return calculateMerchantFee(subtotalAfterDiscount, shippingPreview);
  }, [calculateMerchantFee, subtotalAfterDiscount, shippingPreview]);

  const grandTotal = useMemo(() => {
    return subtotalAfterDiscount + shippingPreview + merchantFee;
  }, [subtotalAfterDiscount, shippingPreview, merchantFee]);

  // All callbacks
  const getEnabledSpeeds = useCallback((pharmacyId: string) => {
    const rates = pharmacyRatesMap?.[pharmacyId];
    return rates ? Object.keys(rates) as ('ground' | '2day' | 'overnight')[] : [];
  }, [pharmacyRatesMap]);

  const handleDiscountApplied = useCallback((code: string, percentage: number) => {
    console.log('[Cart] Discount applied:', { code, percentage });
    setDiscountCode(code);
    setDiscountPercentage(percentage);
    toast({
      title: "Discount Applied",
      description: `${percentage}% discount applied to your order`,
    });
  }, [toast]);

  const handleRemoveDiscount = useCallback(() => {
    console.log('[Cart] Removing discount');
    setDiscountCode(null);
    setDiscountPercentage(0);
  }, []);

  const handleCheckout = useCallback(() => {
    console.log('[Cart] Navigating to delivery confirmation');
    navigate("/delivery-confirmation", {
      state: {
        discountCode,
        discountPercentage,
        merchantFeePercentage: feePercentage,
      },
    });
  }, [navigate, discountCode, discountPercentage, feePercentage]);

  // All mutations
  const removeMutation = useMutation({
    mutationFn: async (lineId: string) => {
      const { error } = await supabase
        .from("cart_lines")
        .delete()
        .eq("id", lineId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Item Removed",
        description: "Item has been removed from your cart.",
      });
      queryClient.invalidateQueries({ queryKey: ["cart", cartOwnerId] });
      queryClient.invalidateQueries({ queryKey: ["cart-count", cartOwnerId] });
    },
  });

  const updateShippingSpeedMutation = useMutation({
    mutationFn: async ({ lineIds, shipping_speed }: { lineIds: string[]; shipping_speed: 'ground' | '2day' | 'overnight' }) => {
      const { error } = await supabase
        .from("cart_lines")
        .update({ shipping_speed })
        .in("id", lineIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart", cartOwnerId] });
    },
  });

  // All effects
  useEffect(() => {
    if (!cartOwnerId || !cart?.id) return;

    console.log('Setting up realtime subscription for cart:', cart.id);

    const channel = supabase
      .channel('cart-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cart_lines',
          filter: `cart_id=eq.${cart.id}`
        },
        (payload) => {
          console.log('Cart realtime update received:', payload);
          queryClient.invalidateQueries({ queryKey: ["cart", cartOwnerId] });
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up cart realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [cartOwnerId, cart?.id, queryClient]);

  useEffect(() => {
    patientGroups.forEach((group: any) => {
      const key = `${group.patient_id || 'practice'}_${group.pharmacy_id || 'unknown'}`;
      if (normalizedGroupsRef.current.has(key)) return;
      const enabled = getEnabledSpeeds(group.pharmacy_id);
      if (enabled && enabled.length > 0 && !enabled.includes(group.shipping_speed)) {
        const newSpeed = enabled[0];
        const lineIds = group.lines.map((l: any) => l.id);
        console.log('[Cart] Normalizing shipping speed', { key, from: group.shipping_speed, to: newSpeed, lineCount: lineIds.length });
        updateShippingSpeedMutation.mutate({ lineIds, shipping_speed: newSpeed });
        normalizedGroupsRef.current.add(key);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientGroups, getEnabledSpeeds]); // ✅ Removed updateShippingSpeedMutation to prevent infinite loop

  useEffect(() => {
    console.timeEnd('Cart-Render');
  });

  // ===== NOW SAFE TO DO CONDITIONAL RENDERING =====
  
  if (showStaffLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Shopping Cart</h1>
        <p className="text-muted-foreground mb-6">Review your selections</p>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (showStaffNoAccess) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You do not have permission to access the shopping cart. Please contact your practice administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (cartOwnerError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {cartOwnerError.message || 'Unable to load cart. Please try again or contact support.'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (cartError && !isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load cart items. Please try again or contact support.
          </AlertDescription>
        </Alert>
        <Button onClick={() => window.location.reload()} className="mt-4">
          Refresh Page
        </Button>
      </div>
    );
  }

  if (isLoading || !cart) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Shopping Cart</h1>
        <p className="text-muted-foreground mb-6">Review your selections</p>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="patient-container">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 sm:h-8 sm:w-8" />
            Shopping Cart
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Review your selections before checkout
          </p>
        </div>
        {!isEmpty && (
          <Button 
            size="lg" 
            onClick={handleCheckout}
            className="w-full sm:w-auto min-h-[48px]"
          >
            Proceed to Checkout
          </Button>
        )}
      </div>

      {isEmpty ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Your cart is empty</h3>
              <p className="text-muted-foreground mb-6">
                Start adding products to your cart
              </p>
              <Button onClick={() => navigate("/products")}>
                Browse Products
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {patientGroups.map((group: any, groupIndex: number) => {
              const isExpiringSoon = group.lines.some((line: any) => {
                if (!line.expires_at) return false;
                const expiresAt = new Date(line.expires_at);
                const hoursUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
                return hoursUntilExpiry > 0 && hoursUntilExpiry <= 24;
              });

              return (
                <Card key={`${group.patient_id}_${group.pharmacy_id}_${groupIndex}`} className="overflow-hidden">
                  <CardHeader className="bg-muted/30">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg sm:text-xl">
                          {group.patient_name}
                        </CardTitle>
                      </div>
                      {isExpiringSoon && (
                        <div className="flex items-center gap-1 text-gold1 text-xs sm:text-sm">
                          <Clock className="h-4 w-4" />
                          <span className="font-medium">Expires Soon</span>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6">
                    {group.lines.map((line: any) => {
                      const expiresAt = line.expires_at ? new Date(line.expires_at) : null;
                      const isExpiringSoon = expiresAt ? ((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)) <= 24 : false;

                      return (
                        <div key={line.id} className="flex flex-col sm:flex-row gap-4 mb-4 pb-4 border-b last:border-0 last:mb-0 last:pb-0">
                          {line.product?.image_url && (
                            <img
                              src={line.product.image_url}
                              alt={line.product.name}
                              className="h-16 w-16 sm:h-20 sm:w-20 object-cover rounded"
                              onError={(e) => {
                                const img = e.currentTarget as HTMLImageElement;
                                img.onerror = null;
                                img.src = '/placeholder.svg';
                              }}
                            />
                          )}
                          <div className="flex-1 w-full">
                            <h3 className="font-semibold text-base sm:text-lg">{line.product?.name}</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              {line.product?.dosage}
                            </p>
                            {isExpiringSoon && expiresAt && (
                              <div className="flex items-center gap-2 mt-2 p-2 bg-gold1/10 rounded border border-gold1/30">
                                <AlertTriangle className="h-4 w-4 text-gold1" />
                                <span className="text-xs text-gold1">
                                  Expires {formatDistanceToNow(expiresAt, { addSuffix: true })}
                                </span>
                              </div>
                            )}
                            {line.provider?.profiles?.name && (
                              <p className="text-xs sm:text-sm">
                                <span className="font-medium">Provider:</span> {line.provider.profiles.name}
                              </p>
                            )}
                            <p className="text-xs sm:text-sm">
                              <span className="font-medium">Quantity:</span> {line.quantity}
                            </p>
                            {line.custom_sig && line.patient_name !== "Practice Order" && (
                              <div className="text-xs sm:text-sm mt-2 bg-blue-50 dark:bg-blue-950/30 p-2 rounded border border-blue-200 dark:border-blue-800">
                                <span className="font-medium text-blue-700 dark:text-blue-300">SIG:</span>
                                <p className="text-blue-600 dark:text-blue-400 mt-1">{line.custom_sig}</p>
                              </div>
                            )}
                            {line.order_notes && (
                              <div className="text-xs sm:text-sm mt-2 bg-gold1/10 p-2 rounded border border-gold1/30">
                                <span className="font-medium text-gold1">Notes:</span>
                                <p className="text-gold1 mt-1">{line.order_notes}</p>
                              </div>
                            )}
                            {line.prescription_url && (
                              <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                                <FileCheck className="h-3 w-3" />
                                <span>Prescription uploaded</span>
                              </div>
                            )}
                          </div>
                          <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-4">
                            <p className="text-lg sm:text-xl font-bold text-primary">
                              ${line.price_snapshot?.toFixed(2)}
                            </p>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-destructive min-h-[44px] min-w-[44px]"
                              onClick={() => removeMutation.mutate(line.id)}
                              disabled={removeMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    
                    <Separator className="my-3" />
                    
                    <ShippingSpeedSelector
                      value={group.shipping_speed}
                      onChange={(speed) => {
                        const lineIds = group.lines.map((l: any) => l.id);
                        updateShippingSpeedMutation.mutate({ lineIds, shipping_speed: speed });
                      }}
                      patientName={group.patient_name}
                      enabledOptions={getEnabledSpeeds(group.pharmacy_id)}
                      isLoading={ratesLoading}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <DiscountCodeInput
                  onDiscountApplied={handleDiscountApplied}
                  onDiscountRemoved={handleRemoveDiscount}
                  currentCode={discountCode || undefined}
                  currentPercentage={discountPercentage}
                />
                
                <Separator />
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  {discountPercentage > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount ({discountPercentage}%)</span>
                      <span>-${discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Shipping (estimated)</span>
                    <span>${shippingPreview.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Processing Fee ({feePercentage}%)</span>
                    <span>${merchantFee.toFixed(2)}</span>
                  </div>
                </div>
                
                <Separator />
                
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>${grandTotal.toFixed(2)}</span>
                </div>
                
                <Button 
                  size="lg" 
                  className="w-full"
                  onClick={handleCheckout}
                >
                  Proceed to Checkout
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
});

const CartWithErrorBoundary = () => (
  <ErrorBoundary
    fallback={
      <div className="container mx-auto p-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Cart Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Unable to load your cart. This may be due to a temporary issue with your account configuration.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => window.location.href = '/products'}>
                Return to Products
              </Button>
              <Button 
                variant="outline"
                onClick={async () => {
                  try {
                    const { data } = await supabase.auth.getUser();
                    if (data.user) {
                      const { data: cart } = await supabase
                        .from('cart')
                        .select('id')
                        .eq('doctor_id', data.user.id)
                        .maybeSingle();
                      if (cart) {
                        await supabase.from('cart_lines').delete().eq('cart_id', cart.id);
                      }
                    }
                    window.location.href = '/products';
                  } catch (err) {
                    console.error('Failed to clear cart:', err);
                    window.location.href = '/products';
                  }
                }}
              >
                Clear Cart & Return to Products
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    }
  >
    <Cart />
  </ErrorBoundary>
);

export default CartWithErrorBoundary;
