import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Building2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface PaymentMethod {
  id: string;
  payment_type: string;
  card_type?: string;
  card_last_five?: string;
  bank_name?: string;
  account_last_five?: string;
  is_default: boolean;
}

interface PaymentMethodSelectorProps {
  onMethodSelected: (methodId: string) => void;
  selectedMethodId: string | null;
}

export const PaymentMethodSelector = ({ onMethodSelected, selectedMethodId }: PaymentMethodSelectorProps) => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { effectiveUserId } = useAuth();

  useEffect(() => {
    if (effectiveUserId) {
      loadPaymentMethods();
    }
  }, [effectiveUserId]);

  const loadPaymentMethods = async () => {
    try {
      if (!effectiveUserId) {
        console.error('[PaymentMethodSelector] No authenticated user found');
        toast({
          title: "Authentication Required",
          description: "Please log in to continue",
          variant: "destructive"
        });
        return;
      }

      console.log('[PaymentMethodSelector] Loading payment methods for user:', effectiveUserId);

      const { data, error } = await supabase
        .from('practice_payment_methods')
        .select('*')
        .eq('practice_id', effectiveUserId)
        .eq('status', 'active')
        .order('is_default', { ascending: false });

      console.log('[PaymentMethodSelector] Query result:', { 
        foundCount: data?.length || 0, 
        error: error?.message || null,
        userId: effectiveUserId 
      });

      if (error) {
        console.error('[PaymentMethodSelector] Database error:', error);
        toast({
          title: "Database Error",
          description: `Failed to load payment methods: ${error.message}`,
          variant: "destructive"
        });
        throw error;
      }

      setPaymentMethods(data || []);
      
      // Auto-select default payment method
      const defaultMethod = data?.find(m => m.is_default);
      if (defaultMethod && !selectedMethodId) {
        console.log('[PaymentMethodSelector] Auto-selecting default method:', defaultMethod.id);
        onMethodSelected(defaultMethod.id);
      } else if (data && data.length > 0 && !selectedMethodId) {
        console.log('[PaymentMethodSelector] Auto-selecting first method:', data[0].id);
        onMethodSelected(data[0].id);
      }
    } catch (error: any) {
      console.error('[PaymentMethodSelector] Error loading payment methods:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Error Loading Payment Methods",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddPaymentMethod = () => {
    navigate('/profile?tab=payment');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Method</CardTitle>
          <CardDescription>Loading payment methods...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (paymentMethods.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Method Required</CardTitle>
          <CardDescription>
            You need to add a payment method before subscribing to VitaLuxePro
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <p className="text-amber-900 dark:text-amber-100 font-medium mb-2">
              No Payment Methods Found
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Your payment method will be charged $250/month after your 7-day free trial ends.
              Please add a credit card or bank account to your profile to continue.
            </p>
          </div>
          <Button onClick={handleAddPaymentMethod} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Go to Profile → Add Payment Method
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Payment Method</CardTitle>
        <CardDescription>
          Choose which payment method to use for your subscription
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup value={selectedMethodId || ''} onValueChange={onMethodSelected}>
          {paymentMethods.map((method) => (
            <div key={method.id} className="flex items-center space-x-3 space-y-0">
              <RadioGroupItem value={method.id} id={method.id} />
              <Label
                htmlFor={method.id}
                className="flex-1 flex items-center justify-between cursor-pointer p-3 rounded-lg border border-input hover:bg-accent"
              >
                <div className="flex items-center gap-3">
                  {method.payment_type === 'credit_card' ? (
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <div className="font-medium">
                      {method.payment_type === 'credit_card' 
                        ? `${method.card_type} •••• ${method.card_last_five}`
                        : `${method.bank_name} •••• ${method.account_last_five}`
                      }
                    </div>
                  </div>
                </div>
                {method.is_default && (
                  <Badge variant="secondary" className="ml-2">Default</Badge>
                )}
              </Label>
            </div>
          ))}
        </RadioGroup>

        <Button 
          variant="outline" 
          onClick={handleAddPaymentMethod}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add New Payment Method
        </Button>
      </CardContent>
    </Card>
  );
};
