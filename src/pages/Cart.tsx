import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Trash2, Package, Building2 } from "lucide-react";
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

  // Determine if this is a practice order based on cart contents
  const hasPracticeOrder = (cart?.lines || []).some(
    (line: any) => line.patient_name === "Practice Order"
  );

  const { data: providerProfile } = useQuery({
    queryKey: ["provider-shipping", effectiveUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("shipping_address, name")
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

      // Validate practice order requirements
      if (hasPracticeOrder && !providerProfile?.shipping_address) {
        throw new Error("Please set your practice shipping address in your profile before placing practice orders");
      }

      // Validate patient order requirements
      if (!hasPracticeOrder) {
        const hasPatientInfo = (cart.lines as any[]).every(
          (line) => line.patient_name && line.patient_id
        );
        if (!hasPatientInfo) {
          throw new Error("All items must have patient information for patient orders");
        }
      }

      // Calculate total
      const totalAmount = (cart.lines as any[]).reduce<number>(
        (sum, line) => sum + ((line.price_snapshot || 0) * (line.quantity || 1)),
        0
      );

      // Determine the doctor the order should be attributed to
      const doctorIdForOrder = effectiveUserId && effectiveUserId !== user?.id ? effectiveUserId : user?.id;

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          doctor_id: doctorIdForOrder,
          total_amount: totalAmount,
          status: "pending",
          ship_to: hasPracticeOrder ? "practice" : "patient",
          practice_address: hasPracticeOrder ? providerProfile?.shipping_address : null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order lines from cart lines (use data as already set in cart)
      const orderLines = cart.lines.map((line: any) => ({
        order_id: order.id,
        product_id: line.product_id,
        quantity: line.quantity || 1,
        price: line.price_snapshot,
        patient_id: line.patient_id,
        patient_name: line.patient_name,
        patient_email: line.patient_email,
        patient_phone: line.patient_phone,
        patient_address: line.patient_address,
        prescription_url: line.prescription_url,
        status: "pending" as const,
      }));

      const { error: linesError } = await supabase
        .from("order_lines")
        .insert(orderLines);

      if (linesError) throw linesError;

      // Clear cart lines
      const { error: deleteError } = await supabase
        .from("cart_lines")
        .delete()
        .eq("cart_id", cart.id);

      if (deleteError) throw deleteError;

      return order;
    },
    onSuccess: (order) => {
      toast({
        title: "Order Placed Successfully! 🎉",
        description: `Order #${order.id.slice(0, 8)} has been created. You can view it under "My Orders".`,
      });
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      navigate("/orders");
    },
    onError: (error: any) => {
      toast({
        title: "Checkout Failed",
        description: error.message || "Failed to place order. Please try again.",
        variant: "destructive",
      });
    },
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
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending}
              >
                {checkoutMutation.isPending ? "Processing..." : "Place Test Order"}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Test mode: Order will be created immediately without payment
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
