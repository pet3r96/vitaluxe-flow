import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Tag, RefreshCw, Copy } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePagePerformance } from "@/hooks/usePagePerformance";
import { useResponsive } from "@/hooks/useResponsive";
import { MobileDataTable, MobileTableRowProps } from "@/components/responsive/MobileDataTable";
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
  usePagePerformance('AdminProfitReports');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isMobile } = useResponsive();
  const [rxFilter, setRxFilter] = useState<"all" | "non-rx" | "rx-only">("all");

  // JUSTIFIED: Complex Supabase query with nested relations causes TypeScript inference issues
  const { data: profitDetails, isLoading } = useQuery({
    queryKey: ["admin-profit-details", rxFilter],
    staleTime: 60000,
    queryFn: async () => {
      // Get product commissions only
      const { data: commissions, error: commError } = await supabase
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
        .order("created_at", { ascending: false });
      
      if (commError) throw commError;
      
      return commissions || [];
    },
  });

  // Filter data based on Rx selection
  const filteredProfitDetails = useMemo(() => {
    if (!profitDetails) return [];
    
    if (rxFilter === "non-rx") {
      return profitDetails.filter((item: any) => !item.is_rx_required);
    } else if (rxFilter === "rx-only") {
      return profitDetails.filter((item: any) => item.is_rx_required);
    }
    return profitDetails;
  }, [profitDetails, rxFilter]);

  const totalAdminProfit = useMemo(() => 
    filteredProfitDetails
      ?.filter((item: any) => item.orders?.status !== 'cancelled')
      .reduce((sum: number, item: any) => 
        sum + parseFloat(item.admin_profit?.toString() || '0'), 0
      ) || 0,
    [filteredProfitDetails]
  );

  const pendingAdminProfit = useMemo(() => 
    filteredProfitDetails
      ?.filter((item: any) => ['pending', 'processing'].includes(item.orders?.status || '') && item.orders?.status !== 'cancelled')
      .reduce((sum: number, item: any) => sum + parseFloat(item.admin_profit?.toString() || '0'), 0) || 0,
    [filteredProfitDetails]
  );

  const collectedAdminProfit = useMemo(() => 
    filteredProfitDetails
      ?.filter((item: any) => ['shipped', 'delivered'].includes(item.orders?.status || '') && item.orders?.status !== 'cancelled')
      .reduce((sum: number, item: any) => sum + parseFloat(item.admin_profit?.toString() || '0'), 0) || 0,
    [filteredProfitDetails]
  );

  // Channel-specific profit calculations
  // JUSTIFIED: Complex Supabase query with multiple joins - admin_profit and orders.status fields
  const directProfit = useMemo(() => 
    filteredProfitDetails
      ?.filter((item: any) => item.orders?.status !== 'cancelled')
      .filter((item: any) => !item.topline_id && !item.downline_id)
      .reduce((sum: number, item: any) => sum + parseFloat(item.admin_profit?.toString() || '0'), 0) || 0,
    [filteredProfitDetails]
  );

  const toplineOnlyProfit = useMemo(() => 
    filteredProfitDetails
      ?.filter((item: any) => item.orders?.status !== 'cancelled')
      .filter((item: any) => item.topline_id && !item.downline_id)
      .reduce((sum: number, item: any) => sum + parseFloat(item.admin_profit?.toString() || '0'), 0) || 0,
    [filteredProfitDetails]
  );

  const fullNetworkProfit = useMemo(() => 
    filteredProfitDetails
      ?.filter((item: any) => item.orders?.status !== 'cancelled')
      .filter((item: any) => item.topline_id && item.downline_id)
      .reduce((sum: number, item: any) => sum + parseFloat(item.admin_profit?.toString() || '0'), 0) || 0,
    [filteredProfitDetails]
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
    totalItems: filteredProfitDetails?.length || 0,
    itemsPerPage: 25
  });

  const paginatedProfitDetails = filteredProfitDetails?.slice(startIndex, endIndex);

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

  // Helper to get sales chain label
  const getSalesChainLabel = (profit: any) => {
    if (profit.downline_id) return "Full Network";
    if (profit.topline_id) return "Via Topline";
    return "Direct";
  };

  const getSalesChainVariant = (profit: any): "default" | "secondary" | "outline" => {
    if (profit.downline_id) return "default";
    if (profit.topline_id) return "secondary";
    return "outline";
  };

  // Mobile rows data
  const mobileRows: MobileTableRowProps[] = useMemo(() => {
    return paginatedProfitDetails?.map((profit: any) => ({
      title: profit.orders?.profiles?.name || "Unknown Practice",
      subtitle: profit.created_at ? format(new Date(profit.created_at), "MMM d, yyyy") : "-",
      fields: [
        { 
          label: "Order ID", 
          value: profit.order_id?.slice(0, 8) + "..." 
        },
        { 
          label: "Status", 
          value: profit.orders?.status || "unknown", 
          badge: true,
          badgeVariant: (profit.orders?.status === 'shipped' || profit.orders?.status === 'delivered') ? 'default' : 'secondary'
        },
        { 
          label: "Chain", 
          value: getSalesChainLabel(profit), 
          badge: true,
          badgeVariant: getSalesChainVariant(profit)
        },
        { 
          label: "Profit", 
          value: formatCurrency(parseFloat(profit.admin_profit?.toString() || '0'))
        },
      ],
      actions: [
        {
          label: "Copy Order ID",
          onClick: () => {
            navigator.clipboard.writeText(profit.order_id);
            toast({ title: "Copied!", description: "Order ID copied to clipboard" });
          }
        }
      ]
    })) || [];
  }, [paginatedProfitDetails, toast]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Profit Reports</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
            Detailed breakdown of platform earnings
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <Select value={rxFilter} onValueChange={(value: any) => setRxFilter(value)}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter by order type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orders</SelectItem>
              <SelectItem value="non-rx">Non-Rx Only</SelectItem>
              <SelectItem value="rx-only">Rx-Required Only</SelectItem>
            </SelectContent>
          </Select>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <RefreshCw className="h-4 w-4 mr-2" />
                Recompute Profits
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[95vw] sm:max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>Recompute Order Profits?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will recalculate profits for all pending and processing orders using the current price overrides.
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
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Admin Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalAdminProfit)}</div>
            <p className="text-xs text-muted-foreground mt-1">All-time platform earnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Pending Admin Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(pendingAdminProfit)}</div>
            <p className="text-xs text-muted-foreground mt-1">Not yet delivered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Collected Admin Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(collectedAdminProfit)}</div>
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
                <span className="font-semibold">{formatCurrency(directProfit)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Via Topline:</span>
                <span className="font-semibold">{formatCurrency(toplineOnlyProfit)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Full Network:</span>
                <span className="font-semibold">{formatCurrency(fullNetworkProfit)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 sm:pb-6">
          <CardTitle className="text-lg sm:text-xl">Admin Profit History</CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          {isMobile ? (
            isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <MobileDataTable rows={mobileRows} emptyMessage="No profit data yet" />
            )
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[100px]">Date</TableHead>
                    <TableHead className="min-w-[140px]">Practice</TableHead>
                    <TableHead className="min-w-[120px]">Order ID</TableHead>
                    <TableHead className="min-w-[110px]">Sales Chain</TableHead>
                    <TableHead className="min-w-[90px]">Status</TableHead>
                    <TableHead className="min-w-[80px]">Source</TableHead>
                    <TableHead className="text-right min-w-[100px]">Admin Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : filteredProfitDetails?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No profit data yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedProfitDetails?.map((profit: any) => (
                      <TableRow key={profit.id}>
                        <TableCell className="whitespace-nowrap">
                          {profit.created_at ? format(new Date(profit.created_at), "MMM d, yyyy") : "-"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{profit.orders?.profiles?.name || "-"}</TableCell>
                        <TableCell className="font-mono text-sm min-w-[120px]">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(profit.order_id);
                                    toast({
                                      title: "Copied!",
                                      description: "Order ID copied to clipboard",
                                    });
                                  }}
                                  className="inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                                >
                                  {profit.order_id?.slice(0, 8)}...
                                  <Copy className="h-3 w-3 opacity-50 hover:opacity-100" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-mono">{profit.order_id}</p>
                                <p className="text-xs text-muted-foreground mt-1">Click to copy</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={getSalesChainVariant(profit)} 
                            className="text-xs whitespace-nowrap"
                          >
                            {getSalesChainLabel(profit)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              profit.orders?.status === 'shipped' || profit.orders?.status === 'delivered' 
                                ? 'default' 
                                : 'secondary'
                            }
                            className="whitespace-nowrap"
                          >
                            {profit.orders?.status || 'unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={profit.is_rx_required ? "outline" : "secondary"} 
                            className="text-xs whitespace-nowrap"
                          >
                            {profit.is_rx_required ? "Rx" : "Non-Rx"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-medium whitespace-nowrap">
                            {formatCurrency(parseFloat(profit.admin_profit?.toString() || '0'))}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
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

export default AdminProfitReports;
