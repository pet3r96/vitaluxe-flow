import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus, Minus, Loader2 } from "lucide-react";
import { ProCartItem, useUpdateProCartItem, useRemoveProCartItem } from "@/hooks/useProCart";

interface ProCartSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ProCartItem[];
  onSubmitOrder: () => void;
  isSubmitting: boolean;
}

export function ProCartSheet({ open, onOpenChange, items, onSubmitOrder, isSubmitting }: ProCartSheetProps) {
  const updateItem = useUpdateProCartItem();
  const removeItem = useRemoveProCartItem();

  const subtotal = items.reduce(
    (sum, item) => sum + item.pro_products.price * item.quantity,
    0
  );
  const shipping = 20;
  const total = subtotal + shipping;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Pro Products Cart</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {items.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Your cart is empty</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20">
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
                      className="h-7 w-7"
                      onClick={() => updateItem.mutate({ id: item.id, quantity: item.quantity - 1 })}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateItem.mutate({ id: item.id, quantity: item.quantity + 1 })}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  <p className="w-20 text-right font-semibold text-sm">
                    ${(item.pro_products.price * item.quantity).toLocaleString()}
                  </p>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => removeItem.mutate(item.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <SheetFooter className="flex-col gap-3 sm:flex-col">
            <Separator />
            <div className="space-y-1.5 w-full text-sm">
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

            <Button
              onClick={onSubmitOrder}
              disabled={isSubmitting}
              className="w-full"
              size="lg"
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
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
