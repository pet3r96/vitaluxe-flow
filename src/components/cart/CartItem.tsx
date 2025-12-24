import { memo } from "react";
import { Trash2, Package, FileCheck, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ShippingSpeedSelector } from "./ShippingSpeedSelector";
import { formatDistanceToNow } from "date-fns";
import { measureInteraction } from "@/lib/performanceMonitor";

interface CartItemProps {
  line: any;
  onRemove: (lineId: string) => void;
  onShippingSpeedChange: (lineId: string, speed: string) => void;
}

export const CartItem = memo(({ line, onRemove, onShippingSpeedChange }: CartItemProps) => {
  const product = line.products;
  const hasValidAddress = line.patient_address_validated;
  const isPracticeOrder = line.patient_name === "Practice Order";

  const handleRemove = () => {
    const perf = measureInteraction('cart-item-remove');
    onRemove(line.id);
    perf.end();
  };

  const handleShippingChange = (speed: string) => {
    const perf = measureInteraction('cart-shipping-change');
    onShippingSpeedChange(line.id, speed);
    perf.end();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <div className="h-20 w-20 rounded-md border border-border bg-muted flex-shrink-0 overflow-hidden">
          {product?.image_url ? (
            <img 
              src={product.image_url} 
              alt={product.name} 
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base">
                {product?.name || "Unknown Product"}
                {line.variant?.dosage_label && ` - ${line.variant.dosage_label}`}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {isPracticeOrder ? "Practice Order" : `For: ${line.patient_name}`}
              </p>
              {!isPracticeOrder && line.patient_email && (
                <p className="text-xs text-muted-foreground">{line.patient_email}</p>
              )}
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="font-semibold text-lg">
                ${(line.price_snapshot || product?.price || 0).toFixed(2)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {line.order_notes && (
            <div className="mt-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded border border-border">
              <strong>Notes:</strong> {line.order_notes}
            </div>
          )}

          {line.expires_at && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              <Clock className="h-3 w-3 inline mr-1" />
              Expires {formatDistanceToNow(new Date(line.expires_at), { addSuffix: true })}
            </p>
          )}

          {!hasValidAddress && !isPracticeOrder && (
            <div className="flex items-start gap-2 mt-2 p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-200">
                <strong>Address Required:</strong> Please add a complete shipping address during checkout
              </p>
            </div>
          )}

          {hasValidAddress && !isPracticeOrder && (
            <div className="flex items-center gap-2 mt-2 text-xs text-emerald-600 dark:text-emerald-400">
              <FileCheck className="h-3 w-3" />
              Address validated
            </div>
          )}
        </div>
      </div>

      {line.assigned_pharmacy_id && (
        <ShippingSpeedSelector
          value={line.shipping_speed}
          onChange={handleShippingChange}
          patientName={line.patient_name}
          isLoading={false}
        />
      )}

      <Separator className="my-4" />
    </div>
  );
});

CartItem.displayName = "CartItem";
