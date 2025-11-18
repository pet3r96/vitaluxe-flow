import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReceiptDownloadButton } from "./ReceiptDownloadButton";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import { memo } from "react";

interface OrderMobileCardProps {
  order: any; // Using any to handle the hydrated order type with order_profits
  onViewDetails: (order: any) => void;
  currentRepId?: string | null;
  effectiveRole: string;
}

export const OrderMobileCard = memo(({ order, onViewDetails, currentRepId, effectiveRole }: OrderMobileCardProps) => {
  const isRep = effectiveRole === "topline" || effectiveRole === "downline";
  
  // Calculate commission for reps
  const getCommissionInfo = () => {
    if (!isRep || !order.order_profits || order.order_profits.length === 0) return null;
    
    const profit = order.order_profits[0];
    if (effectiveRole === "topline" && profit.topline_id === currentRepId) {
      return { amount: profit.topline_profit, label: "My Commission" };
    }
    if (effectiveRole === "downline" && profit.downline_id === currentRepId) {
      return { amount: profit.downline_profit, label: "My Commission" };
    }
    return null;
  };

  const commissionInfo = getCommissionInfo();

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card hover:bg-accent/5 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">Order #{order.id.slice(0, 8)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {format(new Date(order.created_at || ''), "MMM d, yyyy")}
          </div>
        </div>
        <Badge variant="outline" className="shrink-0">
          {order.status || "pending"}
        </Badge>
      </div>

      <div className="space-y-2 text-sm">
        {order.profiles && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Practice:</span>
            <span className="font-medium text-right">{order.profiles.name || "N/A"}</span>
          </div>
        )}
        
        <div className="flex justify-between">
          <span className="text-muted-foreground">Amount:</span>
          <span className="font-semibold">{formatCurrency(order.total_amount)}</span>
        </div>

        {commissionInfo && (
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
            <span>{commissionInfo.label}:</span>
            <span className="font-semibold">{formatCurrency(commissionInfo.amount || 0)}</span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-muted-foreground">Items:</span>
          <span>{order.order_lines?.length || 0}</span>
        </div>

        {order.payment_status && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Payment:</span>
            <Badge variant={order.payment_status === "paid" ? "default" : "secondary"} className="text-xs">
              {order.payment_status}
            </Badge>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2 border-t">
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1"
          onClick={() => onViewDetails(order)}
        >
          <Eye className="h-3.5 w-3.5 mr-1" />
          View
        </Button>
        <ReceiptDownloadButton 
          orderId={order.id} 
          orderDate={order.created_at || ''} 
          practiceName={order.profiles?.name || 'N/A'}
          size="sm" 
        />
      </div>
    </div>
  );
});

OrderMobileCard.displayName = "OrderMobileCard";
