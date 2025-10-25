import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Package, Loader2, CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { ShipmentTrackingCard } from "@/components/orders/ShipmentTrackingCard";
import { getCurrentCSRFToken } from "@/lib/csrf";

interface PharmacyShippingWorkflowProps {
  orderId: string;
  onUpdate: () => void;
  onClose: () => void;
}

export const PharmacyShippingWorkflow = ({ orderId, onUpdate, onClose }: PharmacyShippingWorkflowProps) => {
  const { effectiveUserId } = useAuth();
  const [workflowAction, setWorkflowAction] = useState<'ship' | 'hold' | 'decline'>('ship');
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [isMarkingShipped, setIsMarkingShipped] = useState(false);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
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
        .select(`
          *,
          products (
            name,
            requires_prescription
          )
        `)
        .eq('order_id', orderId);

      if (linesError) throw linesError;

      return { ...orderData, lines };
    },
  });

  // Download prescription (matches provider/practice logic)
  const downloadPrescription = async (lineId: string, patientName: string, prescriptionUrl?: string, requiresPrescription?: boolean) => {
    try {
      // Check if product requires prescription
      if (requiresPrescription === false) {
        toast.info('No prescription required for this product');
        return;
      }

      // Priority 1: Download existing prescription if URL exists
      if (prescriptionUrl) {
        toast.loading('Downloading prescription...', { id: 'prescription' });
        
        // Extract file path from signed URL
        const match = prescriptionUrl.match(/\/prescriptions\/(.+?)(\?|$)/);
        
        if (!match || !match[1]) {
          throw new Error('Invalid prescription URL format');
        }
        
        const filePath = decodeURIComponent(match[1]);
        
        // Use Supabase storage download (handles auth + CORS properly)
        const { data, error } = await supabase.storage
          .from('prescriptions')
          .download(filePath);
        
        if (error) {
          console.error('Supabase storage download error:', error);
          throw new Error(`Storage error: ${error.message}`);
        }
        
        if (!data) {
          throw new Error('No data received from storage');
        }
        
        // Determine file extension from MIME type
        const getExtFromMime = (mime?: string | null): string | null => {
          const map: Record<string, string> = {
            'application/pdf': 'pdf',
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/webp': 'webp',
          };
          return mime ? map[mime] ?? null : null;
        };

        const pathExt = (filePath.split('.').pop() || '').toLowerCase();
        const blobType = (data as Blob).type;
        const mimeExt = getExtFromMime(blobType);
        const finalExt = mimeExt || pathExt || 'pdf';
        const filename = `prescription_${patientName.replace(/\s+/g, '_')}_${Date.now()}.${finalExt}`;
        
        // Create blob URL and trigger download
        const url = window.URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }, 200);
        
        toast.success('Prescription downloaded', { id: 'prescription' });
        return;
      }
      
      // Fallback: Generate new PDF if no existing URL (rare case)
      toast.loading('Generating prescription PDF...', { id: 'prescription' });
      
      const { data, error } = await supabase.functions.invoke('generate-prescription-pdf', {
        body: { order_line_id: lineId }
      });

      if (error) throw error;

      if (data?.prescription_url) {
        const response = await fetch(data.prescription_url);
        if (!response.ok) throw new Error('Failed to fetch prescription');
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.file_name || `prescription-${patientName.replace(/\s+/g, '_')}-${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast.success('Prescription downloaded', { id: 'prescription' });
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
      // Get CSRF token
      const csrfToken = await getCurrentCSRFToken();
      if (!csrfToken) {
        throw new Error("Unable to verify session. Please refresh and try again.");
      }

      // Update ALL order lines in this order
      if (!order?.lines || order.lines.length === 0) {
        throw new Error('No order lines found');
      }

      // Normalize carrier to lowercase for edge function enum validation
      const normalizedCarrier = carrier.toLowerCase();

      // Update each order line
      const updatePromises = order.lines.map(async (line) => {
        const { error } = await supabase.functions.invoke('update-shipping-info', {
          body: {
            orderLineId: line.id,
            trackingNumber: trackingNumber.trim(),
            carrier: normalizedCarrier,
            status: 'shipped',
          },
          headers: {
            'x-csrf-token': csrfToken
          }
        });

        if (error) {
          console.error(`Error updating line ${line.id}:`, error);
          throw error;
        }
      });

      // Wait for all updates to complete
      await Promise.all(updatePromises);

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

  // Handle hold order
  const handleHoldOrder = async () => {
    if (!reason || !notes.trim()) {
      toast.error('Please provide reason and notes');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('pharmacy-order-action', {
        body: {
          order_id: orderId,
          action: 'hold',
          reason: reason,
          notes: notes.trim(),
          target_user_id: effectiveUserId,
        }
      });

      if (error) throw error;

      toast.success('Order placed on hold and support ticket created');
      setReason("");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ['pharmacy-assigned-orders'] });
      onUpdate();
      onClose();
    } catch (error: any) {
      console.error('Error placing order on hold:', error);
      toast.error(error.message || 'Failed to place order on hold');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle decline order
  const handleDeclineOrder = async () => {
    if (!reason) {
      toast.error('Please select a reason');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('pharmacy-order-action', {
        body: {
          order_id: orderId,
          action: 'decline',
          reason: reason,
          notes: notes.trim() || undefined,
          target_user_id: effectiveUserId,
        }
      });

      if (error) throw error;

      toast.success('Order declined and customer refunded successfully');
      setConfirmDialogOpen(false);
      setReason("");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ['pharmacy-assigned-orders'] });
      onUpdate();
      onClose();
    } catch (error: any) {
      console.error('Error declining order:', error);
      toast.error(error.message || 'Failed to decline order');
    } finally {
      setIsSubmitting(false);
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
                    downloadPrescription(
                      line.id, 
                      line.patient_name, 
                      line.prescription_url,
                      line.products?.requires_prescription
                    );
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

      {/* Shipment Tracking Display for Shipped Orders */}
      {isShipped && order.lines && order.lines.length > 0 && (
        <div className="space-y-4">
          {order.lines
            .filter(line => line.status === 'shipped' && line.tracking_number)
            .map(line => (
              <div key={line.id} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-sm font-medium">
                    {line.patient_name} - {line.products?.name || 'Product'}
                  </p>
                  <Badge variant="outline" className="text-xs">
                    {line.status}
                  </Badge>
                </div>
                <ShipmentTrackingCard
                  orderLineId={line.id}
                  trackingNumber={line.tracking_number}
                  carrier={line.shipping_carrier}
                  canEdit={true}
                  onUpdate={() => {
                    queryClient.invalidateQueries({ queryKey: ['pharmacy-assigned-orders'] });
                    queryClient.invalidateQueries({ queryKey: ['order-shipping-details', orderId] });
                  }}
                />
              </div>
            ))}
          
          {/* Show message if shipped but no tracking available */}
          {order.lines.every(line => !line.tracking_number) && (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">
                  This order is marked as shipped but no tracking information is available.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Unified Workflow Card */}
      {!isShipped && !isDeclined && (
        <Card>
          <CardHeader>
            <CardTitle>What would you like to do?</CardTitle>
            <CardDescription>Choose an action for this order</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Radio Group for 3 Options */}
            <RadioGroup 
              value={workflowAction} 
              onValueChange={(v) => setWorkflowAction(v as 'ship' | 'hold' | 'decline')}
            >
              {/* OPTION 1: Ship Order (DEFAULT) */}
              <div className="flex items-start space-x-3 rounded-md border p-4 hover:bg-accent">
                <RadioGroupItem value="ship" id="ship" />
                <div className="flex-1 space-y-1">
                  <Label htmlFor="ship" className="cursor-pointer flex items-center gap-2 font-semibold">
                    <CheckCircle className="h-4 w-4" />
                    Ship Order
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Mark order as shipped with tracking information
                  </p>
                </div>
              </div>

              {/* OPTION 2: Put Order on Hold */}
              <div className="flex items-start space-x-3 rounded-md border p-4 hover:bg-accent">
                <RadioGroupItem value="hold" id="hold" />
                <div className="flex-1 space-y-1">
                  <Label htmlFor="hold" className="cursor-pointer flex items-center gap-2 font-semibold">
                    <Clock className="h-4 w-4" />
                    Put Order on Hold
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Temporary hold - no refund processed
                  </p>
                </div>
              </div>

              {/* OPTION 3: Decline and Refund Order */}
              <div className="flex items-start space-x-3 rounded-md border p-4 hover:bg-accent">
                <RadioGroupItem value="decline" id="decline" />
                <div className="flex-1 space-y-1">
                  <Label htmlFor="decline" className="cursor-pointer flex items-center gap-2 font-semibold">
                    <XCircle className="h-4 w-4" />
                    Decline and Refund Order
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Permanent decline - full refund processed immediately
                  </p>
                </div>
              </div>
            </RadioGroup>

            {/* Conditional Fields Based on Selected Action */}
            
            {/* OPTION 1 FIELDS: Ship Order */}
            {workflowAction === 'ship' && (
              <>
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
                        <SelectItem value="fedex">FedEx</SelectItem>
                        <SelectItem value="ups">UPS</SelectItem>
                        <SelectItem value="usps">USPS</SelectItem>
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
              </>
            )}

            {/* OPTION 2 FIELDS: Put Order on Hold */}
            {workflowAction === 'hold' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="hold-reason">Hold Reason *</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger id="hold-reason">
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="out_of_stock_temp">Out of Stock (Temporary)</SelectItem>
                      <SelectItem value="awaiting_patient">Awaiting Patient Response</SelectItem>
                      <SelectItem value="clarification_needed">Prescription Clarification Needed</SelectItem>
                      <SelectItem value="incorrect_dosage_correction">Incorrect Dosage - Need Correction</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hold-notes">Detailed Notes *</Label>
                  <Textarea
                    id="hold-notes"
                    placeholder="Provide detailed information about the issue..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                  />
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This will create a support ticket and notify the practice. No refund will be processed.
                  </AlertDescription>
                </Alert>

                <Button 
                  onClick={handleHoldOrder}
                  disabled={!reason || !notes.trim() || isSubmitting}
                  className="w-full"
                  variant="outline"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Clock className="mr-2 h-4 w-4" />
                      Place Order on Hold
                    </>
                  )}
                </Button>
              </>
            )}

            {/* OPTION 3 FIELDS: Decline and Refund Order */}
            {workflowAction === 'decline' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="decline-reason">Decline Reason *</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger id="decline-reason">
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="out_of_stock_permanent">Out of Stock (Permanent/Discontinued)</SelectItem>
                      <SelectItem value="cannot_fulfill">Cannot Fulfill Prescription</SelectItem>
                      <SelectItem value="invalid_prescription">Invalid Prescription</SelectItem>
                      <SelectItem value="incorrect_dosage_permanent">Incorrect Dosage (Cannot Correct)</SelectItem>
                      <SelectItem value="patient_cancelled">Patient Request Cancellation</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="decline-notes">Additional Notes</Label>
                  <Textarea
                    id="decline-notes"
                    placeholder="Provide any additional context..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                  />
                </div>

                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This will immediately refund the customer. This action cannot be undone.
                  </AlertDescription>
                </Alert>

                <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      className="w-full" 
                      disabled={!reason}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Decline & Refund Customer
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Order Decline</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2">
                        <p>This action will:</p>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          <li>Mark the order as declined</li>
                          <li>Automatically refund the customer's payment</li>
                          <li>Create a support ticket</li>
                          <li>Notify the practice</li>
                        </ul>
                        <p className="text-destructive font-semibold mt-4">This action cannot be undone.</p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeclineOrder();
                        }}
                        disabled={isSubmitting}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          'Confirm Decline & Refund'
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
