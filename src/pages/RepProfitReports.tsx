import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Tag } from "lucide-react";

const RepProfitReports = () => {
  const { effectiveRole, effectiveUserId } = useAuth();
  const [rxFilter, setRxFilter] = useState<"all" | "non-rx" | "rx-only">("all");

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

  // Get profit details with order information, including Rx flag
  const { data: profitDetails, isLoading } = useQuery({
    queryKey: ["rep-profit-details", repData?.id, effectiveRole],
    enabled: !!repData?.id && !!effectiveRole,
    staleTime: 60000,
    queryFn: async () => {
      const { data, error } = await supabase
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
        `)
        .or(
          effectiveRole === 'topline'
            ? `topline_id.eq.${repData.id}`
            : `downline_id.eq.${repData.id}`
        )
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Filter profit details based on Rx status
  const filteredProfitDetails = useMemo(() => {
    if (!profitDetails) return [];
    
    if (rxFilter === "non-rx") {
      return profitDetails.filter(item => !item.is_rx_required);
    } else if (rxFilter === "rx-only") {
      return profitDetails.filter(item => item.is_rx_required);
    }
    return profitDetails;
  }, [profitDetails, rxFilter]);

  const totalProfit = useMemo(() => 
    filteredProfitDetails
      ?.filter(item => item.orders?.status !== 'cancelled')
      .reduce((sum, item) => {
        const profit = effectiveRole === 'topline' ? item.topline_profit : item.downline_profit;
        return sum + (parseFloat(profit?.toString() || '0'));
      }, 0) || 0,
    [filteredProfitDetails, effectiveRole]
  );

  const unpaidProfit = useMemo(() => 
    filteredProfitDetails
      ?.filter(item => item.payment_status !== 'completed' && item.orders?.status !== 'cancelled')
      .reduce((sum, item) => {
        const profit = effectiveRole === 'topline' ? item.topline_profit : item.downline_profit;
        return sum + parseFloat(profit?.toString() || '0');
      }, 0) || 0,
    [filteredProfitDetails, effectiveRole]
  );

  const paidProfit = useMemo(() => 
    filteredProfitDetails
      ?.filter(item => item.payment_status === 'completed' && item.orders?.status !== 'cancelled')
      .reduce((sum, item) => {
        const profit = effectiveRole === 'topline' ? item.topline_profit : item.downline_profit;
        return sum + parseFloat(profit?.toString() || '0');
      }, 0) || 0,
    [filteredProfitDetails, effectiveRole]
  );

  const directSalesProfit = useMemo(() => {
    if (effectiveRole !== 'topline') return 0;
    return filteredProfitDetails
      ?.filter(item => item.orders?.status !== 'cancelled')
      .filter(item => !item.downline_id)
      .reduce((sum, item) => sum + parseFloat(item.topline_profit?.toString() || '0'), 0) || 0;
  }, [filteredProfitDetails, effectiveRole]);

  const networkSalesProfit = useMemo(() => {
    if (effectiveRole !== 'topline') return 0;
    return filteredProfitDetails
      ?.filter(item => item.orders?.status !== 'cancelled')
      .filter(item => item.downline_id)
      .reduce((sum, item) => sum + parseFloat(item.topline_profit?.toString() || '0'), 0) || 0;
  }, [filteredProfitDetails, effectiveRole]);

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    hasNextPage,
    hasPrevPage
  } = usePagination({
    totalItems: filteredProfitDetails?.length || 0,
    itemsPerPage: 25
  });

  const paginatedProfitDetails = filteredProfitDetails?.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Profit Reports</h1>
          <p className="text-muted-foreground mt-2">Detailed breakdown of your earnings</p>
        </div>
        
        <Select value={rxFilter} onValueChange={(value: any) => setRxFilter(value)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orders</SelectItem>
            <SelectItem value="non-rx">Non-Rx Only</SelectItem>
            <SelectItem value="rx-only">Rx-Required Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Billed Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalProfit.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {rxFilter === "rx-only" 
                ? "Rx orders (no commission)"
                : rxFilter === "non-rx"
                ? "Non-Rx commissions only"
                : "All-time earnings"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Unpaid Commission</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">${unpaidProfit.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Pending payment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Paid Commission</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${paidProfit.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Received</p>
          </CardContent>
        </Card>
      </div>

      {effectiveRole === 'topline' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Sales Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Direct Sales (No Downline)</p>
                <p className="text-2xl font-bold">${directSalesProfit.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Network Sales (Via Downline)</p>
                <p className="text-2xl font-bold">${networkSalesProfit.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Commission History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Order #</TableHead>
                <TableHead>Practice</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payment Status</TableHead>
                <TableHead>Order Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : paginatedProfitDetails?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No commission data yet
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProfitDetails?.map((profit: any) => {
                  const profitAmount = effectiveRole === 'topline' ? profit.topline_profit : profit.downline_profit;
                  return (
                    <TableRow key={profit.id}>
                      <TableCell>{format(new Date(profit.created_at), "MMM dd, yyyy")}</TableCell>
                      <TableCell className="font-mono text-sm">#{profit.orders?.id}</TableCell>
                      <TableCell>{profit.orders?.profiles?.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>${parseFloat(profitAmount?.toString() || '0').toFixed(2)}</span>
                          {profit.is_rx_required && (
                            <Badge variant="outline" className="text-xs">Rx - No Commission</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={profit.payment_status === 'completed' ? 'default' : 'secondary'}>
                          {profit.payment_status === 'completed' ? 'Paid' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          profit.orders?.status === 'delivered' ? 'default' :
                          profit.orders?.status === 'shipped' ? 'secondary' :
                          profit.orders?.status === 'cancelled' ? 'destructive' : 'outline'
                        }>
                          {profit.orders?.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {filteredProfitDetails && filteredProfitDetails.length > 0 && (
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          totalItems={filteredProfitDetails.length}
          startIndex={startIndex}
          endIndex={Math.min(endIndex, filteredProfitDetails.length)}
        />
      )}
    </div>
  );
};

export default RepProfitReports;
