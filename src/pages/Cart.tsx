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
  
  const authContext = useAuth();
  
  // Multi-level defensive check
  if (!authContext) {
    console.warn('[Cart] AuthContext is null/undefined');
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
        </div>
      </div>
    );
  }
  
  if (!authContext.effectiveUserId) {
    console.warn('[Cart] effectiveUserId not available yet');
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
        </div>
      </div>
    );
  }
  
  const { effectiveUserId, effectiveRole, effectivePracticeId, user } = authContext;
  console.log('[Cart] Auth loaded, effectiveUserId:', effectiveUserId, 'role:', effectiveRole);
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [discountCode, setDiscountCode] = useState<string | null>(null);
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);
  const { feePercentage, calculateMerchantFee } = useMerchantFee();
  const { canOrder, isLoading: checkingPrivileges, isStaffAccount } = useStaffOrderingPrivileges();

  // Staff without ordering privileges cannot access cart - compute flags only (avoid early return before hooks)
  const showStaffLoading = checkingPrivileges && isStaffAccount;
  const showStaffNoAccess = isStaffAccount && !canOrder && !checkingPrivileges;

  // CRITICAL: Resolve correct cart owner ID based on role with error handling
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

  const { data: cart, isLoading: isLoadingCart, error: cartError } = useCart(cartOwnerId, {
    productFields: "name, dosage, image_url",
    includePharmacy: true,
    includeProvider: true,
    enabled: !!cartOwnerId && !showStaffLoading && !cartOwnerError,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  
  const isLoading = isLoadingCartOwner || isLoadingCart;

  // Staff without ordering privileges cannot access cart
  if (showStaffLoading) {
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

  if (showStaffNoAccess) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Shopping Cart</h1>
        <p className="text-muted-foreground mb-6">Review your selections</p>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You do not have ordering privileges. Please contact your practice administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  // Handle cart owner resolution errors
  if (cartOwnerError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Shopping Cart</h1>
        <p className="text-muted-foreground mb-6">Review your selections</p>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {(effectiveRole === 'staff' || effectiveRole === 'practice') && !effectivePracticeId
              ? 'No practice association found. Please contact your administrator to set up your practice.'
              : 'Unable to load cart. Please try refreshing the page or contact support if the issue persists.'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  // Handle cart loading errors
  if (cartError && !isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Shopping Cart</h1>
        <p className="text-muted-foreground mb-6">Review your selections</p>
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

  // Show loading state
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

  // Realtime subscription for instant cart updates
  useEffect(() => {
    if (!cartOwnerId || !cart?.id) return;

    console.log('Setting up realtime subscription for cart:', cart.id);

    const channel = supabase
      .channel('cart-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'cart_lines',
          filter: `cart_id=eq.${cart.id}`
        },
        (payload) => {
          console.log('Cart realtime update received:', payload);
          // Instantly invalidate and refetch cart data
          queryClient.invalidateQueries({ queryKey: ["cart", cartOwnerId] });
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up cart realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [cartOwnerId, cart?.id, queryClient]);

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
      // CRITICAL FIX: Use cartOwnerId for invalidation
      queryClient.invalidateQueries({ queryKey: ["cart", cartOwnerId] });
      queryClient.invalidateQueries({ queryKey: ["cart-count", cartOwnerId] });
    },
  });

  const updateShippingSpeedMutation = useMutation({
    mutationFn: async ({ lineIds, shipping_speed }: { lineIds: string[], shipping_speed: 'ground' | '2day' | 'overnight' }) => {
      const { error } = await supabase
        .from('cart_lines')
        .update({ shipping_speed })
        .in('id', lineIds);

      if (error) throw error;
    },
    onMutate: async ({ lineIds, shipping_speed }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["cart", cartOwnerId] });
      
      // Snapshot the previous value
      const previousCart = queryClient.getQueryData(["cart", cartOwnerId]);
      
      // Optimistically update the cache
      queryClient.setQueryData(["cart", cartOwnerId], (old: any) => {
        if (!old) return old;
        
        return {
          ...old,
          lines: old.lines.map((line: any) => 
            lineIds.includes(line.id) 
              ? { ...line, shipping_speed }
              : line
          )
        };
      });
      
      // Return context with previous value for rollback
      return { previousCart };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousCart) {
        queryClient.setQueryData(["cart", cartOwnerId], context.previousCart);
      }
      toast({
        title: "Error",
        description: "Failed to update shipping speed",
        variant: "destructive"
      });
    },
    onSettled: () => {
      // Always refetch after error or success (background sync)
      queryClient.invalidateQueries({ queryKey: ["cart", cartOwnerId] });
    }
  });

  // Group cart lines by patient AND pharmacy - critical for multi-pharmacy orders
  const patientGroups = useMemo(() => {
    console.time('Cart-PatientGroups');
    if (!cart?.lines) {
      console.timeEnd('Cart-PatientGroups');
      return [];
    }
    
    const groups: Record<string, any> = {};
    
    cart.lines.forEach((line: any) => {
      // Group by BOTH patient AND pharmacy to handle multiple pharmacies per patient
      const patientKey = line.patient_name === "Practice Order" 
        ? `practice_order_${line.assigned_pharmacy_id}` 
        : `${line.patient_id || `unknown_${line.id}`}_${line.assigned_pharmacy_id}`;
      
      if (!groups[patientKey]) {
        groups[patientKey] = {
          patient_name: line.patient_name || 'Practice Order',
          patient_id: line.patient_id,
          pharmacy_id: line.assigned_pharmacy_id,
          pharmacy_name: line.pharmacy?.name || 'Unknown Pharmacy',
          lines: [],
          shipping_speed: line.shipping_speed || 'ground'
        };
      }
      
      groups[patientKey].lines.push(line);
    });
    
    return Object.values(groups);
  }, [cart]);

  // Get unique pharmacy IDs from cart
  const uniquePharmacyIds = useMemo(() => {
    return [...new Set(patientGroups.map(g => g.pharmacy_id).filter(Boolean))];
  }, [patientGroups]);

  // Fetch rates for all pharmacies in cart using a single stable hook
  const { data: pharmacyRatesMap = {}, isLoading: ratesLoading } = useMultiplePharmacyRates(uniquePharmacyIds);
  
  // Get enabled speeds for a pharmacy from batched data
  const getEnabledSpeeds = useCallback((pharmacyId: string) => {
    const rates = pharmacyRatesMap?.[pharmacyId];
    return rates ? Object.keys(rates) as ('ground' | '2day' | 'overnight')[] : [];
  }, [pharmacyRatesMap]);

  // Safe cart lines extraction with null checks
  const cartLines = (cart?.lines && Array.isArray(cart.lines)) ? cart.lines : [];
  const isEmpty = cartLines.length === 0;

  const calculateSubtotal = useCallback(() => {
    return (cartLines as any[]).reduce<number>(
      (sum, line) => sum + ((line.price_snapshot || 0) * (line.quantity || 1)),
      0
    );
  }, [cartLines]);

  const calculateDiscountAmount = useCallback(() => {
    return calculateSubtotal() * (discountPercentage / 100);
  }, [calculateSubtotal, discountPercentage]);

  const calculateTotal = useCallback(() => {
    return calculateSubtotal() - calculateDiscountAmount();
  }, [calculateSubtotal, calculateDiscountAmount]);

  const shippingPreview = useMemo(() => {
    return patientGroups.reduce((total, group) => {
      const pharmacyRates = pharmacyRatesMap[group.pharmacy_id];
      const rate = pharmacyRates?.[group.shipping_speed] || 0;
      return total + rate;
    }, 0);
  }, [patientGroups, pharmacyRatesMap]);

  const merchantFee = useMemo(() => {
    return calculateMerchantFee(calculateTotal(), shippingPreview);
  }, [calculateMerchantFee, calculateTotal, shippingPreview]);

  const grandTotal = useMemo(() => {
    return calculateTotal() + shippingPreview + merchantFee;
  }, [calculateTotal, shippingPreview, merchantFee]);

  // Normalize invalid shipping speeds automatically (one-time per group)
  const normalizedGroupsRef = useRef<Set<string>>(new Set());
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
  }, [patientGroups, getEnabledSpeeds, updateShippingSpeedMutation]);

  if (showStaffLoading) {
    return (
      <div className="patient-container">
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (showStaffNoAccess) {
    return (
      <div className="patient-container">
        <Card className="patient-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
              <ShoppingCart className="h-6 w-6" />
              Cart
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                You don't have permission to place orders. Please contact your practice administrator to request ordering privileges.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading state with better UX
  if (isLoading || !cart) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading cart...</div>
      </div>
    );
  }

  return (
    <div className="patient-container">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div className="text-center sm:text-left w-full sm:w-auto">
          <h1 className="text-3xl sm:text-4xl font-bold gold-text-gradient">My Cart</h1>
          <p className="text-muted-foreground">
            Review and manage your cart items
          </p>
        </div>
        <ShoppingCart className="h-6 w-6 sm:h-8 sm:w-8 text-primary hidden sm:block" />
      </div>

      {isEmpty ? (
        <Card className="patient-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Your cart is empty</h3>
            <p className="text-muted-foreground text-center">
              Add products to your cart to get started
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {patientGroups.map((group: any, groupIndex: number) => (
            <Card key={`group-${group.patient_id || groupIndex}`} className="patient-card overflow-hidden">
              <CardHeader className="bg-muted/50 p-4">
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    <span>{group.patient_name}</span>
                    {group.pharmacy_name && group.pharmacy_name !== 'Unknown Pharmacy' && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground text-sm">{group.pharmacy_name}</span>
                      </>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {group.lines.map((line: any) => {
            const expiresAt = line.expires_at ? new Date(line.expires_at) : null;
            const now = new Date();
            const timeUntilExpiry = expiresAt ? expiresAt.getTime() - now.getTime() : null;
                  const hoursUntilExpiry = timeUntilExpiry ? timeUntilExpiry / (1000 * 60 * 60) : null;
                  const isExpiringSoon = hoursUntilExpiry && hoursUntilExpiry <= 48;
                  
                  return (
                    <div key={line.id} className={`flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-lg border ${isExpiringSoon ? "border-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20" : "bg-card"}`}>
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
                            This cart item will expire {formatDistanceToNow(expiresAt, { addSuffix: true })}
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
                  disabled={updateShippingSpeedMutation.isPending}
                  enabledOptions={getEnabledSpeeds(group.pharmacy_id)}
                  isLoading={ratesLoading}
                />
                
                <div className="text-sm text-muted-foreground pt-1">
                  Estimated shipping: ${(pharmacyRatesMap[group.pharmacy_id]?.[group.shipping_speed] || 0).toFixed(2)}
                </div>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">Cart Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6 pt-0">
              {/* Discount Code Input */}
              <DiscountCodeInput
                onDiscountApplied={(code, percentage) => {
                  setDiscountCode(code);
                  setDiscountPercentage(percentage);
                }}
                onDiscountRemoved={() => {
                  setDiscountCode(null);
                  setDiscountPercentage(0);
                }}
                currentCode={discountCode || undefined}
                currentPercentage={discountPercentage}
              />
              
              <div className="space-y-2">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Total Items:</span>
                  <span className="font-medium">{cartLines.reduce((sum, line) => sum + (line.quantity || 1), 0)}</span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-medium">${calculateSubtotal().toFixed(2)}</span>
                </div>
                
                {discountPercentage > 0 && (
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-green-600 dark:text-green-400">Discount ({discountPercentage}%):</span>
                    <span className="font-medium text-green-600 dark:text-green-400">-${calculateDiscountAmount().toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Estimated Shipping:</span>
                  <span className="font-medium">${shippingPreview.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">
                    Merchant Processing Fee ({feePercentage.toFixed(2)}%):
                  </span>
                  <span className="font-medium">${merchantFee.toFixed(2)}</span>
                </div>
                
                <Separator />
                
                <div className="flex justify-between text-base sm:text-lg font-bold">
                  <span>Grand Total:</span>
                  <span className="text-primary">${grandTotal.toFixed(2)}</span>
                </div>
              </div>
              <Button 
                className="w-full min-h-[48px] text-base" 
                size="lg"
                onClick={() => navigate("/delivery-confirmation", { 
                  state: { 
                    discountCode, 
                    discountPercentage,
                    merchantFeePercentage: feePercentage,
                    merchantFeeAmount: merchantFee,
                    shippingPreview: shippingPreview // Pass actual calculated shipping to checkout
                  } 
                })}
              >
                Continue to Delivery
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Review shipping addresses on the next page
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
});

const CartWithErrorBoundary = () => (
  <ErrorBoundary>
    <Cart />
  </ErrorBoundary>
);

export default CartWithErrorBoundary;
