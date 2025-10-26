import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { AlertCircle, TrendingUp } from "lucide-react";

const DownlinePerformanceView = () => {
  const { effectiveRole, effectiveUserId } = useAuth();

  // Fetch current topline rep's ID
  const { data: currentRep } = useQuery({
    queryKey: ["current-rep", effectiveUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reps")
        .select("id")
        .eq("user_id", effectiveUserId)
        .eq("role", "topline")
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: effectiveRole === 'topline',
  });

  // Fetch downlines productivity data
  const { data: downlinesData, isLoading } = useQuery({
    queryKey: ["downlines-productivity", currentRep?.id],
    queryFn: async () => {
      if (!currentRep?.id) return [];
      
      // Refresh materialized view first
      await supabase.rpc('refresh_rep_productivity_summary');
      
      const { data, error } = await supabase
        .from("rep_productivity_view")
        .select("*")
        .eq("assigned_topline_id", currentRep.id)
        .order("total_commissions", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentRep?.id,
  });

  // Calculate activity status
  const downlinesWithStatus = useMemo(() => {
    if (!downlinesData) return [];
    
    return downlinesData.map(downline => {
      const orders = downline.total_orders || 0;
      let status = 'inactive';
      let statusVariant: 'default' | 'secondary' | 'destructive' = 'destructive';
      
      if (orders > 10) {
        status = 'active';
        statusVariant = 'default';
      } else if (orders > 0) {
        status = 'moderate';
        statusVariant = 'secondary';
      }
      
      return {
        ...downline,
        activityStatus: status,
        statusVariant,
      };
    });
  }, [downlinesData]);

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    hasNextPage,
    hasPrevPage
  } = usePagination({
    totalItems: downlinesWithStatus?.length || 0,
    itemsPerPage: 25
  });

  const paginatedData = downlinesWithStatus?.slice(startIndex, endIndex);

  // Access control: Only topline reps can view this
  if (effectiveRole !== 'topline') {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This page is only accessible to Topline Representatives.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-8 w-8" />
            My Downlines Performance
          </h1>
          <p className="text-muted-foreground mt-2">
            Track your downline representatives' activity and performance
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Downline Activity Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rep Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-center">Practices</TableHead>
                <TableHead className="text-center">Non-Rx Orders</TableHead>
                <TableHead className="text-center">Rx Orders</TableHead>
                <TableHead className="text-center">Total Orders</TableHead>
                <TableHead className="text-right">Commissions</TableHead>
                <TableHead className="text-center">Status</TableHead>
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
                    No downlines assigned yet
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData?.map((downline: any) => (
                  <TableRow key={downline.rep_id}>
                    <TableCell className="font-medium">{downline.rep_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{downline.rep_email}</TableCell>
                    <TableCell className="text-center">{downline.practice_count || 0}</TableCell>
                    <TableCell className="text-center">{downline.non_rx_orders || 0}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span>{downline.rx_orders || 0}</span>
                        {downline.rx_orders > 0 && (
                          <Badge variant="outline" className="text-xs">$0</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium">{downline.total_orders || 0}</TableCell>
                    <TableCell className="text-right font-medium">
                      ${parseFloat(downline.total_commissions?.toString() || '0').toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={downline.statusVariant}>
                        {downline.activityStatus === 'active' && 'Active (>10 orders)'}
                        {downline.activityStatus === 'moderate' && 'Moderate (1-10)'}
                        {downline.activityStatus === 'inactive' && 'Inactive (0 orders)'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {downlinesWithStatus && downlinesWithStatus.length > 0 && (
        <>
          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
            hasNextPage={hasNextPage}
            hasPrevPage={hasPrevPage}
            totalItems={downlinesWithStatus.length}
            startIndex={startIndex}
            endIndex={Math.min(endIndex, downlinesWithStatus.length)}
          />
          
          <Alert>
            <AlertDescription className="text-sm">
              <strong>Activity Levels:</strong> Active = &gt;10 orders | Moderate = 1-10 orders | Inactive = 0 orders
              <br />
              * Rx orders show $0 commission due to federal anti-kickback regulations.
            </AlertDescription>
          </Alert>
        </>
      )}
    </div>
  );
};

export default DownlinePerformanceView;
