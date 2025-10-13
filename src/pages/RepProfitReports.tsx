import { useQuery } from "@tanstack/react-query";
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

  const totalProfit = profitDetails?.reduce((sum, item) => {
    const profit = effectiveRole === 'topline' ? item.topline_profit : item.downline_profit;
    return sum + (parseFloat(profit?.toString() || '0'));
  }, 0) || 0;

  const pendingProfit = profitDetails?.filter(item => item.orders?.status === 'pending' || item.orders?.status === 'processing')
    .reduce((sum, item) => {
      const profit = effectiveRole === 'topline' ? item.topline_profit : item.downline_profit;
      return sum + (parseFloat(profit?.toString() || '0'));
    }, 0) || 0;

  const collectedProfit = profitDetails?.filter(item => item.orders?.status === 'shipped' || item.orders?.status === 'delivered')
    .reduce((sum, item) => {
      const profit = effectiveRole === 'topline' ? item.topline_profit : item.downline_profit;
      return sum + (parseFloat(profit?.toString() || '0'));
    }, 0) || 0;

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

      <div className="grid gap-4 md:grid-cols-3">
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
            <CardTitle className="text-sm font-medium">Pending Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">${pendingProfit.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Not yet delivered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Collected Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${collectedProfit.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Delivered orders</p>
          </CardContent>
        </Card>
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
                <TableHead>Discount</TableHead>
                <TableHead>Status</TableHead>
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
                      <TableCell>
                        <Badge variant={
                          profit.orders?.status === 'shipped' || profit.orders?.status === 'delivered' 
                            ? 'default' 
                            : 'secondary'
                        }>
                          {profit.orders?.status || 'unknown'}
                        </Badge>
                      </TableCell>
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
