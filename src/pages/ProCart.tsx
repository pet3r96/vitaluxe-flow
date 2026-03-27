import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus, Minus, Loader2, ShoppingCart } from "lucide-react";
import { useProCart, useUpdateProCartItem, useRemoveProCartItem, useClearProCart } from "@/hooks/useProCart";
import { useCreateProOrder } from "@/hooks/useProOrders";
import { useAuth } from "@/contexts/AuthContext";
import { generateProOrderPdf, proOrderPdfToBase64 } from "@/lib/proOrderPdfGenerator";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";

export default function ProCart() {
  const { data: cartItems = [] } = useProCart();
  const updateItem = useUpdateProCartItem();
  const removeItem = useRemoveProCartItem();
  const clearCart = useClearProCart();
  const createOrder = useCreateProOrder();
  const { user, effectivePracticeId } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.pro_products.price * item.quantity,
    0
  );
  const shipping = 20;
  const total = subtotal + shipping;

  const handleSubmitOrder = async () => {
    if (!user || cartItems.length === 0) return;
    if (!effectivePracticeId) {
      toast.error("You must be associated with a practice to submit professional product orders.");
      return;
    }
    setIsSubmitting(true);

    try {
      let contactName = "";
      let contactEmail = user.email || "";
      let contactPhone = "";
      let shipToAddress: Record<string, string> = {};

      if (effectivePracticeId) {
        const { data: practice } = await supabase
          .from("profiles")
          .select("name, email, phone, shipping_address_street, shipping_address_suite, shipping_address_city, shipping_address_state, shipping_address_zip")
          .eq("id", effectivePracticeId)
          .single();

        if (practice) {
          contactName = practice.name || "";
          contactEmail = practice.email || contactEmail;
          contactPhone = practice.phone || "";
          shipToAddress = {
            street: practice.shipping_address_street || "",
            suite: practice.shipping_address_suite || "",
            city: practice.shipping_address_city || "",
            state: practice.shipping_address_state || "",
            zip: practice.shipping_address_zip || "",
          };
        }
      }

      const lineItems = cartItems.map((item) => ({
        product_id: item.pro_product_id,
        name: item.pro_products.name,
        price: item.pro_products.price,
        quantity: item.quantity,
        total: item.pro_products.price * item.quantity,
      }));

      const subtotal = lineItems.reduce((sum, li) => sum + li.total, 0);
      const shipping = 20;
      const total = subtotal + shipping;

      const pdf = generateProOrderPdf({
        contactName,
        contactEmail,
        contactPhone,
        shipToAddress,
        orderDate: format(new Date(), "MM/dd/yyyy"),
        lineItems,
        subtotal,
        shipping,
        total,
      });

      const pdfBase64 = proOrderPdfToBase64(pdf);

      await createOrder.mutateAsync({
        user_id: user.id,
        practice_id: effectivePracticeId || null,
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        ship_to_address: shipToAddress,
        line_items: lineItems,
        subtotal,
        shipping,
        total,
        notes: null,
      });

      await supabase.functions.invoke("send-pro-order", {
        body: {
          pdfBase64,
          contactName,
          contactEmail,
          practiceId: effectivePracticeId,
          orderTotal: total,
          itemCount: lineItems.length,
        },
      });

      pdf.save(`Pro_Order_${format(new Date(), "yyyy-MM-dd")}.pdf`);

      await clearCart.mutateAsync();
      toast.success("Order submitted! PDF has been downloaded and sent to operations.");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit order");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="responsive-page max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground">Pro Cart</h1>
      <p className="text-muted-foreground mb-6">Review your professional product order</p>

      {cartItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShoppingCart className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">Your pro cart is empty</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {cartItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/20">
                <div className="flex-1 min-w-0 mr-3">
                  <p className="font-medium text-sm truncate">{item.pro_products.name}</p>
                  <p className="text-sm text-muted-foreground">
                    ${item.pro_products.price.toLocaleString()} each
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center border border-border rounded-md">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateItem.mutate({ id: item.id, quantity: item.quantity - 1 })}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateItem.mutate({ id: item.id, quantity: item.quantity + 1 })}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  <p className="w-24 text-right font-semibold text-sm">
                    ${(item.pro_products.price * item.quantity).toLocaleString()}
                  </p>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => removeItem.mutate(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Separator className="my-6" />

          <div className="space-y-2 text-sm max-w-sm ml-auto">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">${subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span className="font-medium">${shipping.toLocaleString()}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span>${total.toLocaleString()}</span>
            </div>
            <p className="text-xs text-muted-foreground italic">
              *A 4% processing fee applies to credit card payments.
            </p>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              onClick={handleSubmitOrder}
              disabled={isSubmitting}
              size="lg"
              className="w-full sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Order"
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
