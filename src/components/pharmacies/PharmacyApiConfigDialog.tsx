import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, Send } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

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
  const [isSendingTest, setIsSendingTest] = useState(false);

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
  
  // BareMeds-specific fields
  const [baremedEmail, setBaremedEmail] = useState("");
  const [baremedPassword, setBaremedPassword] = useState("");
  const [baremedSiteId, setBaremedSiteId] = useState("");
  const [baremedBaseUrl, setBaremedBaseUrl] = useState("https://staging-rxorders.baremeds.com");

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

      // Load credentials into form state
      if (data && data.length > 0) {
        data.forEach((cred) => {
          if (cred.credential_type === "baremeds_oauth") {
            try {
              const baremedsCreds = JSON.parse(cred.credential_key);
              setBaremedEmail(baremedsCreds.email || "");
              setBaremedPassword(baremedsCreds.password || "");
              setBaremedSiteId(String(baremedsCreds.site_id || ""));
              setBaremedBaseUrl(baremedsCreds.base_url || "https://staging-rxorders.baremeds.com");
            } catch (e) {
              console.error("Failed to parse BareMeds credentials:", e);
            }
          } else if (cred.credential_type === "api_key" || cred.credential_type === "bearer_token") {
            setApiKey(cred.credential_key || "");
          }
        });
      }

      return data;
    },
    enabled: open && !!pharmacyId,
  });

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
      if (authType === "baremeds" && baremedEmail && baremedPassword && baremedSiteId) {
        // Store BareMeds credentials as JSON
        const baremedsCreds = {
          email: baremedEmail,
          password: baremedPassword,
          site_id: parseInt(baremedSiteId),
          base_url: baremedBaseUrl || "https://staging-rxorders.baremeds.com"
        };

        const { error: credError } = await supabase
          .from("pharmacy_api_credentials")
          .upsert({
            pharmacy_id: pharmacyId,
            credential_type: "baremeds_oauth",
            credential_key: JSON.stringify(baremedsCreds),
          }, {
            onConflict: "pharmacy_id,credential_type",
          });

        if (credError) throw credError;
      } else if (apiKey && authType !== "none" && authType !== "baremeds") {
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
    if (authType === "baremeds") {
      // Test BareMeds login
      if (!baremedEmail || !baremedPassword || !baremedSiteId) {
        toast({
          title: "Missing BareMeds credentials",
          description: "Please fill in all BareMeds fields",
          variant: "destructive",
        });
        return;
      }

      setIsTesting(true);
      try {
        const { data, error } = await supabase.functions.invoke("baremeds-get-token", {
          body: {
            credentials: {
              email: baremedEmail,
              password: baremedPassword,
              site_id: parseInt(baremedSiteId),
              base_url: baremedBaseUrl || "https://staging-rxorders.baremeds.com"
            }
          }
        });

        if (error) throw error;

        if (data?.token) {
          toast({
            title: "BareMeds login successful",
            description: `Token: ${data.token.substring(0, 10)}...${data.token.substring(data.token.length - 10)}. When orders are sent, BareMeds will return an order ID that we'll capture and store.`,
          });
        } else {
          throw new Error("No token received from BareMeds");
        }
      } catch (error: any) {
        toast({
          title: "BareMeds login failed",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setIsTesting(false);
      }
      return;
    }

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

  const handleSendTestOrder = async () => {
    setIsSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("test-pharmacy-api", {
        body: {
          pharmacy_id: pharmacyId
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Test order sent successfully",
          description: `Test order ${data.test_order_id} was sent to the pharmacy API. ${data.pharmacy_order_id ? `Pharmacy returned ID: ${data.pharmacy_order_id}` : 'Check pharmacy system for TEST-ORD-* orders.'}`,
        });
      } else {
        throw new Error(data?.error || "Failed to send test order");
      }
    } catch (error: any) {
      console.error("Test order error:", error);
      toast({
        title: "Failed to send test order",
        description: error.message || "An error occurred while sending the test order",
        variant: "destructive",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
                      <SelectItem value="baremeds">BareMeds OAuth</SelectItem>
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

                {authType === "baremeds" ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="baremeds-base-url">BareMeds Base URL</Label>
                      <Input
                        id="baremeds-base-url"
                        placeholder="https://staging-rxorders.baremeds.com"
                        value={baremedBaseUrl}
                        onChange={(e) => setBaremedBaseUrl(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="baremeds-email">BareMeds Email</Label>
                      <Input
                        id="baremeds-email"
                        type="email"
                        placeholder="your-email@example.com"
                        value={baremedEmail}
                        onChange={(e) => setBaremedEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="baremeds-password">BareMeds Password</Label>
                      <Input
                        id="baremeds-password"
                        type="password"
                        placeholder="Enter BareMeds password"
                        value={baremedPassword}
                        onChange={(e) => setBaremedPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="baremeds-site-id">BareMeds Site ID</Label>
                      <Input
                        id="baremeds-site-id"
                        type="number"
                        placeholder="98923"
                        value={baremedSiteId}
                        onChange={(e) => setBaremedSiteId(e.target.value)}
                      />
                    </div>
                  </>
                ) : authType !== "none" && (
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

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    onClick={handleTestConnection}
                    disabled={isTesting || (authType !== "baremeds" && !apiEndpointUrl) || (authType === "baremeds" && (!baremedEmail || !baremedPassword || !baremedSiteId))}
                    variant="outline"
                    className="flex-1"
                  >
                    {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Test Connection
                  </Button>
                  <Button
                    onClick={handleSendTestOrder}
                    disabled={isSendingTest || (authType !== "baremeds" && !apiEndpointUrl) || (authType === "baremeds" && (!baremedEmail || !baremedPassword || !baremedSiteId))}
                    variant="secondary"
                    className="flex-1"
                    title="Sends a complete test order to verify full integration"
                  >
                    {isSendingTest && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Send className="mr-2 h-4 w-4" />
                    Send Test Order
                  </Button>
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
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {transmissions && transmissions.length > 0 ? (
                transmissions.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 border rounded-md space-y-1 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {log.transmission_type.toUpperCase()}
                      </span>
                      <div className="flex items-center gap-2">
                        {log.success ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        <span className="text-muted-foreground">
                          {new Date(log.transmitted_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="text-muted-foreground">
                      Endpoint: {log.api_endpoint}
                    </div>
                    {log.response_status && (
                      <div className="text-muted-foreground">
                        Status: {log.response_status}
                      </div>
                    )}
                    {log.error_message && (
                      <div className="text-destructive">
                        Error: {log.error_message}
                      </div>
                    )}
                    {log.retry_count > 0 && (
                      <div className="text-muted-foreground">
                        Retries: {log.retry_count}
                      </div>
                    )}
                  </div>
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
