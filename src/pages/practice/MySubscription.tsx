import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SubscriptionOverview } from "@/components/subscription/SubscriptionOverview";
import { PaymentMethodManager } from "@/components/subscription/PaymentMethodManager";
import { InvoiceList } from "@/components/subscription/InvoiceList";
import { SubscriptionActionsCard } from "@/components/subscription/SubscriptionActionsCard";

export default function MySubscription() {
  const { effectiveRole, isProviderAccount } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Redirect providers to dashboard - they can't manage billing
  useEffect(() => {
    if (isProviderAccount) {
      navigate("/dashboard");
    }
  }, [isProviderAccount, navigate]);

  useEffect(() => {
    const fetchSubscriptionData = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.functions.invoke('get-subscription-details');
        
        if (error) throw error;
        
        setSubscriptionData(data);
      } catch (err: any) {
        console.error("Error fetching subscription details:", err);
        setError(err.message || "Failed to load subscription details");
      } finally {
        setLoading(false);
      }
    };

    if (!isProviderAccount) {
      fetchSubscriptionData();
    }
  }, [isProviderAccount]);

  if (isProviderAccount) {
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-64 md:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">My Subscription</h1>
          <p className="text-muted-foreground mt-2">Manage your VitaLuxePro subscription</p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Subscription</h1>
        <p className="text-muted-foreground mt-2">Manage your VitaLuxePro subscription and billing</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <SubscriptionOverview subscription={subscriptionData?.subscription} />
          
          <Tabs defaultValue="payment-methods" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
              <TabsTrigger value="invoices">Billing History</TabsTrigger>
            </TabsList>
            <TabsContent value="payment-methods" className="space-y-4">
              <PaymentMethodManager 
                paymentMethods={subscriptionData?.paymentMethods || []} 
              />
            </TabsContent>
            <TabsContent value="invoices">
              <InvoiceList invoices={subscriptionData?.invoices || []} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <SubscriptionActionsCard subscription={subscriptionData?.subscription} />
        </div>
      </div>
    </div>
  );
}
