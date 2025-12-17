import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Copy, RefreshCw, Plus, Trash2, Webhook, Settings2 } from "lucide-react";
import { toast } from "sonner";

export interface ApiConfigData {
  api_enabled: boolean;
  api_endpoint_url: string;
  api_http_method: string;
  api_auth_type: string;
  api_auth_key_name: string;
  api_retry_count: number;
  api_timeout_seconds: number;
  api_custom_headers: Record<string, string>;
  api_payload_template: Record<string, any> | null;
  inbound_webhook_enabled: boolean;
  inbound_webhook_path: string;
  webhook_secret: string;
  api_status_mapping: Record<string, string>;
}

interface PharmacyApiConfigSectionProps {
  config: ApiConfigData;
  onChange: (config: ApiConfigData) => void;
  isEditing: boolean;
}

const DEFAULT_STATUS_MAPPING: Record<string, string> = {
  "received": "processing",
  "processing": "processing",
  "shipped": "shipped",
  "in_transit": "shipped",
  "out_for_delivery": "shipped",
  "delivered": "delivered",
  "cancelled": "cancelled",
  "returned": "cancelled",
};

const generateWebhookPath = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const generateWebhookSecret = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const PharmacyApiConfigSection = ({ config, onChange, isEditing }: PharmacyApiConfigSectionProps) => {
  const [isApiOpen, setIsApiOpen] = useState(config.api_enabled);
  const [isWebhookOpen, setIsWebhookOpen] = useState(config.inbound_webhook_enabled);
  const [customHeaderKey, setCustomHeaderKey] = useState("");
  const [customHeaderValue, setCustomHeaderValue] = useState("");
  const [statusMappingKey, setStatusMappingKey] = useState("");
  const [statusMappingValue, setStatusMappingValue] = useState("processing");

  const updateConfig = (updates: Partial<ApiConfigData>) => {
    onChange({ ...config, ...updates });
  };

  const handleAddCustomHeader = () => {
    if (!customHeaderKey.trim()) return;
    updateConfig({
      api_custom_headers: {
        ...config.api_custom_headers,
        [customHeaderKey]: customHeaderValue,
      },
    });
    setCustomHeaderKey("");
    setCustomHeaderValue("");
  };

  const handleRemoveCustomHeader = (key: string) => {
    const { [key]: _, ...rest } = config.api_custom_headers;
    updateConfig({ api_custom_headers: rest });
  };

  const handleAddStatusMapping = () => {
    if (!statusMappingKey.trim()) return;
    updateConfig({
      api_status_mapping: {
        ...config.api_status_mapping,
        [statusMappingKey]: statusMappingValue,
      },
    });
    setStatusMappingKey("");
  };

  const handleRemoveStatusMapping = (key: string) => {
    const { [key]: _, ...rest } = config.api_status_mapping;
    updateConfig({ api_status_mapping: rest });
  };

  const copyWebhookUrl = () => {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL || window.location.origin;
    const webhookUrl = `${baseUrl}/functions/v1/receive-pharmacy-webhook/${config.inbound_webhook_path}`;
    navigator.clipboard.writeText(webhookUrl);
    toast.success("Webhook URL copied to clipboard");
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <Label className="text-base font-semibold">API Integration</Label>
        </div>
        <Switch
          checked={config.api_enabled}
          onCheckedChange={(checked) => updateConfig({ api_enabled: checked })}
        />
      </div>
      
      {config.api_enabled && (
        <div className="space-y-4 pt-2">

          {/* Outbound API Configuration */}
          <Collapsible open={isApiOpen} onOpenChange={setIsApiOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                <span className="font-medium">Outbound API Configuration</span>
                {isApiOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              {/* API Endpoint */}
              <div className="space-y-2">
                <Label>API Endpoint URL</Label>
                <Input
                  placeholder="https://pharmacy-api.example.com/orders"
                  value={config.api_endpoint_url}
                  onChange={(e) => updateConfig({ api_endpoint_url: e.target.value })}
                />
              </div>

              {/* HTTP Method */}
              <div className="space-y-2">
                <Label>HTTP Method</Label>
                <Select
                  value={config.api_http_method}
                  onValueChange={(value) => updateConfig({ api_http_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Authentication */}
              <div className="space-y-2">
                <Label>Authentication Type</Label>
                <Select
                  value={config.api_auth_type}
                  onValueChange={(value) => updateConfig({ api_auth_type: value })}
                >
                  <SelectTrigger>
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

              {config.api_auth_type === "api_key" && (
                <div className="space-y-2">
                  <Label>API Key Header Name</Label>
                  <Input
                    placeholder="X-API-Key"
                    value={config.api_auth_key_name}
                    onChange={(e) => updateConfig({ api_auth_key_name: e.target.value })}
                  />
                </div>
              )}

              {/* Custom Headers */}
              <div className="space-y-2">
                <Label>Custom Headers</Label>
                <div className="space-y-2">
                  {Object.entries(config.api_custom_headers || {}).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {key}: {value}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveCustomHeader(key)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Header name"
                      value={customHeaderKey}
                      onChange={(e) => setCustomHeaderKey(e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Value"
                      value={customHeaderValue}
                      onChange={(e) => setCustomHeaderValue(e.target.value)}
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" size="icon" onClick={handleAddCustomHeader}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Payload Template */}
              <div className="space-y-2">
                <Label>Payload Template (JSON)</Label>
                <Textarea
                  placeholder='{"order_id": "{{order_id}}", "patient": {"name": "{{patient_name}}"}}'
                  value={config.api_payload_template ? JSON.stringify(config.api_payload_template, null, 2) : ""}
                  onChange={(e) => {
                    try {
                      const parsed = e.target.value ? JSON.parse(e.target.value) : null;
                      updateConfig({ api_payload_template: parsed });
                    } catch {
                      // Keep as string during editing
                    }
                  }}
                  rows={4}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Use {"{{variable}}"} placeholders. Available: order_id, patient_name, patient_address, product_name, quantity, etc.
                </p>
              </div>

              {/* Retry & Timeout */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Retry Count</Label>
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    value={config.api_retry_count}
                    onChange={(e) => updateConfig({ api_retry_count: parseInt(e.target.value) || 3 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Timeout (seconds)</Label>
                  <Input
                    type="number"
                    min="5"
                    max="120"
                    value={config.api_timeout_seconds}
                    onChange={(e) => updateConfig({ api_timeout_seconds: parseInt(e.target.value) || 30 })}
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Inbound Webhook Configuration */}
          <Collapsible open={isWebhookOpen} onOpenChange={setIsWebhookOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                <span className="flex items-center gap-2">
                  <Webhook className="h-4 w-4" />
                  <span className="font-medium">Inbound Webhook Configuration</span>
                </span>
                {isWebhookOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label>Enable Inbound Webhooks</Label>
                <Switch
                  checked={config.inbound_webhook_enabled}
                  onCheckedChange={(checked) => {
                    updateConfig({
                      inbound_webhook_enabled: checked,
                      inbound_webhook_path: checked && !config.inbound_webhook_path 
                        ? generateWebhookPath() 
                        : config.inbound_webhook_path,
                      webhook_secret: checked && !config.webhook_secret
                        ? generateWebhookSecret()
                        : config.webhook_secret,
                      api_status_mapping: checked && Object.keys(config.api_status_mapping || {}).length === 0
                        ? DEFAULT_STATUS_MAPPING
                        : config.api_status_mapping,
                    });
                  }}
                />
              </div>

              {config.inbound_webhook_enabled && (
                <>
                  {/* Webhook URL */}
                  <div className="space-y-2">
                    <Label>Webhook URL</Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={`${import.meta.env.VITE_SUPABASE_URL || '[SUPABASE_URL]'}/functions/v1/receive-pharmacy-webhook/${config.inbound_webhook_path || '[path]'}`}
                        className="font-mono text-xs bg-muted"
                      />
                      <Button type="button" variant="outline" size="icon" onClick={copyWebhookUrl}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Webhook Path */}
                  <div className="space-y-2">
                    <Label>Webhook Path</Label>
                    <div className="flex gap-2">
                      <Input
                        value={config.inbound_webhook_path}
                        onChange={(e) => updateConfig({ inbound_webhook_path: e.target.value })}
                        className="font-mono"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => updateConfig({ inbound_webhook_path: generateWebhookPath() })}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Webhook Secret */}
                  <div className="space-y-2">
                    <Label>Webhook Secret (for HMAC validation)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        value={config.webhook_secret}
                        onChange={(e) => updateConfig({ webhook_secret: e.target.value })}
                        className="font-mono"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => updateConfig({ webhook_secret: generateWebhookSecret() })}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Status Mapping */}
                  <div className="space-y-2">
                    <Label>Status Mapping</Label>
                    <p className="text-xs text-muted-foreground">
                      Map pharmacy status codes to standard order statuses
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {Object.entries(config.api_status_mapping || {}).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {key} → {value}
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveStatusMapping(key)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Pharmacy status"
                        value={statusMappingKey}
                        onChange={(e) => setStatusMappingKey(e.target.value)}
                        className="flex-1"
                      />
                      <Select value={statusMappingValue} onValueChange={setStatusMappingValue}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">pending</SelectItem>
                          <SelectItem value="processing">processing</SelectItem>
                          <SelectItem value="shipped">shipped</SelectItem>
                          <SelectItem value="delivered">delivered</SelectItem>
                          <SelectItem value="cancelled">cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" onClick={handleAddStatusMapping}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
      
      {!config.api_enabled && (
        <p className="text-xs text-muted-foreground">
          Enable API integration to automatically send orders to this pharmacy's system
        </p>
      )}
    </div>
  );
};
