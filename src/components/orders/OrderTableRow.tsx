import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { ReceiptDownloadButton } from "./ReceiptDownloadButton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import { memo } from "react";
import { cn } from "@/lib/utils";

interface OrderTableRowProps {
  order: any; // Using any to handle the hydrated order type with order_profits
  onViewDetails: (order: any) => void;
  currentRepId?: string | null;
  effectiveRole: string;
}

export const OrderTableRow = memo(({ order, onViewDetails, currentRepId, effectiveRole }: OrderTableRowProps) => {
  const isRep = effectiveRole === "topline" || effectiveRole === "downline";
  
  // Calculate commission for reps
  const getCommissionAmount = () => {
    if (!isRep || !order.order_profits || order.order_profits.length === 0) return null;
    
    const profit = order.order_profits[0];
    if (effectiveRole === "topline" && profit.topline_id === currentRepId) {
      return profit.topline_profit;
    }
    if (effectiveRole === "downline" && profit.downline_id === currentRepId) {
      return profit.downline_profit;
    }
    return null;
  };

  const commissionAmount = getCommissionAmount();

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className="font-medium">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">{order.id.slice(0, 8)}...</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{order.id}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      <TableCell>
        {order.created_at ? format(new Date(order.created_at), "MMM d, yyyy HH:mm") : "N/A"}
      </TableCell>
      <TableCell>
        {order.profiles?.name || "N/A"}
      </TableCell>
      <TableCell>
        <Badge variant="outline">{order.status || "pending"}</Badge>
      </TableCell>
      <TableCell className="text-right font-semibold">
        {formatCurrency(order.total_amount)}
      </TableCell>
      {isRep && (
        <TableCell className={cn(
          "text-right font-semibold",
          commissionAmount ? "text-emerald-600 dark:text-emerald-400" : ""
        )}>
          {commissionAmount ? formatCurrency(commissionAmount) : "-"}
        </TableCell>
      )}
      <TableCell className="text-center">{order.order_lines?.length || 0}</TableCell>
      <TableCell>
        {order.payment_status && (
          <Badge variant={order.payment_status === "paid" ? "default" : "secondary"}>
            {order.payment_status}
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewDetails(order)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <ReceiptDownloadButton 
            orderId={order.id} 
            orderDate={order.created_at || ''} 
            practiceName={order.profiles?.name || 'N/A'}
            size="sm" 
          />
        </div>
      </TableCell>
    </TableRow>
  );
});

OrderTableRow.displayName = "OrderTableRow";
