import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePlaidLink } from "react-plaid-link";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface PaymentMethod {
  id: string;
  account_name: string | null;
  account_mask: string | null;
  bank_name: string | null;
  is_default: boolean;
}

export const BankAccountsSection = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { effectiveUserId } = useAuth();
  const [linkToken, setLinkToken] = useState<string | null>(null);

  // Fetch linked payment methods
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

  // Create link token
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

  // Exchange public token
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
        description: "Bank account connected successfully",
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
        description: "Bank account removed successfully",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to remove bank account. Please try again.",
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

  const handleConnectBank = () => {
    if (linkToken && ready) {
      open();
    } else {
      createLinkTokenMutation.mutate();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing & Payment Accounts</CardTitle>
        <CardDescription>
          Connect your bank accounts securely using Plaid (Sandbox Mode)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center p-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : paymentMethods && paymentMethods.length > 0 ? (
          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">🏦</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {method.bank_name || "Bank Account"}
                      </span>
                      {method.is_default && (
                        <Badge variant="secondary" className="text-xs">
                          Default
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {method.account_name || "Checking"} ••••
                      {method.account_mask || "****"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!method.is_default && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDefaultMutation.mutate(method.id)}
                      disabled={setDefaultMutation.isPending}
                    >
                      <Star className="h-4 w-4 mr-1" />
                      Set Default
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deletePaymentMethodMutation.mutate(method.id)}
                    disabled={deletePaymentMethodMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            No bank accounts connected yet
          </div>
        )}

        <Button
          onClick={handleConnectBank}
          disabled={createLinkTokenMutation.isPending || exchangeTokenMutation.isPending}
          className="w-full"
        >
          {createLinkTokenMutation.isPending || exchangeTokenMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Connect Bank Account Securely (Plaid Sandbox)
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          🔒 Your bank credentials are never stored. All connections are secured
          through Plaid's encryption.
        </p>
      </CardContent>
    </Card>
  );
};
