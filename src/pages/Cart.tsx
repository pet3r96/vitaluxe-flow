import { useState } from "react";
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

export default function Cart() {
  const { effectiveUserId, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [discountCode, setDiscountCode] = useState<string | null>(null);
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);

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
            profiles!inner(name, npi, dea)
          )
        `)
        .eq("cart_id", cartData.id)
        .gte("expires_at", new Date().toISOString());

      if (linesError) throw linesError;

      return { id: cartData.id, lines: lines || [] };
    },
    enabled: !!effectiveUserId,
    staleTime: 0,
  });

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

  const calculateSubtotal = () => {
    return (cartLines as any[]).reduce<number>(
      (sum, line) => sum + ((line.price_snapshot || 0) * (line.quantity || 1)),
      0
    );
  };

  const calculateDiscountAmount = () => {
    return calculateSubtotal() * (discountPercentage / 100);
  };

  const calculateTotal = () => {
    return calculateSubtotal() - calculateDiscountAmount();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading cart...</div>
      </div>
    );
  }

  const cartLines = cart?.lines || [];
  const isEmpty = cartLines.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">My Cart</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Review and manage your cart items
          </p>
        </div>
        <ShoppingCart className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
      </div>

      {isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Your cart is empty</h3>
            <p className="text-muted-foreground text-center">
              Add products to your cart to get started
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {cartLines.map((line: any) => {
            const expiresAt = line.expires_at ? new Date(line.expires_at) : null;
            const now = new Date();
            const timeUntilExpiry = expiresAt ? expiresAt.getTime() - now.getTime() : null;
            const hoursUntilExpiry = timeUntilExpiry ? timeUntilExpiry / (1000 * 60 * 60) : null;
            const isExpiringSoon = hoursUntilExpiry && hoursUntilExpiry <= 48;
            
            return (
            <Card key={line.id} className={isExpiringSoon ? "border-yellow-500" : ""}>
              <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 sm:p-6">
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
                  <p className="text-xs sm:text-sm mt-2">
                    <span className="font-medium">Patient:</span> {line.patient_name}
                  </p>
                  {isExpiringSoon && expiresAt && (
                    <div className="flex items-center gap-2 mt-2 p-2 bg-yellow-50 dark:bg-yellow-950/30 rounded border border-yellow-200 dark:border-yellow-800">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <span className="text-xs text-yellow-700 dark:text-yellow-400">
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
                    <div className="text-xs sm:text-sm mt-2 bg-amber-50 dark:bg-amber-950/30 p-2 rounded border border-amber-200 dark:border-amber-800">
                      <span className="font-medium text-amber-700 dark:text-amber-300">Notes:</span>
                      <p className="text-amber-600 dark:text-amber-400 mt-1">{line.order_notes}</p>
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
              </CardContent>
            </Card>
            );
          })}

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
                
                <div className="flex justify-between text-base sm:text-lg font-bold border-t pt-2">
                  <span>Total Amount:</span>
                  <span className="text-primary">${calculateTotal().toFixed(2)}</span>
                </div>
              </div>
              <Button 
                className="w-full min-h-[48px] text-base" 
                size="lg"
                onClick={() => navigate("/order-confirmation", { 
                  state: { discountCode, discountPercentage } 
                })}
              >
                Proceed to Confirmation
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Review and confirm your order on the next page
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
