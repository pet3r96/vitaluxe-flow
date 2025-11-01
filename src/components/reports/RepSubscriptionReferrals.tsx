import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Clock, CheckCircle2, XCircle } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { format } from "date-fns";

export default function RepSubscriptionReferrals() {
  const { effectiveUserId, effectiveRole } = useAuth();
  
  // Get rep data
  const { data: repData } = useQuery({
    queryKey: ["rep", effectiveUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reps")
        .select("*")
        .eq("user_id", effectiveUserId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveUserId && (effectiveRole === "topline" || effectiveRole === "downline"),
  });

  // Get subscription commissions
  const { data: commissions, isLoading } = useQuery({
    queryKey: ["rep-subscription-commissions", repData?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rep_subscription_commissions")
        .select(`
          *,
          profiles!practice_id(
            id,
            full_name,
            email
          ),
          practice_subscriptions!subscription_id(
            status,
            monthly_price
          ),
          subscription_payments!payment_id(
            payment_status,
            transaction_id
          )
        `)
        .eq("rep_id", repData.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!repData?.id,
  });

  // Calculate totals
  const totalEarned = commissions?.reduce((sum, c) => sum + (c.commission_amount || 0), 0) || 0;
  const pendingAmount = commissions?.filter(c => c.payment_status === 'pending')
    .reduce((sum, c) => sum + (c.commission_amount || 0), 0) || 0;
  const paidAmount = commissions?.filter(c => c.payment_status === 'paid')
    .reduce((sum, c) => sum + (c.commission_amount || 0), 0) || 0;

  const pagination = usePagination({ totalItems: commissions?.length || 0, itemsPerPage: 10 });
  
  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { variant: "secondary" as const, icon: Clock, label: "Pending" },
      paid: { variant: "default" as const, icon: CheckCircle2, label: "Paid" },
      cancelled: { variant: "destructive" as const, icon: XCircle, label: "Cancelled" },
    };
    
    const config = variants[status as keyof typeof variants] || variants.pending;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const filterCommissions = (status?: string) => {
    if (!commissions) return [];
    if (!status || status === 'all') return commissions;
    return commissions.filter(c => c.payment_status === status);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalEarned.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              All subscription referrals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${pendingAmount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting payout
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Out</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${paidAmount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Successfully paid
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>

        {['all', 'pending', 'paid', 'cancelled'].map(status => (
          <TabsContent key={status} value={status}>
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Practice</TableHead>
                      <TableHead>Subscription Status</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment Status</TableHead>
                      <TableHead>Paid Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterCommissions(status).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No commissions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filterCommissions(status)
                        .slice(
                          pagination.startIndex,
                          pagination.endIndex
                        )
                        .map((commission) => (
                          <TableRow key={commission.id}>
                          <TableCell>
                            {format(new Date(commission.created_at), "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {commission.profiles?.full_name || 'N/A'}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {commission.profiles?.email}
                              </div>
                            </div>
                          </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {commission.practice_subscriptions?.status || 'N/A'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              ${(commission.commission_amount || 0).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(commission.payment_status || 'pending')}
                            </TableCell>
                            <TableCell>
                              {commission.paid_at 
                                ? format(new Date(commission.paid_at), "MMM dd, yyyy")
                                : '-'
                              }
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
                <DataTablePagination
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  onPageChange={pagination.goToPage}
                  hasNextPage={pagination.hasNextPage}
                  hasPrevPage={pagination.hasPrevPage}
                  totalItems={filterCommissions(status).length}
                  startIndex={pagination.startIndex}
                  endIndex={Math.min(pagination.endIndex, filterCommissions(status).length)}
                />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
