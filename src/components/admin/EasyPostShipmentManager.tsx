import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const EasyPostShipmentManager = () => {
  const [testMode, setTestMode] = useState<'order' | 'manual'>('order');
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [manualTrackingCode, setManualTrackingCode] = useState("");
  const [trackingResult, setTrackingResult] = useState<any>(null);
  const [isTestingTracking, setIsTestingTracking] = useState(false);

  // Fetch orders with tracking numbers
  const { data: ordersWithTracking } = useQuery({
    queryKey: ["orders-with-tracking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_lines")
        .select(`
          id,
          tracking_number,
          patient_name,
          status
        `)
        .not("tracking_number", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
  });

  const testTracking = async () => {
    setIsTestingTracking(true);
    setTrackingResult(null);
    
    try {
      let trackingCode = "";
      
      if (testMode === 'manual') {
        trackingCode = manualTrackingCode.trim();
        if (!trackingCode) {
          toast.error("Please enter a tracking code");
          setIsTestingTracking(false);
          return;
        }
      } else {
        const selectedOrder = ordersWithTracking?.find(o => o.id === selectedOrderId);
        if (!selectedOrder || !selectedOrder.tracking_number) {
          toast.error("Please select an order with a tracking number");
          setIsTestingTracking(false);
          return;
        }
        trackingCode = selectedOrder.tracking_number;
      }

      const { data, error } = await supabase.functions.invoke('get-easypost-tracking', {
        body: { tracking_code: trackingCode }
      });

      if (error) throw error;

      setTrackingResult(data);
      toast.success("Tracking information retrieved successfully!");
    } catch (error: any) {
      console.error('Tracking test error:', error);
      toast.error(`Tracking test failed: ${error.message}`);
      setTrackingResult({ error: error.message });
    } finally {
      setIsTestingTracking(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      delivered: { variant: "default", label: "Delivered" },
      in_transit: { variant: "secondary", label: "In Transit" },
      pre_transit: { variant: "outline", label: "Pre-Transit" },
      out_for_delivery: { variant: "secondary", label: "Out for Delivery" },
      returned: { variant: "destructive", label: "Returned" },
      failure: { variant: "destructive", label: "Failed" },
      unknown: { variant: "outline", label: "Unknown" },
    };

    const config = statusMap[status] || statusMap.unknown;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">EasyPost Tracking Tester</h2>
        <p className="text-muted-foreground">Test tracking API with existing orders or manual tracking codes</p>
      </div>

      {/* Mode Selection Card */}
      <Card>
        <CardHeader>
          <CardTitle>Test Tracking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toggle between Order Selection and Manual Entry */}
          <div className="flex gap-2">
            <Button
              variant={testMode === 'order' ? 'default' : 'outline'}
              onClick={() => setTestMode('order')}
            >
              <Package className="h-4 w-4 mr-2" />
              Select Order
            </Button>
            <Button
              variant={testMode === 'manual' ? 'default' : 'outline'}
              onClick={() => setTestMode('manual')}
            >
              <Search className="h-4 w-4 mr-2" />
              Manual Entry
            </Button>
          </div>

          {/* Order Selection Mode */}
          {testMode === 'order' && (
            <div className="space-y-2">
              <Label htmlFor="order-select">Select Order with Tracking</Label>
              <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an order..." />
                </SelectTrigger>
                <SelectContent>
                  {ordersWithTracking && ordersWithTracking.length > 0 ? (
                    ordersWithTracking.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.patient_name} - {order.tracking_number}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>No orders with tracking found</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {selectedOrderId && (
                <div className="text-sm text-muted-foreground">
                  Tracking: {ordersWithTracking?.find(o => o.id === selectedOrderId)?.tracking_number}
                </div>
              )}
            </div>
          )}

          {/* Manual Entry Mode */}
          {testMode === 'manual' && (
            <div className="space-y-2">
              <Label htmlFor="tracking-code">Enter Tracking Code</Label>
              <Input
                id="tracking-code"
                placeholder="e.g., 1Z999AA10123456784"
                value={manualTrackingCode}
                onChange={(e) => setManualTrackingCode(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter any tracking code from USPS, UPS, FedEx, or other carriers supported by EasyPost
              </p>
            </div>
          )}

          {/* Test Button */}
          <Button 
            onClick={testTracking} 
            disabled={isTestingTracking}
            className="w-full"
          >
            {isTestingTracking ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing Tracking API...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Test Tracking
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results Card */}
      {trackingResult && (
        <Card>
          <CardHeader>
            <CardTitle>Tracking Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {trackingResult.error ? (
              <div className="p-4 border border-destructive/50 bg-destructive/10 rounded-md">
                <div className="flex items-center gap-2 text-destructive font-semibold mb-2">
                  <AlertCircle className="h-5 w-5" />
                  API Test Failed
                </div>
                <p className="text-sm text-destructive/90">{trackingResult.error}</p>
              </div>
            ) : (
              <>
                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Status:</span>
                  {getStatusBadge(trackingResult.tracking?.status || 'unknown')}
                </div>

                {/* Tracking URL */}
                {trackingResult.tracking?.tracking_url && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(trackingResult.tracking.tracking_url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View on Carrier Website
                    </Button>
                  </div>
                )}

                {/* Tracking Events Timeline */}
                {trackingResult.tracking?.events && trackingResult.tracking.events.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold">Tracking History</h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {trackingResult.tracking.events.map((event: any, index: number) => (
                        <div 
                          key={index} 
                          className="p-3 border rounded-md bg-muted/30"
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <p className="font-medium text-sm">{event.message || event.description}</p>
                              {event.tracking_details?.message && (
                                <p className="text-xs text-muted-foreground">
                                  {event.tracking_details.message}
                                </p>
                              )}
                              {event.tracking_details?.description && (
                                <p className="text-xs text-muted-foreground">
                                  Location: {event.tracking_details.description}
                                </p>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                              {new Date(event.datetime).toLocaleString()}
                            </div>
                          </div>
                          <div className="flex gap-2 mt-2">
                            {event.status && (
                              <Badge variant="outline" className="text-xs">
                                {event.status}
                              </Badge>
                            )}
                            {event.carrier && (
                              <Badge variant="secondary" className="text-xs">
                                {event.carrier}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Success Message */}
                <div className="p-4 border border-green-200 bg-green-50 rounded-md dark:border-green-900 dark:bg-green-950">
                  <div className="flex items-center gap-2 text-green-900 dark:text-green-100 font-semibold">
                    <CheckCircle2 className="h-5 w-5" />
                    {trackingResult.message || 'API test successful!'}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
