import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

export const PharmacyApiHealthWidget = () => {
  const { data: stats } = useQuery({
    queryKey: ["pharmacy-api-health"],
    queryFn: async () => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Count API-enabled pharmacies
      const { count: enabledCount } = await supabase
        .from("pharmacies")
        .select("*", { count: 'exact', head: true })
        .eq("api_enabled", true);

      // Get 24h transmission stats
      const { data: transmissions } = await supabase
        .from("pharmacy_order_transmissions")
        .select("success")
        .gte("transmitted_at", twentyFourHoursAgo);

      const total = transmissions?.length || 0;
      const successful = transmissions?.filter(t => t.success).length || 0;
      const successRate = total > 0 ? (successful / total) * 100 : 0;

      // Get unresolved alerts
      const { count: alertCount } = await supabase
        .from("admin_alerts")
        .select("*", { count: 'exact', head: true })
        .eq("resolved", false);

      return {
        enabledPharmacies: enabledCount || 0,
        successRate: successRate.toFixed(1),
        failedTransmissions: total - successful,
        activeAlerts: alertCount || 0,
      };
    },
    refetchInterval: 60000, // Refresh every minute
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Pharmacy API Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Enabled Pharmacies</div>
            <div className="text-2xl font-bold">{stats?.enabledPharmacies || 0}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">24h Success Rate</div>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{stats?.successRate || 0}%</div>
              {parseFloat(stats?.successRate || '0') >= 95 ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : parseFloat(stats?.successRate || '0') >= 80 ? (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Failed (24h)</div>
            <div className="text-2xl font-bold text-destructive">{stats?.failedTransmissions || 0}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Active Alerts</div>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{stats?.activeAlerts || 0}</div>
              {(stats?.activeAlerts || 0) > 0 && (
                <Badge variant="destructive">!</Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
