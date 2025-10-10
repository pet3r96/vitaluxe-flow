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
import { Truck, Package } from "lucide-react";
import { format } from "date-fns";

interface ShippingInfoFormProps {
  orderLine: any;
  onSuccess: () => void;
}

export const ShippingInfoForm = ({ orderLine, onSuccess }: ShippingInfoFormProps) => {
  const { effectiveRole } = useAuth();
  const canEdit = effectiveRole === 'admin' || effectiveRole === 'pharmacy';
  
  const [trackingNumber, setTrackingNumber] = useState(orderLine.tracking_number || "");
  const [carrier, setCarrier] = useState(orderLine.shipping_carrier || "other");
  const [status, setStatus] = useState(orderLine.status || "pending");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.functions.invoke('update-shipping-info', {
        body: {
          orderLineId: orderLine.id,
          trackingNumber,
          carrier,
          status,
        },
      });

      if (error) throw error;

      toast.success("Shipping information updated successfully");
      onSuccess();
    } catch (error: any) {
      console.error('Error updating shipping info:', error);
      toast.error(error.message || "Failed to update shipping information");
    } finally {
      setIsSaving(false);
    }
  };

  if (!canEdit) {
    // Read-only view for providers and patients
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
              <SelectItem value="dhl">DHL</SelectItem>
              <SelectItem value="other">Other</SelectItem>
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
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};
