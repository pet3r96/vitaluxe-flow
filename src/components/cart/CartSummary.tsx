import { memo } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DiscountCodeInput } from "@/components/orders/DiscountCodeInput";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CartSummaryProps {
  subtotal: number;
  shippingCost: number;
  discountCode: string | null;
  discountPercentage: number;
  discountAmount: number;
  merchantFeeAmount: number;
  total: number;
  feePercentage: number;
  onDiscountApplied: (code: string, percentage: number) => void;
  onDiscountRemoved: () => void;
}

export const CartSummary = memo(({
  subtotal,
  shippingCost,
  discountCode,
  discountPercentage,
  discountAmount,
  merchantFeeAmount,
  total,
  feePercentage,
  onDiscountApplied,
  onDiscountRemoved
}: CartSummaryProps) => {
  return (
    <>
      <CardHeader>
        <CardTitle>Order Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">${subtotal.toFixed(2)}</span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Shipping</span>
            <span className="font-medium">${shippingCost.toFixed(2)}</span>
          </div>

          {discountPercentage > 0 && (
            <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
              <span>Discount ({discountPercentage}%)</span>
              <span className="font-medium">-${discountAmount.toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Processing Fee ({feePercentage}%)</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Credit card processing fee</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className="font-medium">${merchantFeeAmount.toFixed(2)}</span>
          </div>
        </div>

        <Separator />

        <div className="flex justify-between text-lg font-bold">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>

        <DiscountCodeInput 
          onDiscountApplied={onDiscountApplied}
          onDiscountRemoved={onDiscountRemoved}
          currentCode={discountCode || undefined}
          currentPercentage={discountPercentage}
        />
      </CardContent>
    </>
  );
});

CartSummary.displayName = "CartSummary";
