import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Webhook, Copy, Send, RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

const VIOS_PHARMACY_ID = "d5e75179-e66c-450f-8cae-1f4df93b097c";

const VIOS_STATUSES = [
  { value: "new", label: "New", mappedTo: "processing" },
  { value: "in_progress", label: "In Progress", mappedTo: "processing" },
  { value: "compounding", label: "Compounding", mappedTo: "processing" },
  { value: "ready_to_ship", label: "Ready to Ship", mappedTo: "processing" },
  { value: "shipped", label: "Shipped", mappedTo: "shipped" },
  { value: "in_transit", label: "In Transit", mappedTo: "shipped" },
  { value: "out_for_delivery", label: "Out for Delivery", mappedTo: "shipped" },
  { value: "delivered", label: "Delivered", mappedTo: "delivered" },
  { value: "cancelled", label: "Cancelled", mappedTo: "cancelled" },
];

const CARRIERS = [
  { value: "fedex", label: "FedEx" },
  { value: "usps", label: "USPS" },
  { value: "ups", label: "UPS" },
];

export function ViosWebhookTester() {
  const [testMode, setTestMode] = useState<"order" | "manual">("order");
  const [selectedOrderLineId, setSelectedOrderLineId] = useState<string>("");
  const [manualPharmacyOrderId, setManualPharmacyOrderId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [statusDetails, setStatusDetails] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [lastResponse, setLastResponse] = useState<{ success: boolean; data: any } | null>(null);

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

  // Fetch VIOS orders
  const { data: viosOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ["vios-order-lines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_lines")
        .select(`
          id,
          pharmacy_order_id,
          patient_name,
          status,
          tracking_number,
          created_at,
          order_id,
          product:products(name)
        `)
        .eq("assigned_pharmacy_id", VIOS_PHARMACY_ID)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch recent tracking updates
  const { data: recentUpdates, refetch: refetchUpdates } = useQuery({
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

  const sendTestWebhook = async () => {
    if (!selectedStatus) {
      toast.error("Please select a status");
      return;
    }

    const selectedOrder = viosOrders?.find(o => o.id === selectedOrderLineId);
    
    let pharmacyOrderId: string;
    let orderLineId: string | undefined;

    if (testMode === "order") {
      if (!selectedOrderLineId) {
        toast.error("Please select an order");
        return;
      }
      pharmacyOrderId = selectedOrder?.pharmacy_order_id || `TEST-${Date.now()}`;
      orderLineId = selectedOrderLineId;
    } else {
      if (!manualPharmacyOrderId) {
        toast.error("Please enter a pharmacy order ID");
        return;
      }
      pharmacyOrderId = manualPharmacyOrderId;
    }

    const payload = {
      pharmacy_order_id: pharmacyOrderId,
      order_line_id: orderLineId,
      status: selectedStatus,
      status_details: statusDetails || `Test webhook: ${selectedStatus}`,
      tracking_number: trackingNumber || null,
      carrier: carrier || null,
      status_datetime: new Date().toISOString(),
    };

    setIsSending(true);
    setLastResponse(null);

    try {
      const response = await fetch(webhookUrl!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(pharmacyConfig?.webhook_secret && { "x-api-key": pharmacyConfig.webhook_secret }),
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      setLastResponse({
        success: response.ok,
        data: { status: response.status, ...data },
      });

      if (response.ok) {
        toast.success("Test webhook sent successfully");
        refetchUpdates();
      } else {
        toast.error(`Webhook failed: ${data.error || "Unknown error"}`);
      }
    } catch (error) {
      setLastResponse({
        success: false,
        data: { error: error instanceof Error ? error.message : "Network error" },
      });
      toast.error("Failed to send webhook");
    } finally {
      setIsSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = VIOS_STATUSES.find(s => s.value === status);
    const mappedTo = statusInfo?.mappedTo || status;
    
    switch (mappedTo) {
      case "delivered":
        return <Badge className="bg-green-100 text-green-800">{status}</Badge>;
      case "shipped":
        return <Badge className="bg-blue-100 text-blue-800">{status}</Badge>;
      case "processing":
        return <Badge className="bg-yellow-100 text-yellow-800">{status}</Badge>;
      case "cancelled":
        return <Badge variant="destructive">{status}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
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
            Configure and test the VIOS pharmacy webhook endpoint for receiving tracking updates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
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
          </div>
          
          <div className="flex items-center gap-6">
            <div>
              <Label className="text-sm text-muted-foreground">Status</Label>
              <div className="mt-1">
                <Badge variant={pharmacyConfig?.inbound_webhook_enabled ? "default" : "secondary"}>
                  {pharmacyConfig?.inbound_webhook_enabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Authentication</Label>
              <p className="text-sm mt-1">
                {pharmacyConfig?.webhook_secret 
                  ? "API Key required (x-api-key header)" 
                  : "No authentication"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Tester Card */}
      <Card>
        <CardHeader>
          <CardTitle>Test Webhook</CardTitle>
          <CardDescription>
            Send a test webhook payload to simulate VIOS status updates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Test Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={testMode === "order" ? "default" : "outline"}
              size="sm"
              onClick={() => setTestMode("order")}
            >
              Select Order
            </Button>
            <Button
              variant={testMode === "manual" ? "default" : "outline"}
              size="sm"
              onClick={() => setTestMode("manual")}
            >
              Manual Entry
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {testMode === "order" ? (
              <div>
                <Label>Order</Label>
                <Select value={selectedOrderLineId} onValueChange={setSelectedOrderLineId}>
                  <SelectTrigger>
                    <SelectValue placeholder={ordersLoading ? "Loading..." : "Select an order"} />
                  </SelectTrigger>
                  <SelectContent>
                    {viosOrders?.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.order_id.slice(0, 8)}... - {order.patient_name} ({order.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Pharmacy Order ID</Label>
                <Input
                  value={manualPharmacyOrderId}
                  onChange={(e) => setManualPharmacyOrderId(e.target.value)}
                  placeholder="e.g., VIOS-123456"
                />
              </div>
            )}

            <div>
              <Label>Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {VIOS_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label} → {status.mappedTo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tracking Number (optional)</Label>
              <Input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g., 1Z999AA10123456784"
              />
            </div>

            <div>
              <Label>Carrier (optional)</Label>
              <Select value={carrier} onValueChange={setCarrier}>
                <SelectTrigger>
                  <SelectValue placeholder="Select carrier" />
                </SelectTrigger>
                <SelectContent>
                  {CARRIERS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label>Status Details (optional)</Label>
              <Input
                value={statusDetails}
                onChange={(e) => setStatusDetails(e.target.value)}
                placeholder="e.g., Package picked up by carrier"
              />
            </div>
          </div>

          <Button 
            onClick={sendTestWebhook} 
            disabled={isSending || !webhookUrl}
            className="gap-2"
          >
            {isSending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send Test Webhook
          </Button>

          {/* Response Display */}
          {lastResponse && (
            <div className={`p-4 rounded-lg border ${lastResponse.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <div className="flex items-center gap-2 mb-2">
                {lastResponse.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="font-medium">
                  {lastResponse.success ? "Success" : "Failed"}
                </span>
              </div>
              <pre className="text-xs font-mono overflow-auto max-h-40">
                {JSON.stringify(lastResponse.data, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Updates Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent VIOS Tracking Updates</CardTitle>
            <CardDescription>
              Latest webhook updates received from VIOS
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchUpdates()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
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
                  <TableHead>Time</TableHead>
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
                        <p className="text-xs text-muted-foreground mt-1">
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
              No tracking updates received yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
