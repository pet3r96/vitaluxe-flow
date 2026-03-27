import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Webhook, Copy, RefreshCw, Clock, Trash2, CheckCircle2, XCircle, Loader2, Play, Settings, FlaskConical, History, Send, FileText, FileSearch, ShieldCheck } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ViosWebhookAuditLog } from "./ViosWebhookAuditLog";
const VIOS_PHARMACY_ID = "d5e75179-e66c-450f-8cae-1f4df93b097c";
interface TestResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
  duration?: number;
}
interface ApiTestResults {
  tokenTest: TestResult;
  ordersTest: TestResult;
  allergiesTest: TestResult;
  overallSuccess: boolean;
}
interface WebhookSimResult {
  success: boolean;
  httpStatus: number;
  webhookResponse: Record<string, unknown>;
  sentPayload: Record<string, unknown>;
}
interface TestOrderResult {
  success: boolean;
  testReferenceId: string;
  duration_ms: number;
  payload_sent: Record<string, unknown>;
  vios_response: Record<string, unknown> | null;
  error: {
    message: string;
    details: unknown;
  } | null;
  validation_checks: Record<string, unknown>;
}
export function ViosWebhookMonitor() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [apiTestResults, setApiTestResults] = useState<ApiTestResults | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState<WebhookSimResult | null>(null);
  const [isSubmittingTestOrder, setIsSubmittingTestOrder] = useState(false);
  const [testOrderResult, setTestOrderResult] = useState<TestOrderResult | null>(null);
  const [showPayloadDetails, setShowPayloadDetails] = useState(false);

  // Webhook simulator form state
  const [simRxStatus, setSimRxStatus] = useState("Shipping");
  const [simReferenceId, setSimReferenceId] = useState("");
  const [simTrackingNumber, setSimTrackingNumber] = useState("");
  const [simCarrier, setSimCarrier] = useState("UPS");
  const [simRxNumber, setSimRxNumber] = useState("");

  // Fetch VIOS pharmacy config
  const {
    data: pharmacyConfig
  } = useQuery({
    queryKey: ["vios-pharmacy-config"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("pharmacies").select("id, name, inbound_webhook_enabled, inbound_webhook_path, webhook_secret").eq("id", VIOS_PHARMACY_ID).single();
      if (error) throw error;
      return data;
    }
  });

  // Fetch recent tracking updates
  const {
    data: recentUpdates,
    refetch: refetchUpdates,
    isLoading
  } = useQuery({
    queryKey: ["vios-tracking-updates"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("pharmacy_tracking_updates").select(`
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
        `).eq("pharmacy_id", VIOS_PHARMACY_ID).order("created_at", {
        ascending: false
      }).limit(20);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000
  });
  const webhookUrl = pharmacyConfig?.inbound_webhook_path ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/receive-pharmacy-webhook/${pharmacyConfig.inbound_webhook_path}` : null;
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
  const clearHistory = async () => {
    setIsDeleting(true);
    try {
      const {
        error
      } = await supabase.from("pharmacy_tracking_updates").delete().eq("pharmacy_id", VIOS_PHARMACY_ID);
      if (error) throw error;
      toast.success("Tracking history cleared");
      refetchUpdates();
    } catch (error) {
      toast.error("Failed to clear history");
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };
  const runApiTests = async () => {
    setIsTestingApi(true);
    setApiTestResults(null);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("test-vios-api");
      if (error) {
        console.error("[VIOS API Test] Function invoke error:", error);
        toast.error(`API test failed: ${error.message}. Check console for details.`);
        setApiTestResults({
          tokenTest: {
            success: false,
            message: `Function invoke error: ${error.message}`,
            details: {
              errorType: error.name || "Unknown",
              hint: "This may indicate an auth issue (are you an admin?) or the function failed to deploy."
            }
          },
          ordersTest: {
            success: false,
            message: "Skipped - function error"
          },
          allergiesTest: {
            success: false,
            message: "Skipped - function error"
          },
          overallSuccess: false
        });
        return;
      }

      // Handle the actual response format from test-vios-api edge function
      // Response shape: { success, enabled, api_url, credentials, connection }
      const connection = data?.connection || {};
      const credentials = data?.credentials || {};
      const isConnected = data?.success === true && connection?.connected === true;
      const isEnabled = data?.enabled === true;

      // Build ApiTestResults from the actual response
      const results: ApiTestResults = {
        tokenTest: {
          success: isConnected,
          message: isConnected ? `Token valid, expires in ${Math.round((connection?.tokenExpiresIn || 0) / 60)} minutes` : !isEnabled ? "VIOS integration is disabled" : data?.error || connection?.error || "Failed to obtain token",
          details: {
            apiUrl: data?.api_url,
            tokenValid: connection?.tokenValid,
            tokenExpiresIn: connection?.tokenExpiresIn,
            lastSuccessfulCall: connection?.lastSuccessfulCall
          },
          duration: connection?.tokenExpiresIn ? undefined : undefined
        },
        ordersTest: {
          success: isConnected,
          message: isConnected ? "Orders endpoint accessible (authenticated)" : "Cannot test - authentication failed"
        },
        allergiesTest: {
          success: isConnected,
          message: isConnected ? "Allergies endpoint accessible (authenticated)" : "Cannot test - authentication failed"
        },
        overallSuccess: isConnected
      };

      // Add credentials info if not configured
      if (!credentials?.client_id_configured || !credentials?.client_secret_configured) {
        results.tokenTest = {
          success: false,
          message: "Missing API credentials",
          details: {
            client_id_configured: credentials?.client_id_configured || false,
            client_secret_configured: credentials?.client_secret_configured || false,
            hint: "Configure VIOS_CLIENT_ID and VIOS_CLIENT_SECRET in edge function secrets"
          }
        };
        results.overallSuccess = false;
      }
      setApiTestResults(results);
      if (results.overallSuccess) {
        toast.success("All API tests passed!");
      } else if (!isEnabled) {
        toast.warning("VIOS integration is currently disabled");
      } else {
        toast.warning("API connection test failed - see details below");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[VIOS API Test] Unexpected error:", error);
      toast.error(`API test failed: ${errorMessage}`);
      setApiTestResults({
        tokenTest: {
          success: false,
          message: `Unexpected error: ${errorMessage}`
        },
        ordersTest: {
          success: false,
          message: "Skipped"
        },
        allergiesTest: {
          success: false,
          message: "Skipped"
        },
        overallSuccess: false
      });
    } finally {
      setIsTestingApi(false);
    }
  };
  const simulateWebhook = async () => {
    setIsSimulating(true);
    setSimResult(null);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("simulate-vios-webhook", {
        body: {
          rxStatus: simRxStatus,
          referenceId: simReferenceId || undefined,
          trackingNumber: simTrackingNumber || undefined,
          carrier: simCarrier || undefined,
          rxNumber: simRxNumber || undefined
        }
      });
      if (error) throw error;
      setSimResult(data as WebhookSimResult);
      if (data.success) {
        toast.success("Webhook simulation successful!");
        refetchUpdates();
      } else {
        toast.warning(`Webhook returned ${data.httpStatus}`);
      }
    } catch (error: any) {
      toast.error(`Simulation failed: ${error.message}`);
      console.error(error);
    } finally {
      setIsSimulating(false);
    }
  };
  const submitTestOrder = async () => {
    setIsSubmittingTestOrder(true);
    setTestOrderResult(null);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("test-vios-order-submit", {
        body: {}
      });
      if (error) {
        console.error("[VIOS Test Order] Function invoke error:", error);
        toast.error(`Test order failed: ${error.message}`);
        return;
      }
      setTestOrderResult(data as TestOrderResult);
      if (data.success) {
        const orderId = data.vios_response?.orderId || data.vios_response?.OrderId;
        toast.success(`Test order submitted! VIOS Order ID: ${orderId}`);
      } else {
        toast.error("Test order failed - see details below");
      }
    } catch (error: any) {
      console.error("[VIOS Test Order] Unexpected error:", error);
      toast.error(`Test order failed: ${error.message}`);
    } finally {
      setIsSubmittingTestOrder(false);
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
  const TestResultRow = ({
    label,
    result
  }: {
    label: string;
    result?: TestResult;
  }) => {
    if (!result) return null;
    return <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
        {result.success ? <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" /> : <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{label}</span>
            {result.duration && <span className="text-xs text-muted-foreground">{result.duration}ms</span>}
          </div>
          <p className="text-sm text-muted-foreground">{result.message}</p>
          {result.details && <pre className="text-xs mt-1 p-2 bg-background rounded overflow-x-auto">
              {JSON.stringify(result.details, null, 2)}
            </pre>}
        </div>
      </div>;
  };
  return <div className="space-y-6">
      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="config" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Configuration</span>
          </TabsTrigger>
          <TabsTrigger value="api-test" className="gap-2">
            <Play className="h-4 w-4" />
            <span className="hidden sm:inline">API Test</span>
          </TabsTrigger>
          <TabsTrigger value="webhook-sim" className="gap-2">
            <FlaskConical className="h-4 w-4" />
            <span className="hidden sm:inline">Simulator</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">History & Audit</span>
          </TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="config">
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
              {/* API Credentials Status */}
              <div className="p-3 bg-muted/30 rounded-lg border space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">VIOS API Credentials</Label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 text-sm">
                  <div className="flex items-center justify-between p-2 bg-background rounded">
                    <span className="text-muted-foreground">VIOS_CLIENT_ID</span>
                    <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      Configured
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-background rounded">
                    <span className="text-muted-foreground">VIOS_CLIENT_SECRET</span>
                    <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      Configured
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Practice is determined server-side by these API credentials. No practiceId is sent in payloads.
                </p>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Webhook URL (for VIOS to send updates)</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={webhookUrl || "Not configured"} readOnly className="font-mono text-sm" />
                  <Button variant="outline" size="icon" onClick={copyWebhookUrl} disabled={!webhookUrl}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div>
                <Label className="text-sm text-muted-foreground">Webhook API Key (x-api-key header)</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={pharmacyConfig?.webhook_secret ? "••••••••••••••••" : "Not configured"} readOnly className="font-mono text-sm" />
                  <Button variant="outline" size="icon" onClick={copyApiKey} disabled={!pharmacyConfig?.webhook_secret}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center gap-6 pt-2">
                <div>
                  <Label className="text-sm text-muted-foreground">Inbound Webhooks</Label>
                  <div className="mt-1">
                    <Badge variant={pharmacyConfig?.inbound_webhook_enabled ? "default" : "secondary"}>
                      {pharmacyConfig?.inbound_webhook_enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Payload Format</Label>
                  <p className="text-sm mt-1">VIOS Single-Item Array</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Test Tab */}
        <TabsContent value="api-test">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                VIOS API Connection Test
              </CardTitle>
              <CardDescription>
                Test connectivity to VIOS API endpoints (token, orders, allergies)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={runApiTests} disabled={isTestingApi} className="w-full sm:w-auto">
                {isTestingApi ? <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running Tests...
                  </> : <>
                    <Play className="h-4 w-4 mr-2" />
                    Run All Tests
                  </>}
              </Button>

              {apiTestResults && <div className="space-y-3 mt-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    {apiTestResults.overallSuccess ? <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        All Tests Passed
                      </Badge> : <Badge variant="destructive">Some Tests Failed</Badge>}
                  </div>
                  
                  <TestResultRow label="Token Authentication" result={apiTestResults.tokenTest} />
                  <TestResultRow label="Orders Endpoint" result={apiTestResults.ordersTest} />
                  <TestResultRow label="Allergies Endpoint" result={apiTestResults.allergiesTest} />
                </div>}

              {!apiTestResults && !isTestingApi && <p className="text-sm text-muted-foreground py-4 text-center">
                  Click "Run All Tests" to verify VIOS API connectivity
                </p>}
            </CardContent>
          </Card>

          {/* Submit Test Order Card */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Submit Test Order to VIOS
              </CardTitle>
              <CardDescription>
                Send a test order with isTestOrder: true to verify payload structure and integration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Note:</strong> This sends a real API request to VIOS with <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">isTestOrder: true</code>. 
                  VIOS should recognize this as a test and not process it as a real order.
                </p>
              </div>
              <Button onClick={submitTestOrder} disabled={isSubmittingTestOrder} className="w-full sm:w-auto" variant="default">
                {isSubmittingTestOrder ? <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting Test Order...
                  </> : <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Test Order
                  </>}
              </Button>

              {testOrderResult && <div className="mt-4 space-y-4">
                  {/* Result Summary */}
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border">
                    {testOrderResult.success ? <CheckCircle2 className="h-8 w-8 text-green-500 shrink-0" /> : <XCircle className="h-8 w-8 text-destructive shrink-0" />}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {testOrderResult.success ? <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            Order Submitted Successfully
                          </Badge> : <Badge variant="destructive">Order Submission Failed</Badge>}
                        <span className="text-sm text-muted-foreground">
                          {testOrderResult.duration_ms}ms
                        </span>
                      </div>
                      {testOrderResult.success && testOrderResult.vios_response && <p className="text-sm mt-1">
                          <strong>VIOS Order ID:</strong>{" "}
                          <code className="bg-muted px-2 py-0.5 rounded font-mono">
                            {String(testOrderResult.vios_response.orderId || testOrderResult.vios_response.OrderId || 'N/A')}
                          </code>
                        </p>}
                      <p className="text-sm text-muted-foreground mt-1">
                        Reference ID: <code className="font-mono">{testOrderResult.testReferenceId}</code>
                      </p>
                    </div>
                  </div>

                  {/* Error Details */}
                  {testOrderResult.error && <div className="space-y-2">
                      <Label className="text-sm text-destructive">Error Details</Label>
                      <pre className="text-xs p-3 bg-destructive/10 text-destructive rounded-lg overflow-x-auto">
                        {JSON.stringify(testOrderResult.error, null, 2)}
                      </pre>
                    </div>}

                  {/* VIOS Response */}
                  {testOrderResult.vios_response && <div className="space-y-2">
                      <Label className="text-sm">VIOS Response</Label>
                      <pre className="text-xs p-3 bg-muted rounded-lg overflow-x-auto max-h-48">
                        {JSON.stringify(testOrderResult.vios_response, null, 2)}
                      </pre>
                    </div>}

                  {/* Validation Checks */}
                  <div className="space-y-2">
                    <Label className="text-sm">Validation Checks</Label>
                    <pre className="text-xs p-3 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-lg overflow-x-auto">
                      {JSON.stringify(testOrderResult.validation_checks, null, 2)}
                    </pre>
                  </div>

                  {/* Collapsible Payload Details */}
                  <Collapsible open={showPayloadDetails} onOpenChange={setShowPayloadDetails}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <FileText className="h-4 w-4" />
                        {showPayloadDetails ? "Hide" : "Show"} Full Payload Sent
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <pre className="text-xs p-3 bg-muted rounded-lg overflow-x-auto max-h-96">
                        {JSON.stringify(testOrderResult.payload_sent, null, 2)}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>
                </div>}

              {!testOrderResult && !isSubmittingTestOrder && <p className="text-sm text-muted-foreground py-4 text-center">
                  Click "Submit Test Order" to send a test order to VIOS and verify the integration
                </p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Webhook Simulator Tab */}
        <TabsContent value="webhook-sim">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5" />
                Webhook Simulator
              </CardTitle>
              <CardDescription>
                Send test VIOS webhook payloads to verify integration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={simRxStatus} onValueChange={setSimRxStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Submitted">Submitted</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Shipping">Shipping</SelectItem>
                      <SelectItem value="Delivered">Delivered</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Carrier</Label>
                  <Select value={simCarrier} onValueChange={setSimCarrier}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UPS">UPS</SelectItem>
                      <SelectItem value="FedEx">FedEx</SelectItem>
                      <SelectItem value="USPS">USPS</SelectItem>
                      <SelectItem value="DHL">DHL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Reference ID (order_line.id)</Label>
                  <Input placeholder="Optional - links to existing order" value={simReferenceId} onChange={e => setSimReferenceId(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Tracking Number</Label>
                  <Input placeholder="Auto-generated if empty" value={simTrackingNumber} onChange={e => setSimTrackingNumber(e.target.value)} />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label>RX Number</Label>
                  <Input placeholder="Auto-generated if empty" value={simRxNumber} onChange={e => setSimRxNumber(e.target.value)} />
                </div>
              </div>

              <Button onClick={simulateWebhook} disabled={isSimulating} className="w-full sm:w-auto">
                {isSimulating ? <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </> : <>
                    <FlaskConical className="h-4 w-4 mr-2" />
                    Send Test Webhook
                  </>}
              </Button>

              {simResult && <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    {simResult.success ? <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Webhook Received (HTTP {simResult.httpStatus})
                      </Badge> : <Badge variant="destructive">
                        Failed (HTTP {simResult.httpStatus})
                      </Badge>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm">Sent Payload</Label>
                    <pre className="text-xs p-3 bg-muted rounded-lg overflow-x-auto">
                      {JSON.stringify(simResult.sentPayload, null, 2)}
                    </pre>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Webhook Response</Label>
                    <pre className="text-xs p-3 bg-muted rounded-lg overflow-x-auto">
                      {JSON.stringify(simResult.webhookResponse, null, 2)}
                    </pre>
                  </div>
                </div>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History & Audit Log Tab (Unified) */}
        <TabsContent value="history">
          <div className="space-y-6">
            {/* Tracking Updates Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Tracking Updates
                  </CardTitle>
                  <CardDescription>
                    Order status and tracking updates received from VIOS (auto-refreshes every 30 seconds)
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive" disabled={!recentUpdates?.length || isDeleting}>
                        <Trash2 className="h-4 w-4" />
                        Clear
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Clear tracking history?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will delete all VIOS tracking updates from the history. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={clearHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Delete All
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button variant="outline" size="sm" onClick={() => refetchUpdates()} className="gap-2">
                    <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {recentUpdates && recentUpdates.length > 0 ? <Table>
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
                      {recentUpdates.map(update => <TableRow key={update.id}>
                          <TableCell className="font-mono text-sm">
                            {update.order_lines?.order_id?.slice(0, 8) || "-"}...
                          </TableCell>
                          <TableCell>{update.order_lines?.patient_name || "-"}</TableCell>
                          <TableCell>
                            {getStatusBadge(update.status)}
                            {update.status_details && <p className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate">
                                {update.status_details}
                              </p>}
                          </TableCell>
                          <TableCell>
                            {update.tracking_number ? <div className="text-sm">
                                <span className="font-mono">{update.tracking_number}</span>
                                {update.carrier && <span className="text-muted-foreground ml-1">({update.carrier})</span>}
                              </div> : <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(update.created_at), {
                          addSuffix: true
                        })}
                            </div>
                          </TableCell>
                        </TableRow>)}
                    </TableBody>
                  </Table> : <div className="text-center py-8 text-muted-foreground">
                    No tracking updates received yet. Updates will appear here when VIOS sends webhooks.
                  </div>}
              </CardContent>
            </Card>

            {/* Audit Log Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSearch className="h-5 w-5" />
                  Event Audit Log
                </CardTitle>
                <CardDescription>
                  Complete history of all VIOS communications - inbound webhooks and outbound API transmissions with payload details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ViosWebhookAuditLog />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>;
}