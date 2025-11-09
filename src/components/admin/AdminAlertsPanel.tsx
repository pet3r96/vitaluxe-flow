import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, XCircle, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

export const AdminAlertsPanel = () => {
  const navigate = useNavigate();

  const { data: alerts } = useQuery({
    queryKey: ["admin-alerts-unresolved"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_alerts")
        .select(`
          *,
          pharmacies (name)
        `)
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const criticalCount = alerts?.filter(a => a.severity === 'critical').length || 0;
  const warningCount = alerts?.filter(a => a.severity === 'warning').length || 0;
  const totalCount = criticalCount + warningCount;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {totalCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-destructive">
              {totalCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">System Alerts</h3>
            <Button onClick={() => navigate("/admin/alerts")} variant="link" size="sm">
              View All
            </Button>
          </div>

          {totalCount === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No active alerts</p>
            </div>
          ) : (
            <>
              {criticalCount > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-destructive font-semibold">
                    <XCircle className="h-4 w-4" />
                    <span>CRITICAL ({criticalCount})</span>
                  </div>
                  {alerts?.filter(a => a.severity === 'critical').map(alert => (
                    <div key={alert.id} className="p-3 bg-destructive/10 rounded-lg text-sm">
                      <div className="font-medium">{alert.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {(alert.pharmacies as any)?.name} • {format(new Date(alert.created_at), "MMM d, HH:mm")}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {warningCount > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-yellow-500 font-semibold">
                    <AlertCircle className="h-4 w-4" />
                    <span>WARNING ({warningCount})</span>
                  </div>
                  {alerts?.filter(a => a.severity === 'warning').map(alert => (
                    <div key={alert.id} className="p-3 bg-yellow-500/10 rounded-lg text-sm">
                      <div className="font-medium">{alert.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {(alert.pharmacies as any)?.name} • {format(new Date(alert.created_at), "MMM d, HH:mm")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
