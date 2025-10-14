import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, AlertTriangle, Loader2 } from "lucide-react";
import { format } from "date-fns";

export const PaymentMethodAuditLog = () => {
  const [dateFilter, setDateFilter] = useState<string>("7d");

  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ["payment-method-audit-logs", dateFilter],
    queryFn: async () => {
      const now = new Date();
      let cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (dateFilter === "24h") {
        cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else if (dateFilter === "30d") {
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const paymentActions = [
        "INSERT_payment_method",
        "UPDATE_payment_method",
        "SELECT_payment_method",
        "DELETE_payment_method",
      ];

      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .in("action_type", paymentActions)
        .gte("created_at", cutoff.toISOString())
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
  });

  const { data: suspiciousActivity } = useQuery({
    queryKey: ["suspicious-payment-access", dateFilter],
    queryFn: async () => {
      if (!auditLogs) return [];

      // Group by user_id and count accesses
      const accessCounts = new Map<string, { count: number; user_email: string }>();
      
      auditLogs.forEach(log => {
        if (!log.user_id) return;
        
        const current = accessCounts.get(log.user_id) || { count: 0, user_email: log.user_email || "Unknown" };
        accessCounts.set(log.user_id, {
          count: current.count + 1,
          user_email: log.user_email || "Unknown",
        });
      });

      // Flag users with more than 10 accesses as suspicious
      const suspicious = Array.from(accessCounts.entries())
        .filter(([_, data]) => data.count > 10)
        .map(([user_id, data]) => ({
          user_id,
          user_email: data.user_email,
          access_count: data.count,
        }))
        .sort((a, b) => b.access_count - a.access_count);

      return suspicious;
    },
    enabled: !!auditLogs,
  });

  const getActionBadge = (action: string) => {
    if (action.includes("INSERT")) return { variant: "default" as const, label: "Created" };
    if (action.includes("UPDATE")) return { variant: "secondary" as const, label: "Updated" };
    if (action.includes("DELETE")) return { variant: "destructive" as const, label: "Deleted" };
    return { variant: "outline" as const, label: "Viewed" };
  };

  return (
    <div className="space-y-6">
      {/* Suspicious Activity Alert */}
      {suspiciousActivity && suspiciousActivity.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Suspicious Activity Detected
            </CardTitle>
            <CardDescription>
              The following users have accessed payment methods an unusual number of times
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {suspiciousActivity.map((user) => (
                <div key={user.user_id} className="flex items-center justify-between p-3 bg-destructive/10 rounded-md">
                  <p className="text-sm font-medium">{user.user_email}</p>
                  <Badge variant="destructive">{user.access_count} accesses</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Banking Security Audit Log
              </CardTitle>
              <CardDescription>
                Track all access to sensitive banking and payment information
              </CardDescription>
            </div>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : auditLogs && auditLogs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log) => {
                  const badge = getActionBadge(log.action_type);
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {format(new Date(log.created_at), "MMM dd, HH:mm:ss")}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{log.user_email || "N/A"}</p>
                          <p className="text-xs text-muted-foreground">{log.user_role || "Unknown"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.details && typeof log.details === 'object' && 'bank_name' in log.details && <p>Bank: {log.details.bank_name as string}</p>}
                        {log.details && typeof log.details === 'object' && 'account_mask' in log.details && <p>Account: ****{log.details.account_mask as string}</p>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.ip_address || "N/A"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-2">No Payment Method Activity</p>
              <p className="text-sm">No banking information has been accessed in this time period.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
