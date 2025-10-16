import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePlaidLink } from "react-plaid-link";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { PaymentMethodCard } from "./PaymentMethodCard";
import { AddCreditCardDialog } from "./AddCreditCardDialog";
import { AddBankAccountDialog } from "./AddBankAccountDialog";
import { PaymentMethod } from "@/types/payment";

export const PaymentMethodsSection = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { effectiveUserId } = useAuth();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [addBankOpen, setAddBankOpen] = useState(false);

  // Fetch payment methods
  const { data: paymentMethods, isLoading } = useQuery({
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
    enabled: !!effectiveUserId,
  });

  // Get user profile for default billing address
  const { data: profile } = useQuery({
    queryKey: ["profile-billing", effectiveUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("billing_street, billing_city, billing_state, billing_zip")
        .eq("id", effectiveUserId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!effectiveUserId,
  });

  // Create Plaid link token
  const createLinkTokenMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plaid-create-link-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ user_id: effectiveUserId }),
      });

      if (!response.ok) throw new Error("Failed to create link token");
      const data = await response.json();
      return data.link_token;
    },
    onSuccess: (token) => {
      setLinkToken(token);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to initialize bank connection. Please try again.",
      });
    },
  });

  // Exchange Plaid public token
  const exchangeTokenMutation = useMutation({
    mutationFn: async (publicToken: string) => {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plaid-exchange-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ 
          public_token: publicToken,
          practice_id: effectiveUserId,
        }),
      });

      if (!response.ok) throw new Error("Failed to exchange token");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
      toast({
        title: "Success",
        description: "Bank account connected successfully via Plaid",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to connect bank account. Please try again.",
      });
    },
  });

  // Delete payment method
  const deletePaymentMethodMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("practice_payment_methods")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
      toast({
        title: "Success",
        description: "Payment method removed successfully",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to remove payment method. Please try again.",
      });
    },
  });

  // Set default payment method
  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      // First, unset all defaults
      await supabase
        .from("practice_payment_methods")
        .update({ is_default: false })
        .eq("practice_id", effectiveUserId);

      // Then set the new default
      const { error } = await supabase
        .from("practice_payment_methods")
        .update({ is_default: true })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
      toast({
        title: "Success",
        description: "Default payment method updated",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update default payment method. Please try again.",
      });
    },
  });

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (public_token) => {
      exchangeTokenMutation.mutate(public_token);
    },
  });

  const handleConnectPlaidBank = () => {
    if (linkToken && ready) {
      open();
    } else {
      createLinkTokenMutation.mutate();
    }
  };

  const creditCards = paymentMethods?.filter(pm => pm.payment_type === 'credit_card') || [];
  const bankAccounts = paymentMethods?.filter(pm => pm.payment_type === 'bank_account') || [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
          <CardDescription>
            Manage your billing payment methods for orders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center p-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs defaultValue="bank-accounts" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="bank-accounts">Bank Accounts (ACH)</TabsTrigger>
                <TabsTrigger value="credit-cards">Credit Cards</TabsTrigger>
              </TabsList>
              
              <TabsContent value="bank-accounts" className="space-y-4">
                {bankAccounts.length > 0 ? (
                  <div className="space-y-3">
                    {bankAccounts.map((method) => (
                      <PaymentMethodCard
                        key={method.id}
                        paymentMethod={method}
                        onSetDefault={() => setDefaultMutation.mutate(method.id)}
                        onDelete={() => deletePaymentMethodMutation.mutate(method.id)}
                        isDeleting={deletePaymentMethodMutation.isPending}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    No bank accounts connected yet
                  </div>
                )}
                
                <div className="space-y-2">
                  <Button
                    onClick={handleConnectPlaidBank}
                    disabled={createLinkTokenMutation.isPending || exchangeTokenMutation.isPending}
                    variant="outline"
                    className="w-full"
                  >
                    {createLinkTokenMutation.isPending || exchangeTokenMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting Plaid...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Connect via Plaid (Recommended)
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={() => setAddBankOpen(true)}
                    variant="outline"
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Bank Account Manually (eCheck)
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="credit-cards" className="space-y-4">
                {creditCards.length > 0 ? (
                  <div className="space-y-3">
                    {creditCards.map((method) => (
                      <PaymentMethodCard
                        key={method.id}
                        paymentMethod={method}
                        onSetDefault={() => setDefaultMutation.mutate(method.id)}
                        onDelete={() => deletePaymentMethodMutation.mutate(method.id)}
                        isDeleting={deletePaymentMethodMutation.isPending}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    No credit cards added yet
                  </div>
                )}
                
                <Button
                  onClick={() => setAddCardOpen(true)}
                  variant="outline"
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Credit Card
                </Button>
              </TabsContent>
            </Tabs>
          )}
          
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
            <ShieldCheck className="h-4 w-4 mt-0.5 text-green-600" />
            <p className="text-xs text-muted-foreground">
              Your payment information is securely encrypted. We never store your full card or account numbers.
            </p>
          </div>
        </CardContent>
      </Card>

      <AddCreditCardDialog
        open={addCardOpen}
        onOpenChange={setAddCardOpen}
        defaultBillingAddress={profile ? {
          street: profile.billing_street,
          city: profile.billing_city,
          state: profile.billing_state,
          zip: profile.billing_zip,
        } : undefined}
      />
      
      <AddBankAccountDialog
        open={addBankOpen}
        onOpenChange={setAddBankOpen}
        defaultBillingAddress={profile ? {
          street: profile.billing_street,
          city: profile.billing_city,
          state: profile.billing_state,
          zip: profile.billing_zip,
        } : undefined}
      />
    </>
  );
};
