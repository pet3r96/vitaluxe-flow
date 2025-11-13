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
import { Loader2, CheckCircle, XCircle, AlertCircle, Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface PharmacyApiConfigDialogProps {
  pharmacyId: string;
  pharmacyName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PharmacyApiConfigDialog = ({
  pharmacyId,
  pharmacyName,
  open,
  onOpenChange,
}: PharmacyApiConfigDialogProps) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [diagnosticsResults, setDiagnosticsResults] = useState<any>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Form state
  const [apiEnabled, setApiEnabled] = useState(false);
  const [apiEndpointUrl, setApiEndpointUrl] = useState("");
  const [authType, setAuthType] = useState<string>("none");
  const [authKeyName, setAuthKeyName] = useState("X-API-Key");
  const [apiKey, setApiKey] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [retryCount, setRetryCount] = useState("3");
  const [timeoutSeconds, setTimeoutSeconds] = useState("30");
  

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
      setApiEndpointUrl(data.api_endpoint_url || "");
      setAuthType(data.api_auth_type || "none");
      setAuthKeyName(data.api_auth_key_name || "X-API-Key");
      setWebhookUrl(data.webhook_url || "");
      setWebhookSecret(data.webhook_secret || "");
      setRetryCount(String(data.api_retry_count || 3));
      setTimeoutSeconds(String(data.api_timeout_seconds || 30));

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

    console.log("Loading credentials:", credentials);

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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Update pharmacy config
      const { error: updateError } = await supabase
        .from("pharmacies")
        .update({
          api_enabled: apiEnabled,
          api_endpoint_url: apiEndpointUrl || null,
          api_auth_type: authType,
          api_auth_key_name: authKeyName || null,
          webhook_url: webhookUrl || null,
          webhook_secret: webhookSecret || null,
          api_retry_count: parseInt(retryCount),
          api_timeout_seconds: parseInt(timeoutSeconds),
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

      toast({
        title: "Configuration saved",
        description: "Pharmacy API settings have been updated",
      });

      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving API config:", error);
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
          pharmacy_id: pharmacyId
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
      console.error("Diagnostics error:", error);
      toast({
        title: "Failed to run diagnostics",
        description: error.message || "An error occurred while running diagnostics",
        variant: "destructive",
      });
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
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

        <Tabs defaultValue="config" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="logs">Transmission Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="api-enabled">Enable API Integration</Label>
              <Switch
                id="api-enabled"
                checked={apiEnabled}
                onCheckedChange={setApiEnabled}
              />
            </div>

            {apiEnabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="api-endpoint">API Endpoint URL</Label>
                  <Input
                    id="api-endpoint"
                    placeholder="https://pharmacy-api.example.com/orders"
                    value={apiEndpointUrl}
                    onChange={(e) => setApiEndpointUrl(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="auth-type">Authentication Type</Label>
                  <Select value={authType} onValueChange={setAuthType}>
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
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="webhook-url">Webhook URL (optional - for polling)</Label>
                  <Input
                    id="webhook-url"
                    placeholder="https://pharmacy-api.example.com/tracking"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="webhook-secret">Webhook Secret (optional - for inbound webhooks)</Label>
                  <Input
                    id="webhook-secret"
                    type="password"
                    placeholder="Enter webhook secret for HMAC validation"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                  />
                </div>

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

                  <div className="flex gap-2">
                    <Button
                      onClick={handleTestConnection}
                      disabled={isTesting || !apiEndpointUrl}
                      variant="outline"
                      className="flex-1"
                    >
                      {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Test Connection
                    </Button>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Configuration
              </Button>
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
