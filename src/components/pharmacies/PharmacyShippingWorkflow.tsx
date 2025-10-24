import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Package, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { PharmacyDeclineDialog } from "./PharmacyDeclineDialog";

interface PharmacyShippingWorkflowProps {
  orderId: string;
  onUpdate: () => void;
  onClose: () => void;
}

export const PharmacyShippingWorkflow = ({ orderId, onUpdate, onClose }: PharmacyShippingWorkflowProps) => {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [isMarkingShipped, setIsMarkingShipped] = useState(false);
  const queryClient = useQueryClient();

  // Fetch order details
  const { data: order, isLoading } = useQuery({
    queryKey: ['order-shipping-details', orderId],
    queryFn: async () => {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          profiles (
            name,
            company,
            address_street,
            address_city,
            address_state,
            address_zip
          )
        `)
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      const { data: lines, error: linesError } = await supabase
        .from('order_lines')
        .select('*')
        .eq('order_id', orderId);

      if (linesError) throw linesError;

      return { ...orderData, lines };
    },
  });

  // Download prescription
  const downloadPrescription = async (lineId: string, patientName: string) => {
    try {
      toast.loading('Generating prescription PDF...', { id: 'prescription' });
      
      const { data, error } = await supabase.functions.invoke('generate-prescription-pdf', {
        body: { order_line_id: lineId }
      });

      if (error) throw error;

      if (data?.prescription_url) {
        window.open(data.prescription_url, '_blank');
        toast.success('Prescription ready', { id: 'prescription' });
      } else {
        throw new Error('No prescription URL returned');
      }
    } catch (error: any) {
      console.error('Error downloading prescription:', error);
      toast.error(error.message || 'Failed to download prescription', { id: 'prescription' });
    }
  };

  // Download order summary
  const downloadOrderSummary = async () => {
    try {
      toast.loading('Generating order summary...', { id: 'summary' });
      
      const { data, error } = await supabase.functions.invoke('generate-pharmacy-order-summary', {
        body: { order_id: orderId }
      });

      if (error) throw error;

      const blob = new Blob([Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0))], { 
        type: 'application/pdf' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `order-summary-${orderId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Order summary downloaded', { id: 'summary' });
    } catch (error: any) {
      console.error('Error downloading summary:', error);
      toast.error(error.message || 'Failed to download order summary', { id: 'summary' });
    }
  };


  // Mark as shipped
  const markShipped = async () => {
    if (!trackingNumber.trim()) {
      toast.error('Please enter a tracking number');
      return;
    }
    if (!carrier) {
      toast.error('Please select a carrier');
      return;
    }

    setIsMarkingShipped(true);
    try {
      const { error } = await supabase.functions.invoke('update-shipping-info', {
        body: {
          order_id: orderId,
          tracking_number: trackingNumber.trim(),
          carrier,
          status: 'shipped',
        }
      });

      if (error) throw error;

      toast.success('Order marked as shipped');
      setTrackingNumber("");
      setCarrier("");
      queryClient.invalidateQueries({ queryKey: ['pharmacy-assigned-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-shipping-details', orderId] });
      onUpdate();
    } catch (error: any) {
      console.error('Error marking shipped:', error);
      toast.error(error.message || 'Failed to mark order as shipped');
    } finally {
      setIsMarkingShipped(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Loading order details...</p>
        </CardContent>
      </Card>
    );
  }

  if (!order) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">Order not found</p>
        </CardContent>
      </Card>
    );
  }

  const isShipped = order.lines?.some(l => l.status === 'shipped');
  const isDeclined = order.lines?.some(l => l.status === 'denied');

  return (
    <div className="space-y-6">
      {/* Order Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Order #{orderId.slice(0, 8)}</CardTitle>
              <CardDescription>
                {order.ship_to === 'practice' ? 'Ship to Practice' : 'Ship to Patient'}
              </CardDescription>
            </div>
            <Badge variant={isShipped ? 'outline' : isDeclined ? 'destructive' : 'default'}>
              {isShipped ? 'Shipped' : isDeclined ? 'Declined' : order.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Practice</p>
              <p className="font-medium">{order.profiles?.company || order.profiles?.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Order Date</p>
              <p className="font-medium">{new Date(order.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Items</p>
              <p className="font-medium">{order.lines?.length || 0} line(s)</p>
            </div>
            <div>
              <p className="text-muted-foreground">Ship To</p>
              <p className="font-medium capitalize">{order.ship_to || 'Patient'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Shipping Method</p>
              <p className="font-medium">
                {order.ship_to === 'practice' ? 'Ship to Practice' : 'Ship to Patient'}
                {' • '}
                {order.lines?.[0]?.shipping_speed === 'overnight' ? 'Overnight' :
                 order.lines?.[0]?.shipping_speed === '2day' ? '2-Day' : 'Ground'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Download Center */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Download Center
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button 
              variant="outline" 
              className="h-20 flex flex-col gap-2"
              onClick={() => {
                if (order.lines && order.lines.length > 0) {
                  order.lines.forEach(line => {
                    downloadPrescription(line.id, line.patient_name);
                  });
                }
              }}
            >
              <FileText className="h-6 w-6" />
              <span>Prescription(s)</span>
            </Button>

            <Button 
              variant="outline" 
              className="h-20 flex flex-col gap-2"
              onClick={downloadOrderSummary}
            >
              <Package className="h-6 w-6" />
              <span>Order Summary</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mark as Shipped */}
      {!isShipped && !isDeclined && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Mark as Shipped
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tracking">Tracking Number *</Label>
                <Input
                  id="tracking"
                  placeholder="Enter tracking number"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="carrier">Carrier *</Label>
                <Select value={carrier} onValueChange={setCarrier}>
                  <SelectTrigger id="carrier">
                    <SelectValue placeholder="Select carrier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FedEx">FedEx</SelectItem>
                    <SelectItem value="UPS">UPS</SelectItem>
                    <SelectItem value="USPS">USPS</SelectItem>
                    <SelectItem value="Amazon">Amazon Logistics</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={markShipped} 
              disabled={isMarkingShipped || !trackingNumber.trim() || !carrier}
              className="w-full"
            >
              {isMarkingShipped ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Mark Shipped & Update Status
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Decline Order */}
      {!isShipped && !isDeclined && (
        <PharmacyDeclineDialog 
          orderId={orderId}
          orderNumber={orderId.slice(0, 8)}
          onSuccess={() => {
            onUpdate();
            onClose();
          }}
        />
      )}
    </div>
  );
};
