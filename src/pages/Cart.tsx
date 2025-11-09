import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Trash2, Package, FileCheck, Clock, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { DiscountCodeInput } from "@/components/orders/DiscountCodeInput";
import { ShippingSpeedSelector } from "@/components/cart/ShippingSpeedSelector";
import { Separator } from "@/components/ui/separator";
import { useMerchantFee } from "@/hooks/useMerchantFee";
import { useStaffOrderingPrivileges } from "@/hooks/useStaffOrderingPrivileges";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

// Wrapper component to fetch enabled options for a pharmacy
const ShippingSpeedSelectorWithOptions = ({ 
  pharmacyId, 
  value, 
  onChange, 
  patientName, 
  disabled 
}: { 
  pharmacyId: string; 
  value: 'ground' | '2day' | 'overnight';
  onChange: (value: 'ground' | '2day' | 'overnight') => void;
  patientName: string;
  disabled?: boolean;
}) => {
  const { data: enabledRates, isLoading } = useQuery({
    queryKey: ['pharmacy-enabled-rates', pharmacyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('pharmacy_shipping_rates')
        .select('shipping_speed')
        .eq('pharmacy_id', pharmacyId)
        .eq('enabled', true);
      return data?.map(r => r.shipping_speed as 'ground' | '2day' | 'overnight') || [];
    },
    enabled: !!pharmacyId
  });
  
  return (
    <ShippingSpeedSelector
      value={value}
      onChange={onChange}
      patientName={patientName}
      disabled={disabled}
      enabledOptions={enabledRates}
      isLoading={isLoading}
    />
  );
};

export default function Cart() {
  const { effectiveUserId, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [discountCode, setDiscountCode] = useState<string | null>(null);
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);
  const { feePercentage, calculateMerchantFee } = useMerchantFee();
  const { canOrder, isLoading: checkingPrivileges, isStaffAccount } = useStaffOrderingPrivileges();

  // Staff without ordering privileges cannot access cart - compute flags only (avoid early return before hooks)
  const showStaffLoading = checkingPrivileges && isStaffAccount;
  const showStaffNoAccess = isStaffAccount && !canOrder;

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
        product:products(name, dosage, image_url),
        provider:providers(
          id,
          user_id,
          profiles!providers_user_id_fkey(name, npi, dea)
        )
        `)
        .eq("cart_id", cartData.id)
        .gte("expires_at", new Date().toISOString());

      if (linesError) throw linesError;

      return { id: cartData.id, lines: lines || [] };
    },
    enabled: !!effectiveUserId,
    staleTime: 0, // Always fresh - we rely on realtime updates
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Realtime subscription for instant cart updates
  useEffect(() => {
    if (!effectiveUserId || !cart?.id) return;

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
          queryClient.invalidateQueries({ queryKey: ["cart", effectiveUserId] });
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up cart realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [effectiveUserId, cart?.id, queryClient]);

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
      queryClient.invalidateQueries({ queryKey: ["cart", effectiveUserId] });
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
      await queryClient.cancelQueries({ queryKey: ["cart", effectiveUserId] });
      
      // Snapshot the previous value
      const previousCart = queryClient.getQueryData(["cart", effectiveUserId]);
      
      // Optimistically update the cache
      queryClient.setQueryData(["cart", effectiveUserId], (old: any) => {
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
        queryClient.setQueryData(["cart", effectiveUserId], context.previousCart);
      }
      toast({
        title: "Error",
        description: "Failed to update shipping speed",
        variant: "destructive"
      });
    },
    onSettled: () => {
      // Always refetch after error or success (background sync)
      queryClient.invalidateQueries({ queryKey: ["cart", effectiveUserId] });
    }
  });

  // Group cart lines by patient - practice orders grouped together
  const patientGroups = useMemo(() => {
    if (!cart?.lines) return [];
    
    const groups: Record<string, any> = {};
    
    cart.lines.forEach((line: any) => {
      // All practice orders share the same key to group them together
      const patientKey = line.patient_name === "Practice Order" 
        ? "practice_order" 
        : (line.patient_id || `unknown_${line.id}`);
      
      if (!groups[patientKey]) {
        groups[patientKey] = {
          patient_name: line.patient_name || 'Practice Order',
          patient_id: line.patient_id,
          pharmacy_id: line.pharmacy_id,
          lines: [],
          shipping_speed: line.shipping_speed || 'ground'
        };
      }
      
      groups[patientKey].lines.push(line);
    });
    
    return Object.values(groups);
  }, [cart]);

  const cartLines = cart?.lines || [];
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

  const getShippingRate = useCallback((speed: string) => {
    const rates = { ground: 9.99, '2day': 19.99, overnight: 29.99 };
    return rates[speed as keyof typeof rates] || 9.99;
  }, []);

  const shippingPreview = useMemo(() => {
    return patientGroups.reduce((total, group) => {
      return total + getShippingRate(group.shipping_speed);
    }, 0);
  }, [patientGroups, getShippingRate]);

  const merchantFee = useMemo(() => {
    return calculateMerchantFee(calculateTotal(), shippingPreview);
  }, [calculateMerchantFee, calculateTotal, shippingPreview]);

  const grandTotal = useMemo(() => {
    return calculateTotal() + shippingPreview + merchantFee;
  }, [calculateTotal, shippingPreview, merchantFee]);

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

  if (isLoading) {
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
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  {group.patient_name}
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
                      {line.provider?.profiles && (
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
                
                <ShippingSpeedSelectorWithOptions
                  pharmacyId={group.pharmacy_id}
                  value={group.shipping_speed}
                  onChange={(speed) => {
                    const lineIds = group.lines.map((l: any) => l.id);
                    updateShippingSpeedMutation.mutate({ lineIds, shipping_speed: speed });
                  }}
                  patientName={group.patient_name}
                  disabled={updateShippingSpeedMutation.isPending}
                />
                
                <div className="text-sm text-muted-foreground pt-1">
                  Estimated shipping: ${getShippingRate(group.shipping_speed).toFixed(2)}
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
                    merchantFeeAmount: merchantFee
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
}
