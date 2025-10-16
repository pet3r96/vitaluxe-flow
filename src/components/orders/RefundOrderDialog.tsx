import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, DollarSign, AlertCircle } from "lucide-react";

interface RefundOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any;
  onSuccess: () => void;
}

export const RefundOrderDialog = ({
  open,
  onOpenChange,
  order,
  onSuccess,
}: RefundOrderDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const remainingRefundable = order.total_amount - (order.total_refunded_amount || 0);
  const [refundAmount, setRefundAmount] = useState<string>(remainingRefundable.toFixed(2));
  const [refundReason, setRefundReason] = useState("");

  const refundMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(refundAmount);
      
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Please enter a valid refund amount");
      }
      
      if (amount > remainingRefundable) {
        throw new Error(`Cannot refund more than $${remainingRefundable.toFixed(2)}`);
      }
      
      if (!refundReason.trim()) {
        throw new Error("Please provide a reason for the refund");
      }

      const { data, error } = await supabase.functions.invoke(
        "authorizenet-refund-transaction",
        {
          body: {
            order_id: order.id,
            refund_amount: amount,
            refund_reason: refundReason.trim(),
            is_automatic: false,
          },
        }
      );

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || "Refund failed");
      }

      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Refund Processed",
        description: data.message || "Refund has been processed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-refunds", order.id] });
      onSuccess();
      onOpenChange(false);
      setRefundAmount(remainingRefundable.toFixed(2));
      setRefundReason("");
    },
    onError: (error: any) => {
      toast({
        title: "Refund Failed",
        description: error.message || "Failed to process refund. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    refundMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Process Refund</DialogTitle>
          <DialogDescription>
            Refund payment for order #{order.id.slice(0, 8)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="p-3 bg-muted rounded-lg space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Original Amount:</span>
                <span className="font-medium">${order.total_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Already Refunded:</span>
                <span className="font-medium">${(order.total_refunded_amount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-1 border-t">
                <span>Remaining Refundable:</span>
                <span className="text-primary">${remainingRefundable.toFixed(2)}</span>
              </div>
            </div>

            {order.authorizenet_transaction_id && (
              <p className="text-xs text-muted-foreground font-mono">
                Transaction: {order.authorizenet_transaction_id}
              </p>
            )}
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              This will process a refund through Authorize.Net. The refund may take 3-5 business days to appear.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="refund-amount">Refund Amount</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="refund-amount"
                type="number"
                step="0.01"
                min="0.01"
                max={remainingRefundable}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="pl-9"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Enter amount to refund (max ${remainingRefundable.toFixed(2)})
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="refund-reason">Reason for Refund *</Label>
            <Textarea
              id="refund-reason"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Explain the reason for this refund (required for audit trail)"
              className="min-h-[100px]"
              required
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={refundMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={refundMutation.isPending}>
              {refundMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Process Refund
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
