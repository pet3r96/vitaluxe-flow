import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { DollarSign, TrendingUp, Users } from "lucide-react";
import { usePagePerformance } from "@/hooks/usePagePerformance";

const AdminProfitReports = () => {
  usePagePerformance('AdminProfitReports');

  const { data: profits, isLoading } = useQuery({
    queryKey: ["admin-profit-reports"],
    staleTime: 60000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_profits")
        .select(`
          id,
          order_id,
          order_total,
          admin_profit,
          topline_profit,
          downline_profit,
          payment_status,
          created_at,
          topline_id,
          downline_id
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return data;
    },
  });

  const totalRevenue = profits?.reduce((sum, p) => sum + (p.order_total || 0), 0) || 0;
  const totalAdminProfit = profits?.reduce((sum, p) => sum + (p.admin_profit || 0), 0) || 0;
  const totalRepPayouts = profits?.reduce((sum, p) => sum + (p.topline_profit || 0) + (p.downline_profit || 0), 0) || 0;

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    hasNextPage,
    hasPrevPage,
  } = usePagination({
    totalItems: profits?.length || 0,
    itemsPerPage: 25,
  });

  const paginatedProfits = profits?.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">From {profits?.length || 0} orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admin Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(totalAdminProfit)}</div>
            <p className="text-xs text-muted-foreground">Net after rep payouts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rep Payouts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(totalRepPayouts)}</div>
            <p className="text-xs text-muted-foreground">Topline + Downline commissions</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order Profit Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead className="text-right">Order Total</TableHead>
                <TableHead className="text-right">Admin Profit</TableHead>
                <TableHead className="text-right">Topline</TableHead>
                <TableHead className="text-right">Downline</TableHead>
                <TableHead>Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Loading profit data...
                  </TableCell>
                </TableRow>
              ) : !paginatedProfits || paginatedProfits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No profit data found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProfits.map((profit) => (
                  <TableRow key={profit.id}>
                    <TableCell>
                      {format(new Date(profit.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {profit.order_id.substring(0, 8)}...
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(profit.order_total)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-foreground">
                      {formatCurrency(profit.admin_profit || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(profit.topline_profit || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(profit.downline_profit || 0)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={profit.payment_status === 'paid' ? 'default' : 'outline'}>
                        {profit.payment_status || 'pending'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {profits && profits.length > 0 && (
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          totalItems={profits.length}
          startIndex={startIndex}
          endIndex={Math.min(endIndex, profits.length)}
        />
      )}
    </div>
  );
};

export default AdminProfitReports;
