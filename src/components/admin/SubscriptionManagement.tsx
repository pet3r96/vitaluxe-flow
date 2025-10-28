import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2, CreditCard, DollarSign, TrendingUp, CheckCircle, XCircle, Clock } from "lucide-react";
import { useState } from "react";

export function SubscriptionManagement() {
  const queryClient = useQueryClient();
  const [selectedPractice, setSelectedPractice] = useState<string | null>(null);

  // Fetch all subscriptions
  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practice_subscriptions")
        .select(`
          *,
          profiles:practice_id (
            id,
            name,
            email
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch subscription metrics
  const { data: metrics } = useQuery({
    queryKey: ["subscription-metrics"],
    queryFn: async () => {
      const { data: subs } = await supabase
        .from("practice_subscriptions")
        .select("status, monthly_price");

      const active = subs?.filter(s => s.status === "active").length || 0;
      const trial = subs?.filter(s => s.status === "trial").length || 0;
      const cancelled = subs?.filter(s => s.status === "cancelled").length || 0;
      const revenue = subs
        ?.filter(s => s.status === "active")
        .reduce((sum, s) => sum + Number(s.monthly_price || 0), 0) || 0;

      return { active, trial, cancelled, revenue };
    },
  });

  // Fetch payments for selected practice
  const { data: payments } = useQuery({
    queryKey: ["subscription-payments", selectedPractice],
    queryFn: async () => {
      if (!selectedPractice) return [];
      const { data, error } = await supabase
        .from("subscription_payments")
        .select("*")
        .eq("practice_id", selectedPractice)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedPractice,
  });

  // Cancel subscription mutation
  const cancelSubscription = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { error } = await supabase
        .from("practice_subscriptions")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancel_at_period_end: true,
        })
        .eq("id", subscriptionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["subscription-metrics"] });
      toast.success("Subscription cancelled successfully");
    },
    onError: (error) => {
      toast.error("Failed to cancel subscription: " + error.message);
    },
  });

  // Activate subscription mutation
  const activateSubscription = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { error } = await supabase
        .from("practice_subscriptions")
        .update({
          status: "active",
          cancelled_at: null,
          cancel_at_period_end: false,
        })
        .eq("id", subscriptionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["subscription-metrics"] });
      toast.success("Subscription activated successfully");
    },
    onError: (error) => {
      toast.error("Failed to activate subscription: " + error.message);
    },
  });

  const getStatusBadge = (status: string) => {
    const styles = {
      active: "bg-green-500/10 text-green-500 border-green-500/20",
      trial: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
      expired: "bg-gray-500/10 text-gray-500 border-gray-500/20",
      suspended: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    };

    return (
      <Badge variant="outline" className={styles[status as keyof typeof styles]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.active || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trial Subscriptions</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.trial || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.cancelled || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics?.revenue.toFixed(2) || "0.00"}</div>
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Subscriptions</CardTitle>
          <CardDescription>Manage practice subscriptions and billing</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Practice</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Trial Ends</TableHead>
                <TableHead>Current Period End</TableHead>
                <TableHead>Monthly Price</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions?.map((sub: any) => (
                <TableRow key={sub.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{sub.profiles?.name}</div>
                      <div className="text-sm text-muted-foreground">{sub.profiles?.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(sub.status)}</TableCell>
                  <TableCell>
                    {sub.trial_ends_at
                      ? format(new Date(sub.trial_ends_at), "MMM dd, yyyy")
                      : "N/A"}
                  </TableCell>
                  <TableCell>
                    {sub.current_period_end
                      ? format(new Date(sub.current_period_end), "MMM dd, yyyy")
                      : "N/A"}
                  </TableCell>
                  <TableCell>${Number(sub.monthly_price).toFixed(2)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedPractice(sub.practice_id)}
                          >
                            <CreditCard className="h-4 w-4 mr-1" />
                            Payments
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl">
                          <DialogHeader>
                            <DialogTitle>Payment History</DialogTitle>
                            <DialogDescription>
                              {sub.profiles?.name} - Payment transactions
                            </DialogDescription>
                          </DialogHeader>
                          <div className="max-h-96 overflow-y-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Date</TableHead>
                                  <TableHead>Amount</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Period</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {payments?.map((payment: any) => (
                                  <TableRow key={payment.id}>
                                    <TableCell>
                                      {format(new Date(payment.created_at), "MMM dd, yyyy")}
                                    </TableCell>
                                    <TableCell>${Number(payment.amount).toFixed(2)}</TableCell>
                                    <TableCell>
                                      <Badge
                                        variant={
                                          payment.payment_status === "succeeded"
                                            ? "default"
                                            : "destructive"
                                        }
                                      >
                                        {payment.payment_status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      {payment.period_start && payment.period_end
                                        ? `${format(
                                            new Date(payment.period_start),
                                            "MMM dd"
                                          )} - ${format(
                                            new Date(payment.period_end),
                                            "MMM dd, yyyy"
                                          )}`
                                        : "N/A"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </DialogContent>
                      </Dialog>

                      {sub.status === "active" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => cancelSubscription.mutate(sub.id)}
                          disabled={cancelSubscription.isPending}
                        >
                          {cancelSubscription.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Cancel"
                          )}
                        </Button>
                      )}

                      {(sub.status === "cancelled" || sub.status === "expired") && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => activateSubscription.mutate(sub.id)}
                          disabled={activateSubscription.isPending}
                        >
                          {activateSubscription.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Reactivate"
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
