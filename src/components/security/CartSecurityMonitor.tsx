import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { usePagination } from "@/hooks/usePagination";
import { ShoppingCart, AlertTriangle, Clock, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const CartSecurityMonitor = () => {
  const { data: cartStats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["cart-security-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cart_lines")
        .select("id, expires_at, created_at, patient_name, prescription_url, patient_email, patient_phone, patient_address")
        .not("prescription_url", "is", null);

      if (error) throw error;

      const now = new Date();
      const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

      const oldCartLines = data?.filter(line => {
        const expiresAt = line.expires_at ? new Date(line.expires_at) : null;
        return expiresAt && expiresAt > now && expiresAt <= fiveDaysFromNow;
      }) || [];

      const expiredCount = data?.filter(line => {
        const expiresAt = line.expires_at ? new Date(line.expires_at) : null;
        return expiresAt && expiresAt <= now;
      }).length || 0;

      return {
        totalWithPHI: data?.length || 0,
        expiringIn5Days: oldCartLines.length,
        expired: expiredCount,
        oldCartLines,
      };
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: recentAccess, isLoading: accessLoading } = useQuery({
    queryKey: ["cart-phi-access-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("action_type", "cart_phi_accessed")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
  });

  const { 
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    nextPage,
    prevPage,
    hasNextPage,
    hasPrevPage
  } = usePagination({
    totalItems: recentAccess?.length || 0,
    itemsPerPage: 10,
  });

  const paginatedAccess = recentAccess?.slice(startIndex, endIndex) || [];

  const handleCleanupExpired = async () => {
    try {
      const { data, error } = await supabase.rpc("cleanup_expired_cart_lines");
      
      if (error) throw error;
      
      toast.success(`Cleaned up ${data} expired cart lines`);
      refetchStats();
    } catch (error: any) {
      toast.error("Failed to cleanup expired cart lines: " + error.message);
    }
  };

  if (statsLoading || accessLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Loading cart security data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Cart Lines with PHI
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cartStats?.totalWithPHI || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active cart lines containing patient health information
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Expiring Soon
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {cartStats?.expiringIn5Days || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Cart lines expiring within 5 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Expired
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {cartStats?.expired || 0}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 w-full"
              onClick={handleCleanupExpired}
            >
              <Trash2 className="h-3 w-3 mr-2" />
              Cleanup Expired
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Old Cart Lines Alert */}
      {cartStats && cartStats.expiringIn5Days > 0 && (
        <Card className="border-yellow-600 bg-yellow-50 dark:bg-yellow-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
              Cart Lines Expiring Soon
            </CardTitle>
            <CardDescription className="text-yellow-600 dark:text-yellow-500">
              The following cart lines contain PHI and will expire within 5 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cartStats.oldCartLines.map((line: any) => (
                <div key={line.id} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{line.patient_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Created {formatDistanceToNow(new Date(line.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-yellow-700 border-yellow-700">
                      Expires {formatDistanceToNow(new Date(line.expires_at), { addSuffix: true })}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent PHI Access Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Recent Cart PHI Access
          </CardTitle>
          <CardDescription>
            Audit log of cart line PHI access events for HIPAA compliance
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paginatedAccess.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No PHI access logs found
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Data Accessed</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAccess.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{log.user_email}</p>
                          <p className="text-xs text-muted-foreground">{log.user_role}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.details?.patient_name || "Unknown"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {log.details?.has_prescription && (
                            <Badge variant="outline" className="text-xs">Rx</Badge>
                          )}
                          {log.details?.has_contact_info && (
                            <Badge variant="outline" className="text-xs">Contact</Badge>
                          )}
                          {log.details?.has_address && (
                            <Badge variant="outline" className="text-xs">Address</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {log.ip_address || "Unknown"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <DataTablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
                hasNextPage={hasNextPage}
                hasPrevPage={hasPrevPage}
                totalItems={recentAccess?.length || 0}
                startIndex={startIndex}
                endIndex={endIndex}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
