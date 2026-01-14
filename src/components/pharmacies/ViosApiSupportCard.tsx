import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Copy, ChevronDown, ChevronRight, Info, Key, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ViosApiSupportCardProps {
  baseUrl?: string;
}

export const ViosApiSupportCard = ({ baseUrl = "https://integrations.vioscompounding.com" }: ViosApiSupportCardProps) => {
  const { toast } = useToast();
  const [endpointsOpen, setEndpointsOpen] = useState(true);
  const [authFlowOpen, setAuthFlowOpen] = useState(false);
  const [curlOpen, setCurlOpen] = useState(false);

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
    } catch {
      toast({
        title: "Failed to copy",
        description: "Please copy manually",
        variant: "destructive",
      });
    }
  };

  const tokenCurl = `curl -X POST ${baseUrl}/api/auth/token \\
  -H "Content-Type: application/json" \\
  -H "ClientId: YOUR_CLIENT_ID" \\
  -H "ClientSecret: YOUR_CLIENT_SECRET"`;

  const orderCurl = `curl -X POST ${baseUrl}/api/orders \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -d '{
    "general": { "referenceId": "TEST-001", "isTestOrder": true },
    "prescriber": { "npi": "1234567890", "firstName": "Test", "lastName": "Prescriber" },
    "patient": { "firstName": "Test", "lastName": "Patient", "gender": "u", "dateOfBirth": "1990-01-01" },
    "shipping": { "addressLine1": "123 Test St", "city": "Test City", "state": "CA", "zipCode": "90210", "service": 7623 },
    "rxs": [{ "rxType": "new", "lfProductId": 12345, "quantity": "30", "directions": "Take as directed" }]
  }'`;

  return (
    <div className="space-y-3">
      {/* Supported Endpoints */}
      <Collapsible open={endpointsOpen} onOpenChange={setEndpointsOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full p-3 border rounded-lg hover:bg-muted/50 transition-colors text-left">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Supported Endpoints</span>
            </div>
            {endpointsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="p-3 border rounded-lg bg-muted/20 space-y-3">
            {/* Orders */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs">/orders</Badge>
                <span className="text-xs text-muted-foreground">Create, Get, Cancel orders</span>
              </div>
              <ul className="text-xs text-muted-foreground ml-4 space-y-0.5">
                <li><code className="bg-muted px-1 rounded">POST /api/orders</code> – Create new order</li>
                <li><code className="bg-muted px-1 rounded">GET /api/orders</code> – List/search orders</li>
                <li><code className="bg-muted px-1 rounded">DELETE /api/orders/{'{id}'}/cancel</code> – Cancel order</li>
              </ul>
            </div>

            {/* Refills */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs">/refills</Badge>
                <span className="text-xs text-muted-foreground">Process refill requests</span>
              </div>
              <ul className="text-xs text-muted-foreground ml-4 space-y-0.5">
                <li><code className="bg-muted px-1 rounded">POST /api/orders/refill</code> – Submit refill request</li>
              </ul>
            </div>

            {/* Shipping */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs">/shipping</Badge>
                <span className="text-xs text-muted-foreground">Track shipping updates</span>
              </div>
              <ul className="text-xs text-muted-foreground ml-4 space-y-0.5">
                <li><code className="bg-muted px-1 rounded">PUT /api/orders/{'{id}'}/shipping</code> – Update shipping info</li>
              </ul>
            </div>

            {/* Lookups */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs">/lookups</Badge>
                <span className="text-xs text-muted-foreground">Reference data</span>
              </div>
              <ul className="text-xs text-muted-foreground ml-4 space-y-0.5">
                <li><code className="bg-muted px-1 rounded">GET /api/allergies</code> – Allergy list</li>
                <li className="text-muted-foreground/60 italic">Products: Catalog is managed internally (not a VIOS endpoint)</li>
              </ul>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Bearer Token Flow */}
      <Collapsible open={authFlowOpen} onOpenChange={setAuthFlowOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full p-3 border rounded-lg hover:bg-muted/50 transition-colors text-left">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Authentication Flow</span>
            </div>
            {authFlowOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="p-3 border rounded-lg bg-muted/20 space-y-3">
            {/* Step 1: Token Exchange */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/10 text-primary hover:bg-primary/20 text-xs">Step 1</Badge>
                <span className="text-sm font-medium">Token Exchange</span>
              </div>
              <div className="ml-4 text-xs space-y-1">
                <p>Endpoint: <code className="bg-muted px-1 rounded">POST /api/auth/token</code></p>
                <p>Required Headers:</p>
                <ul className="ml-4 list-disc">
                  <li><code className="bg-muted px-1 rounded">ClientId: &lt;your_client_id&gt;</code></li>
                  <li><code className="bg-muted px-1 rounded">ClientSecret: &lt;your_client_secret&gt;</code></li>
                </ul>
                <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-amber-700 dark:text-amber-400 flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
                  <span><strong>Important:</strong> Do NOT include <code>Authorization: Bearer</code> header for token requests. The portal's example curl includes a trace ID there – ignore it.</span>
                </div>
              </div>
            </div>

            {/* Step 2: API Calls */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/10 text-primary hover:bg-primary/20 text-xs">Step 2</Badge>
                <span className="text-sm font-medium">API Calls</span>
              </div>
              <div className="ml-4 text-xs space-y-1">
                <p>For all subsequent API calls, include:</p>
                <p><code className="bg-muted px-1 rounded">Authorization: Bearer &lt;accessToken&gt;</code></p>
              </div>
            </div>

            {/* Token TTL Note */}
            <div className="text-xs text-muted-foreground border-t pt-2">
              <strong>Token TTL:</strong> Access tokens expire after ~15 minutes. Our system caches tokens for 14 minutes to ensure refresh before expiry.
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Curl Examples */}
      <Collapsible open={curlOpen} onOpenChange={setCurlOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full p-3 border rounded-lg hover:bg-muted/50 transition-colors text-left">
            <div className="flex items-center gap-2">
              <Copy className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Curl Examples</span>
            </div>
            {curlOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="space-y-3">
            {/* Token Request */}
            <div className="p-3 border rounded-lg bg-muted/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">Token Request (no Authorization header)</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => handleCopy(tokenCurl, "Token curl")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap">
                {tokenCurl}
              </pre>
            </div>

            {/* Order Request */}
            <div className="p-3 border rounded-lg bg-muted/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">Create Test Order</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => handleCopy(orderCurl, "Order curl")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap">
                {orderCurl}
              </pre>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
