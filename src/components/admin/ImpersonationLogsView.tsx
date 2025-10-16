import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";
import { Shield, Clock, User, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

export function ImpersonationLogsView() {
  const { userRole, isImpersonating, effectiveUserId, user } = useAuth();
  const isAdminNotImpersonating = userRole === 'admin' && !isImpersonating;

  // Check if admin IP is allowed (only for admins)
  const { data: ipAllowed, isLoading: ipCheckLoading } = useQuery({
    queryKey: ['ip-check'],
    queryFn: async () => {
      if (!isAdminNotImpersonating) return true; // Non-admins always allowed to view their own logs
      const { data, error } = await supabase.rpc('is_admin_ip_allowed' as any);
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveUserId
  });

  const { data: logs, isLoading } = useQuery({
    queryKey: ["impersonation-logs", isAdminNotImpersonating ? "admin" : effectiveUserId],
    staleTime: 0,
    queryFn: async () => {
      let query = supabase
        .from("impersonation_logs")
        .select("*")
        .order("start_time", { ascending: false })
        .limit(1000);
      
      // Non-admin users and admins who are impersonating only see logs where they were the target
      if (!isAdminNotImpersonating && effectiveUserId) {
        query = query.eq("target_user_id", effectiveUserId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveUserId,
  });

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    hasNextPage,
    hasPrevPage,
  } = usePagination({
    totalItems: logs?.length || 0,
    itemsPerPage: 25,
  });

  const paginatedLogs = logs?.slice(startIndex, endIndex);

  const calculateDuration = (startTime: string, endTime: string | null) => {
    if (!endTime) return "Active";
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end.getTime() - start.getTime();
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  // Show access restricted message if admin IP not allowed
  if (isAdminNotImpersonating && ipAllowed === false) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Access Restricted</AlertTitle>
        <AlertDescription>
          Your IP address is not authorized to access impersonation logs. 
          Contact your system administrator to add your IP to the allowlist, or go to the IP Access tab to manage allowed IPs.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          {isAdminNotImpersonating ? "Impersonation Logs" : "Account Access History"}
        </CardTitle>
        <CardDescription>
          {isAdminNotImpersonating 
            ? "Complete audit trail of all impersonation sessions"
            : "Sessions where your account was accessed by administrators"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : logs && logs.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {isAdminNotImpersonating && <TableHead>Impersonated User</TableHead>}
                  {isAdminNotImpersonating && <TableHead>Role</TableHead>}
                  <TableHead>Start Time</TableHead>
                  <TableHead>End Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLogs?.map((log) => (
                  <TableRow key={log.id}>
                    {isAdminNotImpersonating && (
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {log.target_user_name || "Unknown"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {log.target_user_email}
                          </span>
                        </div>
                      </TableCell>
                    )}
                    {isAdminNotImpersonating && (
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {log.target_role}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3" />
                        {format(new Date(log.start_time), "MMM d, yyyy h:mm a")}
                      </span>
                    </TableCell>
                    <TableCell>
                      {log.end_time ? (
                        <span className="text-sm">
                          {format(new Date(log.end_time), "MMM d, yyyy h:mm a")}
                        </span>
                      ) : (
                        <Badge variant="default">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {calculateDuration(log.start_time, log.end_time)}
                    </TableCell>
                    <TableCell>
                      {log.end_time ? (
                        <Badge variant="secondary">Completed</Badge>
                      ) : (
                        <Badge variant="default" className="animate-pulse">
                          Active
                        </Badge>
                      )}
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
              totalItems={logs?.length || 0}
              startIndex={startIndex}
              endIndex={endIndex}
            />
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>
              {isAdminNotImpersonating 
                ? "No impersonation sessions recorded yet"
                : "Your account has not been accessed by administrators"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
