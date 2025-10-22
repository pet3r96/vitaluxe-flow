import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Tag } from "lucide-react";

const RepProfitReports = () => {
  const { effectiveRole, effectiveUserId } = useAuth();

  // Get rep ID
  const { data: repData } = useQuery({
    queryKey: ["rep-data", effectiveUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reps")
        .select("*")
        .eq("user_id", effectiveUserId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveUserId,
  });

  // Get profit details
  const { data: profitDetails, isLoading } = useQuery({
    queryKey: ["rep-profit-details", repData?.id, effectiveRole],
    staleTime: 60000, // 1 minute
    queryFn: async () => {
      if (!repData?.id) return [];
      
      let query = supabase
        .from("order_profits")
        .select(`
          *,
          orders:order_id (
            id,
            created_at,
            status,
            doctor_id,
            profiles:doctor_id (name)
          )
        `);
      
      if (effectiveRole === 'topline') {
        query = query.eq("topline_id", repData.id);
      } else {
        query = query.eq("downline_id", repData.id);
      }
      
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!repData?.id,
  });

  const totalProfit = profitDetails
    ?.filter(item => item.orders?.status !== 'cancelled')
    .reduce((sum, item) => {
      const profit = effectiveRole === 'topline' ? item.topline_profit : item.downline_profit;
      return sum + (parseFloat(profit?.toString() || '0'));
    }, 0) || 0;

  const unpaidProfit = profitDetails
    ?.filter(item => item.orders?.status !== 'cancelled')
    ?.filter(item => item.payment_status === 'pending')
    .reduce((sum, item) => {
      const profit = effectiveRole === 'topline' ? item.topline_profit : item.downline_profit;
      return sum + (parseFloat(profit?.toString() || '0'));
    }, 0) || 0;

  const paidProfit = profitDetails
    ?.filter(item => item.orders?.status !== 'cancelled')
    ?.filter(item => item.payment_status === 'completed')
    .reduce((sum, item) => {
      const profit = effectiveRole === 'topline' ? item.topline_profit : item.downline_profit;
      return sum + (parseFloat(profit?.toString() || '0'));
    }, 0) || 0;

  // Topline-specific profit breakdowns
  const directSalesProfit = useMemo(() => {
    if (effectiveRole !== 'topline') return 0;
    return profitDetails
      ?.filter(item => item.orders?.status !== 'cancelled')
      .filter(item => !item.downline_id)
      .reduce((sum, item) => sum + parseFloat(item.topline_profit?.toString() || '0'), 0) || 0;
  }, [profitDetails, effectiveRole]);

  const networkSalesProfit = useMemo(() => {
    if (effectiveRole !== 'topline') return 0;
    return profitDetails
      ?.filter(item => item.orders?.status !== 'cancelled')
      .filter(item => !!item.downline_id)
      .reduce((sum, item) => sum + parseFloat(item.topline_profit?.toString() || '0'), 0) || 0;
  }, [profitDetails, effectiveRole]);

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    hasNextPage,
    hasPrevPage
  } = usePagination({
    totalItems: profitDetails?.length || 0,
    itemsPerPage: 25
  });

  const paginatedProfitDetails = profitDetails?.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Profit Reports</h1>
        <p className="text-muted-foreground mt-2">
          Detailed breakdown of your earnings
        </p>
      </div>

      <div className={`grid gap-4 ${effectiveRole === 'topline' ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Billed Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalProfit.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">All-time earnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Unpaid Profits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">${unpaidProfit.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting payment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Paid Profits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${paidProfit.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Completed payments</p>
          </CardContent>
        </Card>

        {effectiveRole === 'topline' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Sales Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Direct Sales:</span>
                  <span className="font-semibold">${directSalesProfit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Network Sales:</span>
                  <span className="font-semibold">${networkSalesProfit.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profit History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Practice</TableHead>
                <TableHead>Order ID</TableHead>
                {effectiveRole === 'topline' && <TableHead>Sale Type</TableHead>}
                <TableHead>Status</TableHead>
                {effectiveRole === 'topline' && <TableHead>Payment Status</TableHead>}
                <TableHead className="text-right">Your Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : profitDetails?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No profit data yet
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProfitDetails?.map((profit: any) => {
                  const myProfit = effectiveRole === 'topline' ? profit.topline_profit : profit.downline_profit;
                  return (
                    <TableRow key={profit.id}>
                      <TableCell>
                        {profit.created_at ? format(new Date(profit.created_at), "MMM d, yyyy") : "-"}
                      </TableCell>
                      <TableCell>{profit.orders?.profiles?.name || "-"}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {profit.order_id?.slice(0, 8)}...
                      </TableCell>
                      {effectiveRole === 'topline' && (
                        <TableCell>
                          {profit.downline_id ? (
                            <Badge variant="outline" className="text-xs">
                              Via Downline
                            </Badge>
                          ) : (
                            <Badge variant="default" className="text-xs">
                              Direct Sale
                            </Badge>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge variant={
                          profit.orders?.status === 'shipped' || profit.orders?.status === 'delivered' 
                            ? 'default' 
                            : 'secondary'
                        }>
                          {profit.orders?.status || 'unknown'}
                        </Badge>
                      </TableCell>
                      {effectiveRole === 'topline' && (
                        <TableCell>
                          <Badge 
                            variant={profit.payment_status === 'completed' ? 'default' : 'secondary'}
                            className={profit.payment_status === 'completed' ? 'bg-green-600' : 'bg-yellow-600'}
                          >
                            {profit.payment_status === 'completed' ? 'Paid' : 'Pending'}
                          </Badge>
                          {profit.paid_at && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {format(new Date(profit.paid_at), "MMM d, yyyy")}
                            </div>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-right font-medium">
                        ${parseFloat(myProfit?.toString() || '0').toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {profitDetails && profitDetails.length > 0 && (
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          totalItems={profitDetails.length}
          startIndex={startIndex}
          endIndex={Math.min(endIndex, profitDetails.length)}
        />
      )}
    </div>
  );
};

export default RepProfitReports;
