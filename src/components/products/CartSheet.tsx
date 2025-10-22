import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus, Minus, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface CartSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CartSheet = ({ open, onOpenChange }: CartSheetProps) => {
  const { effectiveUserId } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: cartData, isLoading } = useQuery({
    queryKey: ["cart", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return null;

      const { data: cart } = await supabase
        .from("cart")
        .select("id")
        .eq("doctor_id", effectiveUserId)
        .single();

      if (!cart) return null;

      const { data: cartLines, error } = await supabase
        .from("cart_lines")
        .select(`
          *,
          product:products (
            id,
            name,
            dosage,
            image_url
          )
        `)
        .eq("cart_id", cart.id)
        .gte("expires_at", new Date().toISOString());

      if (error) throw error;

      return {
        cartId: cart.id,
        items: cartLines || [],
      };
    },
    enabled: !!effectiveUserId && open,
    staleTime: 30000, // 30 seconds - cart sheet updates frequently
    refetchOnMount: true,
  });

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ lineId, newQuantity }: { lineId: string; newQuantity: number }) => {
      if (newQuantity < 1) {
        throw new Error("Quantity must be at least 1");
      }

      const { error } = await supabase
        .from("cart_lines")
        .update({ quantity: newQuantity })
        .eq("id", lineId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart", effectiveUserId] });
      queryClient.invalidateQueries({ queryKey: ["cart-count", effectiveUserId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update quantity");
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async (lineId: string) => {
      const { error } = await supabase
        .from("cart_lines")
        .delete()
        .eq("id", lineId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item removed from cart");
      queryClient.invalidateQueries({ queryKey: ["cart", effectiveUserId] });
      queryClient.invalidateQueries({ queryKey: ["cart-count", effectiveUserId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove item");
    },
  });

  const handleQuantityChange = (lineId: string, currentQuantity: number, delta: number) => {
    const newQuantity = currentQuantity + delta;
    if (newQuantity >= 1) {
      updateQuantityMutation.mutate({ lineId, newQuantity });
    }
  };

  const handleCheckout = () => {
    onOpenChange(false);
    navigate("/cart");
  };

  const total = cartData?.items?.reduce(
    (sum, item) => sum + (item.price_snapshot || 0) * (item.quantity || 1),
    0
  ) || 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>Shopping Cart</SheetTitle>
          <SheetDescription>
            {cartData?.items?.length || 0} item(s) in your cart
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 py-4">
            {isLoading ? (
              <div className="text-center text-muted-foreground py-8">
                Loading cart...
              </div>
            ) : !cartData?.items?.length ? (
              <div className="text-center text-muted-foreground py-8">
                Your cart is empty
              </div>
            ) : (
              cartData.items.map((item: any) => {
                const expiresAt = item.expires_at ? new Date(item.expires_at) : null;
                const now = new Date();
                const timeUntilExpiry = expiresAt ? expiresAt.getTime() - now.getTime() : null;
                const hoursUntilExpiry = timeUntilExpiry ? timeUntilExpiry / (1000 * 60 * 60) : null;
                const isExpiringSoon = hoursUntilExpiry && hoursUntilExpiry <= 48;
                
                return (
                <div key={item.id} className="flex gap-4">
                  {/* Product Image */}
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    {item.product?.image_url ? (
                      <img
                        src={item.product.image_url}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                        No image
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm line-clamp-2">
                      {item.product?.name || "Unknown Product"}
                    </h4>
                    {item.product?.dosage && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.product.dosage}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Patient: {item.patient_name}
                    </p>
                    {isExpiringSoon && expiresAt && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-yellow-600 dark:text-yellow-500">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Expires {formatDistanceToNow(expiresAt, { addSuffix: true })}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleQuantityChange(item.id, item.quantity || 1, -1)}
                          disabled={updateQuantityMutation.isPending}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-medium w-8 text-center">
                          {item.quantity || 1}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleQuantityChange(item.id, item.quantity || 1, 1)}
                          disabled={updateQuantityMutation.isPending}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeItemMutation.mutate(item.id)}
                        disabled={removeItemMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="text-right flex-shrink-0">
                    <div className="font-semibold">
                      ${((item.price_snapshot || 0) * (item.quantity || 1)).toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ${(item.price_snapshot || 0).toFixed(2)} each
                    </div>
                  </div>
                </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        <Separator className="my-4" />

        <SheetFooter className="flex-col gap-4">
          <div className="flex justify-between items-center text-lg font-bold">
            <span>Total:</span>
            <span className="text-primary">${total.toFixed(2)}</span>
          </div>
          <Button
            className="w-full"
            size="lg"
            onClick={handleCheckout}
            disabled={!cartData?.items?.length}
          >
            Check Out
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
