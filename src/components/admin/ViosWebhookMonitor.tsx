import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Webhook, Copy, RefreshCw, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const VIOS_PHARMACY_ID = "d5e75179-e66c-450f-8cae-1f4df93b097c";

export function ViosWebhookMonitor() {
  // Fetch VIOS pharmacy config
  const { data: pharmacyConfig } = useQuery({
    queryKey: ["vios-pharmacy-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacies")
        .select("id, name, inbound_webhook_enabled, inbound_webhook_path, webhook_secret")
        .eq("id", VIOS_PHARMACY_ID)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch recent tracking updates
  const { data: recentUpdates, refetch: refetchUpdates, isLoading } = useQuery({
    queryKey: ["vios-tracking-updates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacy_tracking_updates")
        .select(`
          id,
          status,
          status_details,
          tracking_number,
          carrier,
          created_at,
          order_line_id,
          order_lines(
            id,
            patient_name,
            order_id
          )
        `)
        .eq("pharmacy_id", VIOS_PHARMACY_ID)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const webhookUrl = pharmacyConfig?.inbound_webhook_path 
    ? `https://qbtsfajshnrwwlfzkeog.supabase.co/functions/v1/receive-pharmacy-webhook/${pharmacyConfig.inbound_webhook_path}`
    : null;

  const copyWebhookUrl = () => {
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl);
      toast.success("Webhook URL copied to clipboard");
    }
  };

  const copyApiKey = () => {
    if (pharmacyConfig?.webhook_secret) {
      navigator.clipboard.writeText(pharmacyConfig.webhook_secret);
      toast.success("API Key copied to clipboard");
    }
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status?.toLowerCase() || "";
    
    if (statusLower.includes("deliver")) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">{status}</Badge>;
    }
    if (statusLower.includes("ship") || statusLower.includes("transit")) {
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">{status}</Badge>;
    }
    if (statusLower.includes("process") || statusLower.includes("compound")) {
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">{status}</Badge>;
    }
    if (statusLower.includes("cancel")) {
      return <Badge variant="destructive">{status}</Badge>;
    }
    return <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Webhook Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            VIOS Webhook Configuration
          </CardTitle>
          <CardDescription>
            Provide these credentials to VIOS for sending tracking updates to Vitaluxe
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm text-muted-foreground">Webhook URL</Label>
            <div className="flex gap-2 mt-1">
              <Input 
                value={webhookUrl || "Not configured"} 
                readOnly 
                className="font-mono text-sm"
              />
              <Button variant="outline" size="icon" onClick={copyWebhookUrl} disabled={!webhookUrl}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div>
            <Label className="text-sm text-muted-foreground">API Key (x-api-key header)</Label>
            <div className="flex gap-2 mt-1">
              <Input 
                value={pharmacyConfig?.webhook_secret ? "••••••••••••••••" : "Not configured"} 
                readOnly 
                className="font-mono text-sm"
              />
              <Button variant="outline" size="icon" onClick={copyApiKey} disabled={!pharmacyConfig?.webhook_secret}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-6 pt-2">
            <div>
              <Label className="text-sm text-muted-foreground">Status</Label>
              <div className="mt-1">
                <Badge variant={pharmacyConfig?.inbound_webhook_enabled ? "default" : "secondary"}>
                  {pharmacyConfig?.inbound_webhook_enabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Format</Label>
              <p className="text-sm mt-1">ShipStation compatible</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Updates Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Incoming Tracking Updates</CardTitle>
            <CardDescription>
              Webhook updates received from VIOS (auto-refreshes every 30 seconds)
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchUpdates()} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {recentUpdates && recentUpdates.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead>Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentUpdates.map((update) => (
                  <TableRow key={update.id}>
                    <TableCell className="font-mono text-sm">
                      {update.order_lines?.order_id?.slice(0, 8) || "-"}...
                    </TableCell>
                    <TableCell>{update.order_lines?.patient_name || "-"}</TableCell>
                    <TableCell>
                      {getStatusBadge(update.status)}
                      {update.status_details && (
                        <p className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate">
                          {update.status_details}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {update.tracking_number ? (
                        <div className="text-sm">
                          <span className="font-mono">{update.tracking_number}</span>
                          {update.carrier && (
                            <span className="text-muted-foreground ml-1">({update.carrier})</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(update.created_at), { addSuffix: true })}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No tracking updates received yet. Updates will appear here when VIOS sends webhooks.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
