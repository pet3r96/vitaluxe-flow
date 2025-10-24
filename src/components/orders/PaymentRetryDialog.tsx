import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2, Plus, CreditCard, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { PaymentMethod } from "@/types/payment";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { getCSRFToken, validateCSRFToken } from "@/lib/csrf";

interface PaymentError {
  order_id: string;
  order_number: string;
  success: false;
  error: string;
  authorizenet_response?: any;
}

interface PaymentRetryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentErrors: PaymentError[];
  failedOrderIds: string[];
}

export const PaymentRetryDialog = ({
  open,
  onOpenChange,
  paymentErrors,
  failedOrderIds,
}: PaymentRetryDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { effectiveUserId } = useAuth();
  const [retryPaymentMethodId, setRetryPaymentMethodId] = useState<string>("");

  // Fetch payment methods
  const { data: paymentMethods } = useQuery({
    queryKey: ["payment-methods", effectiveUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practice_payment_methods")
        .select("*")
        .eq("practice_id", effectiveUserId)
        .order("is_default", { ascending: false });

      if (error) throw error;
      return data as PaymentMethod[];
    },
    enabled: !!effectiveUserId && open,
  });

  const retryPaymentMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      // Validate CSRF token before retrying payments
      const csrfToken = getCSRFToken();
      if (!csrfToken || !(await validateCSRFToken(csrfToken))) {
        throw new Error('Security token expired. Refresh the page and try again.');
      }
      
      const results = [];
      
      for (const orderId of failedOrderIds) {
        // Get order total
        const { data: order } = await supabase
          .from('orders')
          .select('total_amount')
          .eq('id', orderId)
          .single();
        
        if (!order) {
          results.push({ orderId, success: false, error: 'Order not found' });
          continue;
        }

        const { data, error } = await supabase.functions.invoke(
          'authorizenet-charge-payment',
          {
            body: {
              order_id: orderId,
              payment_method_id: paymentMethodId,
              amount: order.total_amount
            },
            headers: {
              'x-csrf-token': csrfToken
            }
          }
        );
        
        results.push({ 
          orderId, 
          success: !error && data.success, 
          error: error?.message || data?.message 
        });
      }
      
      return results;
    },
    onSuccess: (results) => {
      const allSucceeded = results.every(r => r.success);
      if (allSucceeded) {
        toast({ 
          title: "Payment Successful", 
          description: "All orders have been paid successfully." 
        });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        onOpenChange(false);
        navigate('/orders');
      } else {
        const stillFailed = results.filter(r => !r.success);
        toast({
          title: "Some Payments Failed",
          description: `${stillFailed.length} order(s) still have payment issues.`,
          variant: "destructive"
        });
      }
    },
    onError: () => {
      toast({
        title: "Retry Failed",
        description: "Could not retry payment. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleCancelOrders = async () => {
    const csrfToken = getCSRFToken();
    for (const orderId of failedOrderIds) {
      await supabase.functions.invoke('cancel-order', {
        body: { orderId, reason: 'Payment failed and user chose to cancel', csrf_token: csrfToken }
      });
    }
    toast({
      title: "Orders Cancelled",
      description: "Failed orders have been cancelled."
    });
    onOpenChange(false);
    navigate('/orders');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Payment Failed
          </DialogTitle>
          <DialogDescription>
            Your order was created but payment could not be processed. Choose a different payment method to complete your order.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Single consolidated error message */}
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Payment Failed</AlertTitle>
            <AlertDescription>
              <p className="font-medium">
                Payment was declined for {paymentErrors.length} order{paymentErrors.length > 1 ? 's' : ''}.
              </p>
              <p className="mt-2">
                Please select a different payment method below to complete your order.
              </p>
              {paymentErrors.length > 1 && (
                <p className="mt-2 text-xs">
                  Order numbers: {paymentErrors.map(e => e.order_number).join(', ')}
                </p>
              )}
            </AlertDescription>
          </Alert>
          
          <div className="space-y-2">
            <Label>Choose a different payment method:</Label>
            {paymentMethods && paymentMethods.length > 0 ? (
              <RadioGroup value={retryPaymentMethodId} onValueChange={setRetryPaymentMethodId}>
                {paymentMethods.map(method => (
                  <div key={method.id} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent/50 cursor-pointer">
                    <RadioGroupItem value={method.id} id={method.id} />
                    <Label htmlFor={method.id} className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {method.payment_type === 'credit_card' ? (
                            <>
                              <CreditCard className="h-4 w-4" />
                              <span className="font-medium">{method.card_type} •••• {method.card_last_five}</span>
                            </>
                          ) : (
                            <>
                              <Building2 className="h-4 w-4" />
                              <span className="font-medium">{method.bank_name} {method.account_type} •••• {method.account_last_five}</span>
                            </>
                          )}
                          {method.is_default && (
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                          )}
                        </div>
                        {method.payment_type === 'credit_card' && (
                          <span className="text-xs text-muted-foreground">Exp: {method.card_expiry}</span>
                        )}
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No payment methods available. Please add a payment method first.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleCancelOrders}>
            Cancel Orders
          </Button>
          <Button 
            onClick={() => retryPaymentMutation.mutate(retryPaymentMethodId)} 
            disabled={!retryPaymentMethodId || retryPaymentMutation.isPending}
          >
            {retryPaymentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Retry Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
