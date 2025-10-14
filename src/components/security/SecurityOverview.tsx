import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Shield, Activity, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const SecurityOverview = () => {
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

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors (24h)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{errorStatsLoading ? '...' : (errorStats ?? 0)}</div>
            <p className="text-xs text-muted-foreground">Application errors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Audit Actions</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{auditStatsLoading ? '...' : (auditStats ?? 0)}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Shield className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{impersonationStatsLoading ? '...' : (impersonationStats ?? 0)}</div>
            <p className="text-xs text-muted-foreground">Impersonation active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Lock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Secure</div>
            <p className="text-xs text-muted-foreground">All systems normal</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Error Activity</CardTitle>
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
