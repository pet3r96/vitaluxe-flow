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
import { ViosApiSupportCard } from "./ViosApiSupportCard";
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
  const [isSendingTestOrder, setIsSendingTestOrder] = useState(false);
  const [testOrderResult, setTestOrderResult] = useState<any>(null);
  const [showTestOrderResult, setShowTestOrderResult] = useState(false);
  
  // Collapsible section states
  const [outboundOpen, setOutboundOpen] = useState(true);
  const [inboundOpen, setInboundOpen] = useState(true);

  // Form state
  const [apiEnabled, setApiEnabled] = useState(false);
  const [apiTestMode, setApiTestMode] = useState(true); // Sandbox by default
  const [apiHandlerType, setApiHandlerType] = useState<string>("generic");
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
  
  // VIOS-specific state
  const [viosBaseUrl, setViosBaseUrl] = useState("https://integrations.vioscompounding.com");
  const [viosClientKey, setViosClientKey] = useState("");
  const [viosClientSecret, setViosClientSecret] = useState("");
  

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
      // Default to 'generic' if no handler type or if it was 'none'
      const handlerType = data.api_handler_type;
      setApiHandlerType(handlerType && handlerType !== 'none' ? handlerType : "generic");
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
      
      // Set VIOS base URL if handler is VIOS
      if (handlerType === 'vios' && data.api_endpoint_url) {
        setViosBaseUrl(data.api_endpoint_url);
      }

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

  // Parse credentials with proper error handling
  useEffect(() => {
    if (!credentials || credentials.length === 0) return;

    logger.info('Loading credentials', { count: credentials.length });

    credentials.forEach((cred) => {
      if (cred.credential_type === "api_key" || cred.credential_type === "bearer_token") {
        setApiKey(cred.credential_key || "");
      } else if (cred.credential_type === "vios_client_key") {
        setViosClientKey(cred.credential_key || "");
      } else if (cred.credential_type === "vios_client_secret") {
        setViosClientSecret(cred.credential_key || "");
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
      toast({
        title: "Copied!",
        description: "Webhook URL copied to clipboard",
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please copy the URL manually",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!isAdmin) {
      toast({
        title: "Permission denied",
        description: "Only administrators can modify API settings",
        variant: "destructive",
      });
      return;
    }
    
    setIsSaving(true);
    try {
      // Update pharmacy config
      const { error: updateError } = await supabase
        .from("pharmacies")
        .update({
          api_enabled: apiEnabled,
          api_test_mode: apiTestMode,
          api_handler_type: apiHandlerType,
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

      // Save API credentials if provided
      if (apiKey && authType !== "none") {
        const credentialType = authType === "bearer" ? "bearer_token" : "api_key";
        
        const { error: credError } = await supabase
          .from("pharmacy_api_credentials")
          .upsert({
            pharmacy_id: pharmacyId,
            credential_type: credentialType,
            credential_key: apiKey,
          }, {
            onConflict: "pharmacy_id,credential_type",
          });

        if (credError) throw credError;
      }

      // Save VIOS credentials if VIOS handler type
      if (apiHandlerType === 'vios') {
        // Save VIOS client key
        if (viosClientKey) {
          const { error: viosKeyError } = await supabase
            .from("pharmacy_api_credentials")
            .upsert({
              pharmacy_id: pharmacyId,
              credential_type: "vios_client_key",
              credential_key: viosClientKey,
            }, {
              onConflict: "pharmacy_id,credential_type",
            });
          if (viosKeyError) throw viosKeyError;
        }

        // Save VIOS client secret
        if (viosClientSecret) {
          const { error: viosSecretError } = await supabase
            .from("pharmacy_api_credentials")
            .upsert({
              pharmacy_id: pharmacyId,
              credential_type: "vios_client_secret",
              credential_key: viosClientSecret,
            }, {
              onConflict: "pharmacy_id,credential_type",
            });
          if (viosSecretError) throw viosSecretError;
        }

        // Save VIOS base URL in the api_endpoint_url field
        const { error: urlError } = await supabase
          .from("pharmacies")
          .update({ api_endpoint_url: viosBaseUrl })
          .eq("id", pharmacyId);
        if (urlError) throw urlError;
      }

      toast({
        title: "Configuration saved",
        description: "Pharmacy API settings have been updated",
      });

      // Invalidate the table query to refresh data
      await queryClient.invalidateQueries({ queryKey: ["pharmacies-api-config"] });

      onOpenChange(false);
    } catch (error: any) {
      logger.error('Error saving API config', error);
      toast({
        title: "Error saving configuration",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!apiEndpointUrl) {
      toast({
        title: "Missing endpoint URL",
        description: "Please enter an API endpoint URL",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    try {
      // Build test headers
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (authType === "bearer" && apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      } else if (authType === "api_key" && apiKey) {
        headers[authKeyName] = apiKey;
      }

      const response = await fetch(apiEndpointUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ test: true }),
      });

      if (response.ok) {
        toast({
          title: "Connection successful",
          description: `Connected to ${apiEndpointUrl}`,
        });
      } else {
        toast({
          title: "Connection failed",
          description: `HTTP ${response.status}: ${await response.text()}`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Connection error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleRunDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    setDiagnosticsResults(null);
    
    try {
      const { data, error } = await supabase.functions.invoke("pharmacy-api-diagnostics", {
        body: {
          pharmacy_id: pharmacyId,
          include_vios_token_test: apiHandlerType === 'vios'
        }
      });

      if (error) throw error;

      setDiagnosticsResults(data);
      setShowDiagnostics(true);

      if (data?.success) {
        toast({
          title: "Diagnostics passed ✓",
          description: "All checks passed. You can now send a test order.",
        });
      } else {
        toast({
          title: "Diagnostics found issues",
          description: "Please review the results below and fix any errors.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      logger.error('Diagnostics error', error);
      toast({
        title: "Failed to run diagnostics",
        description: error.message || "An error occurred while running diagnostics",
        variant: "destructive",
      });
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  const handleSendTestOrder = async () => {
    setIsSendingTestOrder(true);
    setTestOrderResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke("pharmacy-test-order", {
        body: {
          pharmacy_id: pharmacyId
        }
      });

      if (error) throw error;

      setTestOrderResult(data);
      setShowTestOrderResult(true);

      if (data?.success) {
        toast({
          title: "Test Order Sent ✓",
          description: `VIOS Order ID: ${data.viosOrderId || 'N/A'}`,
        });
      } else {
        toast({
          title: "Test Order Failed",
          description: data?.error || "Failed to send test order",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      logger.error('Test order error', error);
      setTestOrderResult({ success: false, error: error.message });
      setShowTestOrderResult(true);
      toast({
        title: "Failed to send test order",
        description: error.message || "An error occurred while sending test order",
        variant: "destructive",
      });
    } finally {
      setIsSendingTestOrder(false);
    }
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Loading API Configuration...</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
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
                <AlertDescription>
                  Only administrators can modify API settings. You are viewing in read-only mode.
                </AlertDescription>
              </Alert>
            )}
            
            {/* API Integration Toggle */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div className="space-y-0.5">
                <Label htmlFor="api-enabled" className="text-base font-medium">API Integration</Label>
                <p className="text-sm text-muted-foreground">Enable API communication with this pharmacy</p>
              </div>
              <Switch
                id="api-enabled"
                checked={apiEnabled}
                onCheckedChange={setApiEnabled}
                disabled={!isAdmin}
              />
            </div>

            {apiEnabled && (
              <>
                {/* Environment Toggle */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Environment</Label>
                  <div className="flex rounded-lg border p-1 bg-muted/30">
                    <button
                      type="button"
                      onClick={() => isAdmin && setApiTestMode(true)}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        apiTestMode 
                          ? 'bg-background shadow-sm text-foreground' 
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      disabled={!isAdmin}
                    >
                      <FlaskConical className="h-4 w-4" />
                      Sandbox
                    </button>
                    <button
                      type="button"
                      onClick={() => isAdmin && setApiTestMode(false)}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        !apiTestMode 
                          ? 'bg-background shadow-sm text-foreground' 
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      disabled={!isAdmin}
                    >
                      <Zap className="h-4 w-4" />
                      Production
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {apiTestMode 
                      ? "Orders will be marked as test orders and won't be processed." 
                      : "Orders will be processed as real transactions."}
                  </p>
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
                      <Label htmlFor="api-handler-type">API Integration Type</Label>
                      <Select 
                        value={apiHandlerType} 
                        onValueChange={setApiHandlerType}
                        disabled={!isAdmin}
                      >
                        <SelectTrigger id="api-handler-type">
                          <SelectValue placeholder="Select integration type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="generic">Generic - Single Endpoint</SelectItem>
                          <SelectItem value="vios">VIOS - Multi-Endpoint</SelectItem>
                          <SelectItem value="custom">Custom Handler</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {apiHandlerType === 'generic' && 'Single endpoint configuration for standard pharmacy APIs'}
                        {apiHandlerType === 'vios' && 'Multi-endpoint support for VIOS (Orders, Refills, Shipping, Lookups)'}
                        {apiHandlerType === 'custom' && 'Custom handler for pharmacy-specific integrations'}
                      </p>
                    </div>

                    {apiHandlerType === 'vios' && (
                      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                        <p className="text-sm font-medium">VIOS API Configuration</p>
                        
                        <div className="space-y-2">
                          <Label htmlFor="vios-base-url">VIOS Base URL</Label>
                          <Input
                            id="vios-base-url"
                            placeholder="https://integrations.vioscompounding.com"
                            value={viosBaseUrl}
                            onChange={(e) => setViosBaseUrl(e.target.value.replace(/\/+$/, ''))}
                            disabled={!isAdmin}
                          />
                          {viosBaseUrl && !viosBaseUrl.includes('vioscompounding.com') && (
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                              ⚠️ Expected domain: vioscompounding.com
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Production: https://integrations.vioscompounding.com
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="vios-client-key">Client ID</Label>
                          <Input
                            id="vios-client-key"
                            placeholder="Enter VIOS Client ID"
                            value={viosClientKey}
                            onChange={(e) => setViosClientKey(e.target.value)}
                            disabled={!isAdmin}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="vios-client-secret">Client Secret</Label>
                          <Input
                            id="vios-client-secret"
                            type="password"
                            placeholder="Enter VIOS Client Secret"
                            value={viosClientSecret}
                            onChange={(e) => setViosClientSecret(e.target.value)}
                            disabled={!isAdmin}
                          />
                        </div>

                        {/* VIOS API Support Card with endpoints, auth flow, and curl examples */}
                        <ViosApiSupportCard baseUrl={viosBaseUrl || "https://integrations.vioscompounding.com"} />
                      </div>
                    )}

                    {(apiHandlerType === 'generic' || apiHandlerType === 'custom') && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="api-endpoint">API Endpoint URL</Label>
                          <Input
                            id="api-endpoint"
                            placeholder="https://pharmacy-api.example.com/orders"
                            value={apiEndpointUrl}
                            onChange={(e) => setApiEndpointUrl(e.target.value)}
                            disabled={!isAdmin}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="auth-type">Authentication Type</Label>
                          <Select value={authType} onValueChange={setAuthType} disabled={!isAdmin}>
                            <SelectTrigger id="auth-type">
                              <SelectValue />
                            </SelectTrigger>
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
                            <Input
                              id="auth-key-name"
                              placeholder="X-API-Key"
                              value={authKeyName}
                              onChange={(e) => setAuthKeyName(e.target.value)}
                              disabled={!isAdmin}
                            />
                          </div>
                        )}

                        {authType !== "none" && (
                          <div className="space-y-2">
                            <Label htmlFor="api-key">
                              {authType === "bearer" ? "Bearer Token" : "API Key"}
                            </Label>
                            <Input
                              id="api-key"
                              type="password"
                              placeholder="Enter API key or token"
                              value={apiKey}
                              onChange={(e) => setApiKey(e.target.value)}
                              disabled={!isAdmin}
                            />
                          </div>
                        )}
                      </>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="retry-count">Retry Count</Label>
                        <Input
                          id="retry-count"
                          type="number"
                          min="0"
                          max="10"
                          value={retryCount}
                          onChange={(e) => setRetryCount(e.target.value)}
                          disabled={!isAdmin}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="timeout">Timeout (seconds)</Label>
                        <Input
                          id="timeout"
                          type="number"
                          min="5"
                          max="120"
                          value={timeoutSeconds}
                          onChange={(e) => setTimeoutSeconds(e.target.value)}
                          disabled={!isAdmin}
                        />
                      </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t">
                      <Button
                        onClick={handleRunDiagnostics}
                        disabled={isRunningDiagnostics}
                        variant="outline"
                        className="w-full"
                      >
                        {isRunningDiagnostics && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Activity className="mr-2 h-4 w-4" />
                        Run Diagnostics
                      </Button>

                      {diagnosticsResults && (
                        <Collapsible open={showDiagnostics} onOpenChange={setShowDiagnostics}>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" className="w-full justify-between">
                              <span className="flex items-center gap-2">
                                {diagnosticsResults.success ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-destructive" />
                                )}
                                Diagnostics Results
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {showDiagnostics ? "Hide" : "Show"}
                              </span>
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-2 mt-2">
                            {diagnosticsResults.results?.map((result: any, idx: number) => (
                              <div
                                key={idx}
                                className="p-3 border rounded-md text-sm space-y-1"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{result.step}</span>
                                  {result.status === "success" && (
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                  )}
                                  {result.status === "warning" && (
                                    <AlertCircle className="h-4 w-4 text-amber-500" />
                                  )}
                                  {result.status === "error" && (
                                    <XCircle className="h-4 w-4 text-destructive" />
                                  )}
                                </div>
                                <p className="text-muted-foreground">{result.message}</p>
                                {result.details && (
                                  <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                                    {JSON.stringify(result.details, null, 2)}
                                  </pre>
                                )}
                              </div>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {(apiHandlerType === 'generic' || apiHandlerType === 'custom') && (
                        <Button
                          onClick={handleTestConnection}
                          disabled={isTesting || !apiEndpointUrl}
                          variant="outline"
                          className="w-full"
                        >
                          {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Test Connection
                        </Button>
                      )}

                      {apiHandlerType === 'vios' && diagnosticsResults?.success && (
                        <>
                          <Button
                            onClick={handleSendTestOrder}
                            disabled={isSendingTestOrder}
                            variant="default"
                            className="w-full"
                          >
                            {isSendingTestOrder && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <FlaskConical className="mr-2 h-4 w-4" />
                            Send Test Order to VIOS
                          </Button>

                          {testOrderResult && (
                            <Collapsible open={showTestOrderResult} onOpenChange={setShowTestOrderResult}>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" className="w-full justify-between">
                                  <span className="flex items-center gap-2">
                                    {testOrderResult.success ? (
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-destructive" />
                                    )}
                                    Test Order Result
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {showTestOrderResult ? "Hide" : "Show"}
                                  </span>
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="mt-2 p-3 border rounded-md text-sm space-y-2">
                                {testOrderResult.success ? (
                                  <>
                                    <p className="text-green-600 font-medium">✓ Test order sent successfully</p>
                                    {testOrderResult.viosOrderId && (
                                      <p><span className="text-muted-foreground">VIOS Order ID:</span> <code className="bg-muted px-1 rounded">{testOrderResult.viosOrderId}</code></p>
                                    )}
                                    {testOrderResult.referenceId && (
                                      <p><span className="text-muted-foreground">Reference ID:</span> <code className="bg-muted px-1 rounded">{testOrderResult.referenceId}</code></p>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <p className="text-destructive font-medium">✗ Test order failed</p>
                                    <p className="text-muted-foreground">{testOrderResult.error}</p>
                                  </>
                                )}
                                {testOrderResult.details && (
                                  <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-x-auto max-h-48">
                                    {JSON.stringify(testOrderResult.details, null, 2)}
                                  </pre>
                                )}
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                        </>
                      )}
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
                          <p className="font-medium">Inbound Webhook Configuration</p>
                          <p className="text-sm text-muted-foreground">Receive status updates from pharmacy</p>
                        </div>
                      </div>
                      {inboundOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-4">
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                      <div className="space-y-0.5">
                        <Label htmlFor="inbound-webhook-enabled" className="font-medium">Enable Inbound Webhooks</Label>
                        <p className="text-xs text-muted-foreground">Allow pharmacy to send status updates</p>
                      </div>
                      <Switch
                        id="inbound-webhook-enabled"
                        checked={inboundWebhookEnabled}
                        onCheckedChange={setInboundWebhookEnabled}
                        disabled={!isAdmin}
                      />
                    </div>

                    {inboundWebhookEnabled && inboundWebhookPath && (
                      <>
                        <div className="space-y-2">
                          <Label>Webhook URL</Label>
                          <div className="flex gap-2 min-w-0">
                            <Input
                              value={getInboundWebhookUrl() || ''}
                              readOnly
                              className="font-mono text-xs bg-muted truncate min-w-0 flex-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={handleCopyWebhookUrl}
                              title="Copy to clipboard"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Configure this URL in the pharmacy's webhook settings
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="webhook-secret-inbound">Webhook Secret (optional)</Label>
                          <Input
                            id="webhook-secret-inbound"
                            type="password"
                            placeholder="Enter webhook secret for HMAC validation"
                            value={webhookSecret}
                            onChange={(e) => setWebhookSecret(e.target.value)}
                            disabled={!isAdmin}
                          />
                          <p className="text-xs text-muted-foreground">
                            Used to validate webhook authenticity if the pharmacy supports it
                          </p>
                        </div>

                        {/* Status Mapping Display */}
                        {Object.keys(apiStatusMapping).length > 0 && (
                          <div className="space-y-2">
                            <Label>Status Mapping</Label>
                            <div className="border rounded-lg overflow-hidden">
                              <table className="w-full text-sm">
                                <thead className="bg-muted/50">
                                  <tr>
                                    <th className="text-left px-3 py-2 font-medium">Pharmacy Status</th>
                                    <th className="text-left px-3 py-2 font-medium">Internal Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(apiStatusMapping).map(([pharmaStatus, internalStatus]) => (
                                    <tr key={pharmaStatus} className="border-t">
                                      <td className="px-3 py-2 font-mono text-xs">{pharmaStatus}</td>
                                      <td className="px-3 py-2">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                          {internalStatus}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Events Info for VIOS */}
                        {apiHandlerType === 'vios' && (
                          <div className="p-3 bg-muted/30 rounded-lg border">
                            <p className="text-xs font-medium mb-2">Events to Subscribe (VIOS Portal):</p>
                            <ul className="text-xs text-muted-foreground space-y-1">
                              <li className="flex items-center gap-2">
                                <CheckCircle className="h-3 w-3 text-green-500" />
                                Order status changes
                              </li>
                              <li className="flex items-center gap-2">
                                <CheckCircle className="h-3 w-3 text-green-500" />
                                Shipping updates with tracking
                              </li>
                              <li className="flex items-center gap-2">
                                <CheckCircle className="h-3 w-3 text-green-500" />
                                Delivery confirmations
                              </li>
                            </ul>
                          </div>
                        )}
                      </>
                    )}

                    {inboundWebhookEnabled && !inboundWebhookPath && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Webhook path not configured. Please contact support to set up the webhook endpoint for this pharmacy.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {isAdmin ? 'Cancel' : 'Close'}
              </Button>
              {isAdmin && (
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Configuration
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {transmissions && transmissions.length > 0 ? (
                transmissions.map((log) => (
                  <Collapsible key={log.id}>
                    <div className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">
                              {log.transmission_type.toUpperCase()}
                            </span>
                            {log.success ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-destructive" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(log.transmitted_at).toLocaleString()}
                          </div>
                        </div>
                        {log.response_status && (
                          <div className={`px-2 py-1 rounded text-xs font-medium ${
                            log.success ? 'bg-green-100 text-green-700' : 'bg-destructive/10 text-destructive'
                          }`}>
                            {log.response_status}
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground truncate">
                        {log.api_endpoint}
                      </div>

                      {log.error_message && (
                        <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive">
                          <span className="font-medium">Error:</span> {log.error_message}
                        </div>
                      )}

                      {log.retry_count > 0 && (
                        <div className="flex items-center gap-2 text-xs text-amber-600">
                          <AlertCircle className="h-3 w-3" />
                          Retried {log.retry_count} time{log.retry_count > 1 ? 's' : ''}
                        </div>
                      )}

                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full justify-between h-8 mt-2">
                          <span className="text-xs">View Details</span>
                          <span className="text-xs text-muted-foreground">▼</span>
                        </Button>
                      </CollapsibleTrigger>

                      <CollapsibleContent className="space-y-3 pt-2">
                        <div>
                          <div className="text-xs font-medium mb-1 flex items-center gap-2">
                            <span>Transmission ID:</span>
                            <code className="text-xs bg-muted px-1 py-0.5 rounded">{log.id}</code>
                          </div>
                        </div>
                        {log.order_line_id && (
                          <div>
                            <div className="text-xs font-medium mb-1">Order Line ID:</div>
                            <code className="text-xs bg-muted px-2 py-1 rounded block">{log.order_line_id}</code>
                          </div>
                        )}
                        {log.pharmacy_order_id && (
                          <div>
                            <div className="text-xs font-medium mb-1">Pharmacy Order ID:</div>
                            <code className="text-xs bg-muted px-2 py-1 rounded block">{log.pharmacy_order_id}</code>
                          </div>
                        )}
                        <div>
                          <div className="text-xs font-medium mb-1">Full Endpoint:</div>
                          <code className="text-xs bg-muted px-2 py-1 rounded block break-all">{log.api_endpoint}</code>
                        </div>
                        {log.manually_retried && (
                          <div className="flex items-center gap-2 text-xs text-blue-600">
                            <AlertCircle className="h-3 w-3" />
                            This transmission was manually retried
                          </div>
                        )}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No transmission logs yet
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
