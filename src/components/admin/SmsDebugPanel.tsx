import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function SmsDebugPanel() {
  const { effectiveRole } = useAuth();

  const { data: smsCodesData, isLoading: codesLoading, refetch: refetchCodes } = useQuery({
    queryKey: ["admin-sms-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_codes")
        .select("*, profiles!sms_codes_user_id_fkey(name, email)")
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
    enabled: effectiveRole === "admin",
  });

  const { data: auditLogData, isLoading: auditLoading, refetch: refetchAudit } = useQuery({
    queryKey: ["admin-2fa-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("two_fa_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      
      if (error) throw error;
      return data;
    },
    enabled: effectiveRole === "admin",
  });

  if (effectiveRole !== "admin") {
    return null;
  }

  const handleRefresh = () => {
    refetchCodes();
    refetchAudit();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">SMS Debug Panel</h2>
          <p className="text-muted-foreground">Monitor GHL SMS delivery and verification</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* SMS Codes Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent SMS Codes</CardTitle>
          <CardDescription>Last 20 verification codes sent via GHL</CardDescription>
        </CardHeader>
        <CardContent>
          {codesLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {smsCodesData?.map((code) => {
                  const isExpired = new Date(code.expires_at) < new Date();
                  const profile = code.profiles as any;
                  
                  return (
                    <TableRow key={code.id}>
                      <TableCell>
                        <div className="font-medium">{profile?.name || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">{profile?.email}</div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {code.phone.slice(-4).padStart(code.phone.length, '*')}
                      </TableCell>
                      <TableCell className="font-mono font-bold">{code.code}</TableCell>
                      <TableCell>
                        {code.verified ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Verified
                          </Badge>
                        ) : isExpired ? (
                          <Badge variant="secondary" className="gap-1">
                            <Clock className="h-3 w-3" />
                            Expired
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <Clock className="h-3 w-3" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={code.attempt_count >= 5 ? "text-destructive font-semibold" : ""}>
                          {code.attempt_count} / 5
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(code.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {isExpired ? (
                          <span className="text-destructive">Expired</span>
                        ) : (
                          formatDistanceToNow(new Date(code.expires_at), { addSuffix: true })
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <CardTitle>2FA Audit Log</CardTitle>
          <CardDescription>Last 30 2FA events</CardDescription>
        </CardHeader>
        <CardContent>
          {auditLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogData?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {log.event_type.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.user_id?.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {log.phone ? log.phone.slice(-4).padStart(10, '*') : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {log.code_verified ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Success
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Failed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{log.attempt_count || 'N/A'}</TableCell>
                    <TableCell className="font-mono text-xs">{log.ip_address || 'N/A'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
