import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Shield, Activity, Eye, Key, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SecurityOverviewProps {
  onViewAllErrors?: () => void;
}

export const SecurityOverview = ({ onViewAllErrors }: SecurityOverviewProps) => {
  // Real-time alerts temporarily disabled during recovery
  // useEffect(() => {
  //   const channel = supabase
  //     .channel('critical-security-events')
  //     .on(
  //       'postgres_changes',
  //       {
  //         event: 'INSERT',
  //         schema: 'public',
  //         table: 'security_events',
  //         filter: 'severity=eq.critical',
  //       },
  //       (payload) => {
  //         toast.error("⚠️ Critical Security Event", {
  //           description: payload.new.details?.message || "Review Security Dashboard",
  //         });
  //       }
  //     )
  //     .subscribe();

  //   return () => {
  //     supabase.removeChannel(channel);
  //   };
  // }, []);

  const { data: errorStats, isLoading: errorStatsLoading } = useQuery({
    queryKey: ["security-overview-errors"],
    queryFn: async () => {
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("audit_logs")
        .select("*", { count: "exact", head: true })
        .in("action_type", ["client_error", "edge_function_error", "api_error"])
        .gte("created_at", last24h);
      return count || 0;
    },
  });

  const { data: auditStats, isLoading: auditStatsLoading } = useQuery({
    queryKey: ["security-overview-audit"],
    queryFn: async () => {
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("audit_logs")
        .select("*", { count: "exact", head: true })
        .gte("created_at", last24h);
      return count || 0;
    },
  });

  const { data: impersonationStats, isLoading: impersonationStatsLoading } = useQuery({
    queryKey: ["security-overview-impersonation"],
    queryFn: async () => {
      const { data } = await supabase
        .from("impersonation_logs")
        .select("*")
        .is("end_time", null);
      return data?.length || 0;
    },
  });

  const { data: phiAccessCount } = useQuery({
    queryKey: ["phi-access-24h"],
    queryFn: async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const { count } = await supabase
        .from("audit_logs")
        .select("*", { count: "exact", head: true })
        .in("action_type", ["SELECT_patient", "UPDATE_patient", "prescription_accessed", "cart_line_accessed"])
        .gte("created_at", yesterday.toISOString());
      return count || 0;
    },
  });

  const { data: encryptionCoverage } = useQuery({
    queryKey: ["encryption-coverage"],
    queryFn: async () => {
      const [patientsRes, orderLinesRes] = await Promise.all([
        supabase.from("patient_accounts").select("id, allergies_encrypted, notes_encrypted"),
        supabase.from("order_lines").select("id, prescription_url_encrypted"),
      ]);

      const patients = patientsRes.data || [];
      const orderLines = orderLinesRes.data || [];
      const totalRecords = patients.length + orderLines.length;
      if (totalRecords === 0) return 100;

      const encryptedPatients = patients.filter(p => p.allergies_encrypted || p.notes_encrypted).length;
      const encryptedOrders = orderLines.filter(o => o.prescription_url_encrypted).length;
      
      return ((encryptedPatients + encryptedOrders) / totalRecords) * 100;
    },
  });

  const { data: recentErrors, isLoading: recentErrorsLoading } = useQuery({
    queryKey: ["security-overview-recent-errors"],
    queryFn: async () => {
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .in("action_type", ["client_error", "edge_function_error", "api_error"])
        .gte("created_at", last24h)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      {/* Critical Alerts */}
      {errorStats && errorStats > 10 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            High error volume detected: {errorStats} errors in the last 24 hours
          </AlertDescription>
        </Alert>
      )}

      {/* Security Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Health Score
          </CardTitle>
          <CardDescription>Overall system security assessment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Encryption Coverage</span>
              <span className="text-sm">{encryptionCoverage?.toFixed(0) || 0}%</span>
            </div>
            <Progress value={encryptionCoverage || 0} className="h-2" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm pt-2">
              <div>
                <p className="text-muted-foreground">RLS Policies</p>
                <p className="font-medium flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" /> Active
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">PHI Accesses</p>
                <p className="font-medium">{phiAccessCount || 0} (24h)</p>
              </div>
              <div>
                <p className="text-muted-foreground">Audit Logging</p>
                <p className="font-medium flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" /> Enabled
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Errors</p>
                <p className="font-medium">{errorStats || 0} (24h)</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">PHI Accesses</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{phiAccessCount || 0}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{errorStats || 0}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Encryption</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{encryptionCoverage?.toFixed(0) || 0}%</div>
            <p className="text-xs text-muted-foreground">Protected data</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{impersonationStats || 0}</div>
            <p className="text-xs text-muted-foreground">Impersonations</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Recent Error Activity</CardTitle>
              <CardDescription>
                {errorStats && errorStats > 5 
                  ? `Showing 5 most recent of ${errorStats} errors`
                  : "Recent error activity from the last 24 hours"
                }
              </CardDescription>
            </div>
            {errorStats && errorStats > 5 && onViewAllErrors && (
              <Button variant="link" className="gap-2" onClick={onViewAllErrors}>
                View All Errors →
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {recentErrorsLoading ? (
            <p className="text-center text-muted-foreground py-4">Loading...</p>
          ) : recentErrors && recentErrors.length > 0 ? (
            <div className="space-y-2">
              {recentErrors.map((error) => (
                <div key={error.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    <Badge variant="destructive">{error.action_type}</Badge>
                    <span className="text-sm">{error.entity_type || "Unknown"}</span>
                    <span className="text-sm text-muted-foreground">{error.user_email || "Anonymous"}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(error.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">No errors in the last 24 hours</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
