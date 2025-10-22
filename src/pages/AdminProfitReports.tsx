import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Tag, RefreshCw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const AdminProfitReports = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get profit details with order and product information
  const { data: profitDetails, isLoading } = useQuery({
    queryKey: ["admin-profit-details"],
    staleTime: 60000, // 1 minute
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
          ),
          order_lines:order_line_id (
            product_id,
            products:product_id (name)
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const totalAdminProfit = useMemo(() => 
    profitDetails
      ?.filter(item => item.orders?.status !== 'cancelled')
      .reduce((sum, item) => 
        sum + parseFloat(item.admin_profit?.toString() || '0'), 0
      ) || 0,
    [profitDetails]
  );

  const pendingAdminProfit = useMemo(() => 
    profitDetails
      ?.filter(item => ['pending', 'processing'].includes(item.orders?.status || '') && item.orders?.status !== 'cancelled')
      .reduce((sum, item) => sum + parseFloat(item.admin_profit?.toString() || '0'), 0) || 0,
    [profitDetails]
  );

  const collectedAdminProfit = useMemo(() => 
    profitDetails
      ?.filter(item => ['shipped', 'delivered'].includes(item.orders?.status || '') && item.orders?.status !== 'cancelled')
      .reduce((sum, item) => sum + parseFloat(item.admin_profit?.toString() || '0'), 0) || 0,
    [profitDetails]
  );

  // Channel-specific profit calculations
  const directProfit = useMemo(() => 
    profitDetails
      ?.filter(item => item.orders?.status !== 'cancelled')
      .filter(item => !item.topline_id && !item.downline_id)
      .reduce((sum, item) => sum + parseFloat(item.admin_profit?.toString() || '0'), 0) || 0,
    [profitDetails]
  );

  const toplineOnlyProfit = useMemo(() => 
    profitDetails
      ?.filter(item => item.orders?.status !== 'cancelled')
      .filter(item => item.topline_id && !item.downline_id)
      .reduce((sum, item) => sum + parseFloat(item.admin_profit?.toString() || '0'), 0) || 0,
    [profitDetails]
  );

  const fullNetworkProfit = useMemo(() => 
    profitDetails
      ?.filter(item => item.orders?.status !== 'cancelled')
      .filter(item => item.topline_id && item.downline_id)
      .reduce((sum, item) => sum + parseFloat(item.admin_profit?.toString() || '0'), 0) || 0,
    [profitDetails]
  );

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

  // Recompute profits mutation
  const recomputeProfitsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('recompute_order_profits', {
        p_order_ids: null,
        p_status_filter: ['pending', 'processing']
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-profit-details'] });
      toast({
        title: "Profits recomputed",
        description: data?.[0]?.message || "Successfully recomputed order profits",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error recomputing profits",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Profit Reports</h1>
          <p className="text-muted-foreground mt-2">
            Detailed breakdown of platform earnings
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Recompute Profits
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Recompute Order Profits?</AlertDialogTitle>
              <AlertDialogDescription>
                This will recalculate profits for all pending and processing orders using the current price overrides.
                This is useful after updating rep pricing to ensure accurate profit calculations.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => recomputeProfitsMutation.mutate()}>
                Recompute
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Admin Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalAdminProfit.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">All-time platform earnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Pending Admin Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">${pendingAdminProfit.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Not yet delivered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Collected Admin Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${collectedAdminProfit.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Delivered orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Profit by Channel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Direct:</span>
                <span className="font-semibold">${directProfit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Via Topline:</span>
                <span className="font-semibold">${toplineOnlyProfit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Full Network:</span>
                <span className="font-semibold">${fullNetworkProfit.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Admin Profit History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Practice</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Sales Chain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Admin Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : profitDetails?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No profit data yet
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProfitDetails?.map((profit: any) => (
                  <TableRow key={profit.id}>
                    <TableCell>
                      {profit.created_at ? format(new Date(profit.created_at), "MMM d, yyyy") : "-"}
                    </TableCell>
                    <TableCell>{profit.orders?.profiles?.name || "-"}</TableCell>
                    <TableCell>{profit.order_lines?.products?.name || "-"}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {profit.order_id?.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      {profit.downline_id ? (
                        <Badge variant="default" className="text-xs">
                          Admin → Topline → Downline → Practice
                        </Badge>
                      ) : profit.topline_id ? (
                        <Badge variant="secondary" className="text-xs">
                          Admin → Topline → Practice
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Admin → Practice (Direct)
                        </Badge>
                      )}
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
                      ${parseFloat(profit.admin_profit?.toString() || '0').toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))
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

export default AdminProfitReports;
