import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Trash2, Package } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export default function Cart() {
  const { effectiveUserId, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
          product:products(name, dosage, image_url)
        `)
        .eq("cart_id", cartData.id);

      if (linesError) throw linesError;

      return { id: cartData.id, lines: lines || [] };
    },
    enabled: !!effectiveUserId,
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
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });

  const calculateTotal = () => {
    return (cartLines as any[]).reduce<number>(
      (sum, line) => sum + ((line.price_snapshot || 0) * (line.quantity || 1)),
      0
    );
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
          <h1 className="text-3xl font-bold text-foreground">My Cart</h1>
          <p className="text-muted-foreground mt-1">
            Review and manage your cart items
          </p>
        </div>
        <ShoppingCart className="h-8 w-8 text-primary" />
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
          {cartLines.map((line: any) => (
            <Card key={line.id}>
              <CardContent className="flex items-center gap-4 p-6">
                {line.product?.image_url && (
                  <img
                    src={line.product.image_url}
                    alt={line.product.name}
                    className="h-20 w-20 object-cover rounded"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{line.product?.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {line.product?.dosage}
                  </p>
                  <p className="text-sm mt-2">
                    <span className="font-medium">Patient:</span> {line.patient_name}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Quantity:</span> {line.quantity}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-primary">
                    ${line.price_snapshot?.toFixed(2)}
                  </p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="mt-2 text-destructive"
                    onClick={() => removeMutation.mutate(line.id)}
                    disabled={removeMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle>Cart Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Items:</span>
                  <span className="font-medium">{cartLines.length}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total Amount:</span>
                  <span className="text-primary">${calculateTotal().toFixed(2)}</span>
                </div>
              </div>
              <Button 
                className="w-full" 
                size="lg"
                onClick={() => navigate("/order-confirmation")}
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
