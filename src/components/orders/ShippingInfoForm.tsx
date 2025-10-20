import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Truck, Package, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface ShippingInfoFormProps {
  orderLine: any;
  onSuccess: () => void;
}

export const ShippingInfoForm = ({ orderLine, onSuccess }: ShippingInfoFormProps) => {
  const { effectiveRole } = useAuth();
  const canEdit = effectiveRole === 'admin' || effectiveRole === 'pharmacy';
  
  // Track initial values
  const initialTrackingNumber = orderLine.tracking_number || "";
  const initialCarrier = orderLine.shipping_carrier || "fedex";
  const initialStatus = orderLine.status || "pending";
  
  const [trackingNumber, setTrackingNumber] = useState(initialTrackingNumber);
  const [carrier, setCarrier] = useState(initialCarrier);
  const [status, setStatus] = useState(initialStatus);
  const [isSaving, setIsSaving] = useState(false);
  
  // Tracking refresh state
  const [trackingData, setTrackingData] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [callsRemaining, setCallsRemaining] = useState<number | null>(null);
  const [isCached, setIsCached] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Only send fields that have changed
      const payload: any = { orderLineId: orderLine.id };
      
      if (trackingNumber !== initialTrackingNumber) {
        payload.trackingNumber = trackingNumber;
      }
      
      if (carrier !== initialCarrier) {
        payload.carrier = carrier;
      }
      
      if (status !== initialStatus) {
        payload.status = status;
      }

      const { data, error } = await supabase.functions.invoke('update-shipping-info', {
        body: payload,
      });

      if (error) throw error;

      toast.success("Shipping information updated successfully");
      onSuccess();
    } catch (error: any) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error('Error updating shipping info', error);
      });
      toast.error(error.message || "Failed to update shipping information");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefreshTracking = async () => {
    if (!orderLine.tracking_number) {
      toast.error("No tracking number available");
      return;
    }

    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('amazon-get-tracking', {
        body: { 
          orderLineId: orderLine.id,
          trackingNumber: orderLine.tracking_number 
        }
      });

      if (error) throw error;

      setTrackingData(data.data);
      setIsCached(data.cached || false);
      setCallsRemaining(data.calls_remaining_today);

      if (data.cached) {
        toast.info(data.rate_limit_message, { duration: 5000 });
      } else {
        toast.success(`Tracking updated (${data.calls_remaining_today} refreshes left today)`);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to refresh tracking");
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!canEdit) {
    // Read-only view for practices and patients
    return (
      <div className="p-4 bg-muted/50 rounded-lg border space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Truck className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Shipping Information</span>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Carrier</p>
            <p className="text-sm font-medium capitalize">{carrier || "Not set"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="text-sm font-medium capitalize">{status || "Pending"}</p>
          </div>
        </div>
        
        {trackingNumber && (
          <div>
            <p className="text-xs text-muted-foreground">Tracking Number</p>
            <p className="text-sm font-mono">{trackingNumber}</p>
          </div>
        )}
        
        {orderLine.shipped_at && (
          <div>
            <p className="text-xs text-muted-foreground">Shipped Date</p>
            <p className="text-sm">{format(new Date(orderLine.shipped_at), "PPP")}</p>
          </div>
        )}
        
        {orderLine.delivered_at && (
          <div>
            <p className="text-xs text-muted-foreground">Delivered Date</p>
            <p className="text-sm">{format(new Date(orderLine.delivered_at), "PPP")}</p>
          </div>
        )}
      </div>
    );
  }

  // Editable form for admins and pharmacies
  return (
    <div className="p-4 bg-card border rounded-lg space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Package className="h-4 w-4 text-primary" />
        <span className="font-medium">Manage Shipping</span>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="carrier">Carrier</Label>
          <Select value={carrier} onValueChange={setCarrier}>
            <SelectTrigger id="carrier">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fedex">FedEx</SelectItem>
              <SelectItem value="ups">UPS</SelectItem>
              <SelectItem value="usps">USPS</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="tracking">Tracking Number</Label>
          <Input
            id="tracking"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="Enter tracking number"
          />
        </div>

        <div>
          <Label htmlFor="status">Shipping Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="filled">Fulfilling</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {orderLine.tracking_number && (
          <div className="space-y-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleRefreshTracking}
              disabled={isRefreshing}
              className="w-full"
            >
              {isRefreshing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Tracking
                  {callsRemaining !== null && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({callsRemaining}/3 left today)
                    </span>
                  )}
                </>
              )}
            </Button>

            {isCached && (
              <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-400 p-2 rounded">
                ⚠️ Daily limit reached. Showing cached tracking data.
              </div>
            )}

            {trackingData && (
              <div className="mt-3 p-3 bg-muted rounded-lg">
                <p className="text-xs font-medium mb-2">Latest Tracking Status:</p>
                <p className="text-sm capitalize">{trackingData.status?.replace('_', ' ') || 'No updates'}</p>
                {trackingData.estimated_delivery && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Est. Delivery: {trackingData.estimated_delivery}
                  </p>
                )}
                {trackingData.events && trackingData.events.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Latest: {trackingData.events[0].description}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};
