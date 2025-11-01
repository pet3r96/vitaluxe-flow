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
import { DollarSign, TrendingUp, Clock } from "lucide-react";
import { useMemo, useState } from "react";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RepSubscriptionReferrals from "@/components/reports/RepSubscriptionReferrals";

const RepProfitReports = () => {
  const { effectiveRole, effectiveUserId } = useAuth();
  const [earningFilter, setEarningFilter] = useState<"all" | "commission" | "practice_dev_fee">("all");

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

  // Get unified earnings (commissions + practice dev fees)
  const { data: earningsData } = useQuery({
    queryKey: ["rep-earnings", repData?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_rep_earnings', { _rep_id: repData.id });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!repData?.id,
  });

  // Filter earnings
  const filteredEarnings = useMemo(() => {
    if (!earningsData) return [];
    
    if (earningFilter === "all") return earningsData;
    if (earningFilter === "commission") {
      return earningsData.filter(e => e.earning_type === 'product_commission');
    }
    return earningsData.filter(e => e.earning_type === earningFilter);
  }, [earningsData, earningFilter]);

  // Calculate totals
  const totalEarnings = useMemo(() => 
    earningsData
      ?.filter(item => item.order_status !== 'cancelled')
      .reduce((sum, item) => sum + parseFloat(item.amount?.toString() || '0'), 0) || 0,
    [earningsData]
  );

  const unpaidEarnings = useMemo(() => 
    earningsData
      ?.filter(item => 
        !item.paid_at && 
        item.order_status !== 'cancelled'
      )
      .reduce((sum, item) => sum + parseFloat(item.amount?.toString() || '0'), 0) || 0,
    [earningsData]
  );

  const paidEarnings = useMemo(() => 
    earningsData
      ?.filter(item => 
        item.paid_at &&
        item.order_status !== 'cancelled'
      )
      .reduce((sum, item) => sum + parseFloat(item.amount?.toString() || '0'), 0) || 0,
    [earningsData]
  );

  // Topline breakdown
  const directSalesEarnings = useMemo(() => {
    if (effectiveRole !== 'topline') return 0;
    return earningsData
      ?.filter(item => item.order_status !== 'cancelled')
      ?.filter(item => item.earning_type === 'product_commission')
      .reduce((sum, item) => sum + parseFloat(item.amount?.toString() || '0'), 0) || 0;
  }, [earningsData, effectiveRole]);

  const practiceDevFees = useMemo(() => {
    if (effectiveRole !== 'topline') return 0;
    return earningsData
      ?.filter(item => item.earning_type === 'practice_dev_fee')
      .reduce((sum, item) => sum + parseFloat(item.amount?.toString() || '0'), 0) || 0;
  }, [earningsData, effectiveRole]);

  const pagination = usePagination({
    totalItems: filteredEarnings?.length || 0,
    itemsPerPage: 10
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold gold-text-gradient">Profit Reports</h1>
        <p className="text-muted-foreground mt-2">
          Track your earnings and commissions
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalEarnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              All time earnings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unpaid</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${unpaidEarnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting collection
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${paidEarnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Successfully collected
            </p>
          </CardContent>
        </Card>
      </div>

      {effectiveRole === 'topline' && (
        <Card>
          <CardHeader>
            <CardTitle>Earnings Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Direct Sales Commissions</p>
                <p className="text-2xl font-bold">${directSalesEarnings.toFixed(2)}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Practice Development Fees</p>
                <p className="text-2xl font-bold">${practiceDevFees.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="product-sales" className="w-full">
        <TabsList>
          <TabsTrigger value="product-sales">Product Sales</TabsTrigger>
          <TabsTrigger value="subscription-referrals">Pro Subscription Referrals</TabsTrigger>
        </TabsList>

        <TabsContent value="product-sales">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Product Sales Earnings</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant={earningFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEarningFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    variant={earningFilter === "commission" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEarningFilter("commission")}
                  >
                    Commissions
                  </Button>
                  {effectiveRole === 'topline' && (
                    <Button
                      variant={earningFilter === "practice_dev_fee" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setEarningFilter("practice_dev_fee")}
                    >
                      Dev Fees
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment Status</TableHead>
                    <TableHead>Order Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEarnings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No product sales earnings found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEarnings
                      .slice(pagination.startIndex, pagination.endIndex)
                      .map((earning) => (
                        <TableRow key={`${earning.id}-${earning.earning_type}`}>
                          <TableCell>
                            {format(new Date(earning.created_at), "MMM dd, yyyy")}
                          </TableCell>
                           <TableCell>
                             <Badge variant={
                               earning.earning_type === 'practice_dev_fee' 
                                 ? 'secondary' 
                                 : earning.is_rx_required 
                                   ? 'outline' 
                                   : 'default'
                             }>
                               {earning.earning_type === 'practice_dev_fee' 
                                 ? 'Dev Fee' 
                                 : earning.is_rx_required 
                                   ? 'N/A' 
                                   : 'Commission'}
                             </Badge>
                           </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">{earning.reference_number}</div>
                              <div className="text-sm text-muted-foreground">
                                {earning.practice_name}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            ${parseFloat(earning.amount?.toString() || '0').toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={earning.paid_at ? 'default' : 'secondary'}>
                              {earning.paid_at ? 'Paid' : 'Unpaid'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {earning.order_status}
                            </Badge>
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
                totalItems={filteredEarnings.length}
                startIndex={pagination.startIndex}
                endIndex={Math.min(pagination.endIndex, filteredEarnings.length)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscription-referrals">
          <RepSubscriptionReferrals />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RepProfitReports;
