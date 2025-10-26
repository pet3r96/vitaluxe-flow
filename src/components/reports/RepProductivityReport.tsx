import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { RefreshCw, Users, ShoppingCart, DollarSign, Building2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const RepProductivityReport = () => {
  const { effectiveRole, effectiveUserId } = useAuth();
  const [selectedTopline, setSelectedTopline] = useState<string>("all");

  // Fetch productivity data
  const { data: productivityData, isLoading, refetch } = useQuery({
    queryKey: ["rep-productivity"],
    queryFn: async () => {
      // Refresh materialized view first
      await supabase.rpc('refresh_rep_productivity_summary');
      
      const { data, error } = await supabase
        .from("rep_productivity_view")
        .select("*")
        .order("total_commissions", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch topline reps for filter dropdown (admin only)
  const { data: toplineReps } = useQuery({
    queryKey: ["topline-reps-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reps")
        .select(`
          id,
          profiles:user_id (name, email)
        `)
        .eq("role", "topline");
      
      if (error) throw error;
      return data;
    },
    enabled: effectiveRole === 'admin',
  });

  // Filter data based on role and selection
  const filteredData = useMemo(() => {
    if (!productivityData) return [];
    
    // Only show topline reps (remove downlines from view)
    let filtered = productivityData.filter(r => r.role === 'topline');
    
    // Topline users see only themselves
    if (effectiveRole === 'topline') {
      filtered = filtered.filter(r => r.user_id === effectiveUserId);
    }
    
    // Admin can filter by specific topline
    if (effectiveRole === 'admin' && selectedTopline !== "all") {
      filtered = filtered.filter(r => r.rep_id === selectedTopline);
    }
    
    return filtered;
  }, [productivityData, effectiveRole, effectiveUserId, selectedTopline]);

  // Calculate summary totals
  const summaryTotals = useMemo(() => {
    if (!filteredData) return { practices: 0, orders: 0, commissions: 0, revenue: 0, reps: 0 };
    
    return {
      practices: filteredData.reduce((sum, r) => sum + (r.practice_count || 0), 0),
      orders: filteredData.reduce((sum, r) => sum + (r.total_orders || 0), 0),
      commissions: filteredData.reduce((sum, r) => sum + parseFloat(r.total_commissions?.toString() || '0'), 0),
      revenue: filteredData.reduce((sum, r) => sum + parseFloat(r.total_revenue?.toString() || '0'), 0),
      reps: filteredData.length,
    };
  }, [filteredData]);

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    hasNextPage,
    hasPrevPage
  } = usePagination({
    totalItems: filteredData?.length || 0,
    itemsPerPage: 25
  });

  const paginatedData = filteredData?.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Rep Productivity</h1>
          <p className="text-muted-foreground mt-2">Performance metrics for sales representatives</p>
        </div>
        <div className="flex items-center gap-3">
          {effectiveRole === 'admin' && toplineReps && (
            <Select value={selectedTopline} onValueChange={setSelectedTopline}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Filter by Topline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Toplines</SelectItem>
                {toplineReps.map((rep: any) => (
                  <SelectItem key={rep.id} value={rep.id}>
                    {rep.profiles?.name || rep.profiles?.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Active Reps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryTotals.reps}</div>
            <p className="text-xs text-muted-foreground mt-1">Topline representatives</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Total Practices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryTotals.practices}</div>
            <p className="text-xs text-muted-foreground mt-1">Linked practices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Total Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryTotals.orders}</div>
            <p className="text-xs text-muted-foreground mt-1">All-time orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summaryTotals.revenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total markup from base</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Commissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summaryTotals.commissions.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Earned commissions</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rep Performance Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rep Name</TableHead>
                <TableHead className="text-center">Practices</TableHead>
                <TableHead className="text-center">Downlines</TableHead>
                <TableHead className="text-center">Non-Rx Orders</TableHead>
                <TableHead className="text-center">Rx Orders</TableHead>
                <TableHead className="text-center">Total Orders</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Commissions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : paginatedData?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No productivity data available
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData?.map((rep: any) => (
                  <TableRow key={rep.rep_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{rep.rep_name}</p>
                        <p className="text-xs text-muted-foreground">{rep.rep_email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{rep.practice_count || 0}</TableCell>
                    <TableCell className="text-center">{rep.downline_count || 0}</TableCell>
                    <TableCell className="text-center">{rep.non_rx_orders || 0}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span>{rep.rx_orders || 0}</span>
                        {rep.rx_orders > 0 && (
                          <Badge variant="outline" className="text-xs">$0</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium">{rep.total_orders || 0}</TableCell>
                    <TableCell className="text-right font-medium">
                      ${parseFloat(rep.total_revenue?.toString() || '0').toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${parseFloat(rep.total_commissions?.toString() || '0').toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

        {filteredData && filteredData.length > 0 && (
          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
            hasNextPage={hasNextPage}
            hasPrevPage={hasPrevPage}
            totalItems={filteredData.length}
            startIndex={startIndex}
            endIndex={Math.min(endIndex, filteredData.length)}
          />
        )}
    </div>
  );
};

export default RepProductivityReport;
