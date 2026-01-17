import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { Loader2, CheckCircle, XCircle, AlertCircle, Activity, ShieldAlert, Copy, ChevronDown, ChevronRight, FlaskConical, Zap, ArrowUpFromLine, ArrowDownToLine } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useRole } from "@/hooks/useAuth";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PharmacyApiConfigDialogProps {
  pharmacyId: string;
  pharmacyName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WEBHOOK_BASE_URL = "https://qbtsfajshnrwwlfzkeog.supabase.co/functions/v1/receive-pharmacy-webhook";

export const PharmacyApiConfigDialog = ({
  pharmacyId,
  pharmacyName,
  open,
  onOpenChange,
}: PharmacyApiConfigDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { effectiveRole } = useRole();
  const isAdmin = effectiveRole === 'admin' || effectiveRole === 'super_admin';
  
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [diagnosticsResults, setDiagnosticsResults] = useState<any>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  
  // Collapsible section states
  const [outboundOpen, setOutboundOpen] = useState(true);
  const [inboundOpen, setInboundOpen] = useState(true);

  // Form state
  const [apiEnabled, setApiEnabled] = useState(false);
  const [apiTestMode, setApiTestMode] = useState(true);
  const [apiEndpointUrl, setApiEndpointUrl] = useState("");
  const [authType, setAuthType] = useState<string>("none");
  const [authKeyName, setAuthKeyName] = useState("X-API-Key");
  const [apiKey, setApiKey] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [retryCount, setRetryCount] = useState("3");
  const [timeoutSeconds, setTimeoutSeconds] = useState("30");
  
  // Inbound webhook state
  const [inboundWebhookEnabled, setInboundWebhookEnabled] = useState(false);
  const [inboundWebhookPath, setInboundWebhookPath] = useState("");
  const [apiStatusMapping, setApiStatusMapping] = useState<Record<string, string>>({});

  // Fetch pharmacy config
  const { data: pharmacy, isLoading } = useQuery({
    queryKey: ["pharmacy-api-config", pharmacyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacies")
        .select("*")
        .eq("id", pharmacyId)
        .single();

      if (error) throw error;

      // Update form state
      setApiEnabled(data.api_enabled || false);
      setApiTestMode(data.api_test_mode ?? true);
      setApiEndpointUrl(data.api_endpoint_url || "");
      setAuthType(data.api_auth_type || "none");
      setAuthKeyName(data.api_auth_key_name || "X-API-Key");
      setWebhookUrl(data.webhook_url || "");
      setWebhookSecret(data.webhook_secret || "");
      setRetryCount(String(data.api_retry_count || 3));
      setTimeoutSeconds(String(data.api_timeout_seconds || 30));
      
      // Inbound webhook settings
      setInboundWebhookEnabled(data.inbound_webhook_enabled || false);
      setInboundWebhookPath(data.inbound_webhook_path || "");
      setApiStatusMapping((data.api_status_mapping as Record<string, string>) || {});

      return data;
    },
    enabled: open,
  });

  // Fetch pharmacy API credentials
  const { data: credentials } = useQuery({
    queryKey: ["pharmacy-api-credentials", pharmacyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacy_api_credentials")
        .select("*")
        .eq("pharmacy_id", pharmacyId);

      if (error) throw error;
      return data;
    },
    enabled: open && !!pharmacyId,
  });

  // Parse credentials
  useEffect(() => {
    if (!credentials || credentials.length === 0) return;

    credentials.forEach((cred) => {
      if (cred.credential_type === "api_key" || cred.credential_type === "bearer_token") {
        setApiKey(cred.credential_key || "");
      }
    });
  }, [credentials]);

  // Fetch transmission logs
  const { data: transmissions } = useQuery({
    queryKey: ["pharmacy-transmissions", pharmacyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacy_order_transmissions")
        .select("*")
        .eq("pharmacy_id", pharmacyId)
        .order("transmitted_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const getInboundWebhookUrl = () => {
    if (!inboundWebhookPath) return null;
    return `${WEBHOOK_BASE_URL}/${inboundWebhookPath}`;
  };

  const handleCopyWebhookUrl = async () => {
    const url = getInboundWebhookUrl();
    if (!url) return;
    
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Copied!", description: "Webhook URL copied to clipboard" });
    } catch {
      toast({ title: "Failed to copy", description: "Please copy the URL manually", variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!isAdmin) {
      toast({ title: "Permission denied", description: "Only administrators can modify API settings", variant: "destructive" });
      return;
    }
    
    setIsSaving(true);
    try {
      const { error: updateError } = await supabase
        .from("pharmacies")
        .update({
          api_enabled: apiEnabled,
          api_test_mode: apiTestMode,
          api_handler_type: 'standard',
          api_endpoint_url: apiEndpointUrl || null,
          api_auth_type: authType,
          api_auth_key_name: authKeyName || null,
          webhook_url: webhookUrl || null,
          webhook_secret: webhookSecret || null,
          api_retry_count: parseInt(retryCount),
          api_timeout_seconds: parseInt(timeoutSeconds),
          inbound_webhook_enabled: inboundWebhookEnabled,
        })
        .eq("id", pharmacyId);

      if (updateError) throw updateError;

      if (apiKey && authType !== "none") {
        const credentialType = authType === "bearer" ? "bearer_token" : "api_key";
        
        const { error: credError } = await supabase
          .from("pharmacy_api_credentials")
          .upsert({
            pharmacy_id: pharmacyId,
            credential_type: credentialType,
            credential_key: apiKey,
          }, { onConflict: "pharmacy_id,credential_type" });

        if (credError) throw credError;
      }

      toast({ title: "Configuration saved", description: "Pharmacy API settings have been updated" });
      await queryClient.invalidateQueries({ queryKey: ["pharmacies-api-config"] });
      onOpenChange(false);
    } catch (error: any) {
      logger.error('Error saving API config', error);
      toast({ title: "Error saving configuration", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!apiEndpointUrl) {
      toast({ title: "Missing endpoint URL", description: "Please enter an API endpoint URL", variant: "destructive" });
      return;
    }

    setIsTesting(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };

      if (authType === "bearer" && apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      } else if (authType === "api_key" && apiKey) {
        headers[authKeyName] = apiKey;
      }

      const response = await fetch(apiEndpointUrl, { method: "POST", headers, body: JSON.stringify({ test: true }) });

      if (response.ok) {
        toast({ title: "Connection successful", description: `Connected to ${apiEndpointUrl}` });
      } else {
        toast({ title: "Connection failed", description: `HTTP ${response.status}: ${await response.text()}`, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Connection error", description: error.message, variant: "destructive" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleRunDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    setDiagnosticsResults(null);
    
    try {
      const { data, error } = await supabase.functions.invoke("pharmacy-api-diagnostics", {
        body: { pharmacy_id: pharmacyId }
      });

      if (error) throw error;

      setDiagnosticsResults(data);
      setShowDiagnostics(true);

      toast({
        title: data?.success ? "Diagnostics passed ✓" : "Diagnostics found issues",
        description: data?.success ? "All checks passed." : "Please review the results below.",
        variant: data?.success ? "default" : "destructive",
      });
    } catch (error: any) {
      logger.error('Diagnostics error', error);
      toast({ title: "Failed to run diagnostics", description: error.message, variant: "destructive" });
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Loading API Configuration...</DialogTitle></DialogHeader>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>API Configuration - {pharmacyName}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="config" className="w-full min-w-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="logs">Transmission Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-4 mt-4">
            {!isAdmin && (
              <Alert variant="default" className="mb-4">
                <ShieldAlert className="h-4 w-4" />
                <AlertDescription>Only administrators can modify API settings. Read-only mode.</AlertDescription>
              </Alert>
            )}
            
            {/* API Integration Toggle */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div className="space-y-0.5">
                <Label htmlFor="api-enabled" className="text-base font-medium">API Integration</Label>
                <p className="text-sm text-muted-foreground">Enable API communication with this pharmacy</p>
              </div>
              <Switch id="api-enabled" checked={apiEnabled} onCheckedChange={setApiEnabled} disabled={!isAdmin} />
            </div>

            {apiEnabled && (
              <>
                {/* Environment Toggle */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Environment</Label>
                  <div className="flex rounded-lg border p-1 bg-muted/30">
                    <button type="button" onClick={() => isAdmin && setApiTestMode(true)}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${apiTestMode ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      disabled={!isAdmin}>
                      <FlaskConical className="h-4 w-4" /> Sandbox
                    </button>
                    <button type="button" onClick={() => isAdmin && setApiTestMode(false)}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${!apiTestMode ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      disabled={!isAdmin}>
                      <Zap className="h-4 w-4" /> Production
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">{apiTestMode ? "Orders will be marked as test orders." : "Orders will be processed as real transactions."}</p>
                </div>

                {/* Outbound API Configuration */}
                <Collapsible open={outboundOpen} onOpenChange={setOutboundOpen}>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <ArrowUpFromLine className="h-5 w-5 text-primary" />
                        <div className="text-left">
                          <p className="font-medium">Outbound API Configuration</p>
                          <p className="text-sm text-muted-foreground">Send orders to pharmacy</p>
                        </div>
                      </div>
                      {outboundOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="api-endpoint">API Endpoint URL</Label>
                      <Input id="api-endpoint" placeholder="https://pharmacy-api.example.com/orders" value={apiEndpointUrl} onChange={(e) => setApiEndpointUrl(e.target.value)} disabled={!isAdmin} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="auth-type">Authentication Type</Label>
                      <Select value={authType} onValueChange={setAuthType} disabled={!isAdmin}>
                        <SelectTrigger id="auth-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="bearer">Bearer Token</SelectItem>
                          <SelectItem value="api_key">API Key</SelectItem>
                          <SelectItem value="basic">Basic Auth</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {authType === "api_key" && (
                      <div className="space-y-2">
                        <Label htmlFor="auth-key-name">API Key Header Name</Label>
                        <Input id="auth-key-name" placeholder="X-API-Key" value={authKeyName} onChange={(e) => setAuthKeyName(e.target.value)} disabled={!isAdmin} />
                      </div>
                    )}

                    {authType !== "none" && (
                      <div className="space-y-2">
                        <Label htmlFor="api-key">{authType === "bearer" ? "Bearer Token" : "API Key"}</Label>
                        <Input id="api-key" type="password" placeholder="Enter API key or token" value={apiKey} onChange={(e) => setApiKey(e.target.value)} disabled={!isAdmin} />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="retry-count">Retry Count</Label>
                        <Input id="retry-count" type="number" min="0" max="10" value={retryCount} onChange={(e) => setRetryCount(e.target.value)} disabled={!isAdmin} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="timeout">Timeout (seconds)</Label>
                        <Input id="timeout" type="number" min="5" max="120" value={timeoutSeconds} onChange={(e) => setTimeoutSeconds(e.target.value)} disabled={!isAdmin} />
                      </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t">
                      <Button onClick={handleRunDiagnostics} disabled={isRunningDiagnostics} variant="outline" className="w-full">
                        {isRunningDiagnostics && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Activity className="mr-2 h-4 w-4" /> Run Diagnostics
                      </Button>

                      {diagnosticsResults && (
                        <Collapsible open={showDiagnostics} onOpenChange={setShowDiagnostics}>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" className="w-full justify-between">
                              <span className="flex items-center gap-2">
                                {diagnosticsResults.success ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
                                Diagnostics Results
                              </span>
                              <span className="text-xs text-muted-foreground">{showDiagnostics ? "Hide" : "Show"}</span>
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-2 mt-2">
                            {diagnosticsResults.results?.map((result: any, idx: number) => (
                              <div key={idx} className="p-3 border rounded-md text-sm space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{result.step}</span>
                                  {result.status === "success" && <CheckCircle className="h-4 w-4 text-green-500" />}
                                  {result.status === "warning" && <AlertCircle className="h-4 w-4 text-amber-500" />}
                                  {result.status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
                                </div>
                                <p className="text-muted-foreground">{result.message}</p>
                              </div>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      <Button onClick={handleTestConnection} disabled={isTesting || !apiEndpointUrl} variant="outline" className="w-full">
                        {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Test Connection
                      </Button>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Inbound Webhook Configuration */}
                <Collapsible open={inboundOpen} onOpenChange={setInboundOpen}>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <ArrowDownToLine className="h-5 w-5 text-primary" />
                        <div className="text-left">
                          <p className="font-medium">Inbound Webhook</p>
                          <p className="text-sm text-muted-foreground">Receive updates from pharmacy</p>
                        </div>
                      </div>
                      {inboundOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Enable Inbound Webhook</Label>
                        <p className="text-sm text-muted-foreground">Receive tracking updates from this pharmacy</p>
                      </div>
                      <Switch checked={inboundWebhookEnabled} onCheckedChange={setInboundWebhookEnabled} disabled={!isAdmin} />
                    </div>

                    {inboundWebhookEnabled && (
                      <>
                        <div className="space-y-2">
                          <Label>Webhook Path</Label>
                          <Input placeholder="unique-pharmacy-path" value={inboundWebhookPath} onChange={(e) => setInboundWebhookPath(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ''))} disabled={!isAdmin} />
                          <p className="text-xs text-muted-foreground">Alphanumeric, hyphens, and underscores only</p>
                        </div>

                        {inboundWebhookPath && (
                          <div className="space-y-2">
                            <Label>Full Webhook URL</Label>
                            <div className="flex gap-2">
                              <Input value={getInboundWebhookUrl() || ''} readOnly className="font-mono text-xs" />
                              <Button variant="outline" size="icon" onClick={handleCopyWebhookUrl}>
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">Share this URL with the pharmacy for sending updates</p>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label>Webhook Secret (for signature verification)</Label>
                          <Input type="password" placeholder="Enter webhook secret" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} disabled={!isAdmin} />
                          <p className="text-xs text-muted-foreground">The pharmacy will include this in their webhook signature</p>
                        </div>
                      </>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving || !isAdmin}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Configuration
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Recent API transmissions for this pharmacy</p>
              {transmissions && transmissions.length > 0 ? (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {transmissions.map((tx: any) => (
                    <div key={tx.id} className="p-3 border rounded-lg text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{tx.transmission_type}</span>
                        <div className="flex items-center gap-2">
                          {tx.success ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
                          <span className="text-xs text-muted-foreground">{new Date(tx.transmitted_at).toLocaleString()}</span>
                        </div>
                      </div>
                      {tx.pharmacy_order_id && <p className="text-xs">Pharmacy Order: {tx.pharmacy_order_id}</p>}
                      {tx.error_message && <p className="text-xs text-destructive mt-1">{tx.error_message}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No transmissions yet</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
