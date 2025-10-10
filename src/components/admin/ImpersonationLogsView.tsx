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
import { format } from "date-fns";
import { Shield, Clock, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function ImpersonationLogsView() {
  const { userRole, isImpersonating, effectiveUserId, user } = useAuth();
  const isAdminNotImpersonating = userRole === 'admin' && !isImpersonating;

  const { data: logs, isLoading } = useQuery({
    queryKey: ["impersonation-logs", isAdminNotImpersonating ? "admin" : effectiveUserId],
    queryFn: async () => {
      let query = supabase
        .from("impersonation_logs")
        .select("*")
        .order("start_time", { ascending: false })
        .limit(100);
      
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

  const calculateDuration = (startTime: string, endTime: string | null) => {
    if (!endTime) return "Active";
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end.getTime() - start.getTime();
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

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
                {logs.map((log) => (
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
