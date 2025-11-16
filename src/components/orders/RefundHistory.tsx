import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign } from "lucide-react";
import { format } from "date-fns";

interface RefundHistoryProps {
  orderId: string;
}

export const RefundHistory = ({ orderId }: RefundHistoryProps) => {
  const { data: refunds, isLoading } = useQuery({
    queryKey: ["order-refunds", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_refunds")
        .select(`
          *,
          profiles!inner(name, email)
        `)
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!refunds || refunds.length === 0) {
    return null;
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "approved":
        return "default";
      case "declined":
        return "destructive";
      case "error":
        return "destructive";
      case "pending":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Refund History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {refunds.map((refund) => (
          <div
            key={refund.id}
            className="p-4 border border-border rounded-lg space-y-2"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={getStatusBadgeVariant(refund.refund_status)}>
                    {refund.refund_status.toUpperCase()}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {refund.refund_type} Refund
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(refund.created_at), "PPp")}
                </p>
              </div>
              <p className="text-lg font-bold">${refund.refund_amount.toFixed(2)}</p>
            </div>

            {refund.refund_reason && (
              <div className="pt-2">
                <p className="text-sm font-medium">Reason:</p>
                <p className="text-sm text-muted-foreground">{refund.refund_reason}</p>
              </div>
            )}

            {refund.refunded_by && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  Processed by: {(refund.profiles as any)?.name || (refund.profiles as any)?.email || 'Unknown'}
                </p>
              </div>
            )}

            {refund.refund_transaction_id && (
              <div className="pt-1">
                <p className="text-xs text-muted-foreground font-mono">
                  Txn: {refund.refund_transaction_id}
                </p>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
