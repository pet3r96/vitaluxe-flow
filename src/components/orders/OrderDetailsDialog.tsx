import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExternalLink, XCircle, AlertCircle } from "lucide-react";
import { ShippingInfoForm } from "./ShippingInfoForm";
import { ShippingAuditLog } from "./ShippingAuditLog";
import { CancelOrderDialog } from "./CancelOrderDialog";
import { ReportNotesSection } from "./ReportNotesSection";
import { useAuth } from "@/contexts/AuthContext";

interface OrderDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any;
  onSuccess: () => void;
}

export const OrderDetailsDialog = ({
  open,
  onOpenChange,
  order,
  onSuccess,
}: OrderDetailsDialogProps) => {
  const { effectiveRole, effectiveUserId } = useAuth();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const canCancelOrder = () => {
    if (order.status === 'cancelled') return false;
    
    const isAdmin = effectiveRole === 'admin';
    if (isAdmin) return true;
    
    const createdAt = new Date(order.created_at);
    const now = new Date();
    const hoursPassed = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursPassed >= 1) return false;
    
    // Direct order creator can cancel
    if (effectiveUserId === order.doctor_id) {
      return true;
    }
    
    // Practice owner can cancel orders created by their providers
    if (effectiveRole === 'doctor') {
      const isMyProvidersOrder = order.order_lines?.some((line: any) => 
        line.providers?.practice_id === effectiveUserId
      );
      
      if (isMyProvidersOrder) {
        return true;
      }
    }
    
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order Details</DialogTitle>
          <DialogDescription>
            Order #{order.id.slice(0, 8)} - {new Date(order.created_at).toLocaleDateString()}
          </DialogDescription>
          {order.status !== 'cancelled' && canCancelOrder() && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setCancelDialogOpen(true)}
              className="mt-2 w-fit"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel Order
            </Button>
          )}
        </DialogHeader>

        <div className="space-y-6">
          <ReportNotesSection
            orderId={order.id}
            initialNotes={order.report_notes}
            doctorId={order.doctor_id}
            practiceId={order.order_lines?.[0]?.providers?.practice_id}
            onSuccess={onSuccess}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Doctor</p>
              <p className="font-medium">{order.profiles?.name || "N/A"}</p>
            </div>
            {effectiveRole !== "pharmacy" && (
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="font-medium">${order.total_amount}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge>{order.status}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fulfillment Type</p>
              <Badge variant={order.ship_to === 'practice' ? 'secondary' : 'default'}>
                {order.ship_to === 'practice' ? '🏢 Practice Order' : '👤 Patient Order'}
              </Badge>
            </div>
          </div>

          {order.ship_to === 'practice' && order.practice_address && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1">Practice Shipping Address</p>
              <p className="text-sm text-muted-foreground">{order.practice_address}</p>
            </div>
          )}

          <div>
            <h3 className="text-lg font-semibold mb-4">Order Lines</h3>
            <div className="space-y-4">
              {order.order_lines?.map((line: any) => (
                <div key={line.id} className="p-4 border border-border rounded-md space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Product</p>
                      <p className="font-medium">{line.products?.name || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Quantity</p>
                      <p className="font-medium">{line.quantity}</p>
                    </div>
                    {effectiveRole !== "pharmacy" && (
                      <div>
                        <p className="text-sm text-muted-foreground">Price</p>
                        <p className="font-medium">${line.price}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">Pharmacy</p>
                      <p className="font-medium">{line.pharmacies?.name || "Unassigned"}</p>
                    </div>
                  </div>
                  
                  {order.ship_to === 'patient' && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-sm text-muted-foreground mb-2">Patient Information</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Name</p>
                          <p className="text-sm font-medium">{line.patient_name}</p>
                        </div>
                        {line.patient_email && (
                          <div>
                            <p className="text-xs text-muted-foreground">Email</p>
                            <p className="text-sm">{line.patient_email}</p>
                          </div>
                        )}
                        {line.patient_phone && (
                          <div>
                            <p className="text-xs text-muted-foreground">Phone</p>
                            <p className="text-sm">{line.patient_phone}</p>
                          </div>
                        )}
                        {line.patient_address && (
                          <div className="col-span-2">
                            <p className="text-xs text-muted-foreground">Address</p>
                            <p className="text-sm">{line.patient_address}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {line.prescription_url && (
                    <div className="pt-3 border-t">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-muted-foreground">Prescription</p>
                        {line.products?.requires_prescription && (
                          <Badge variant="default" className="bg-green-600">Required</Badge>
                        )}
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        asChild
                        className="w-full"
                      >
                        <a 
                          href={line.prescription_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center justify-center"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Prescription Document
                        </a>
                      </Button>
                    </div>
                  )}

                  {line.products?.requires_prescription && !line.prescription_url && effectiveRole === 'pharmacy' && (
                    <div className="pt-3 border-t">
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          This product requires a prescription but none was uploaded. Please contact support.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}

                  <div className="pt-2">
                    <Badge>{line.status}</Badge>
                  </div>

                  <div className="pt-2">
                    <ShippingInfoForm orderLine={line} onSuccess={onSuccess} />
                    <ShippingAuditLog orderLineId={line.id} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
      
      <CancelOrderDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        orderId={order.id}
        canCancel={canCancelOrder()}
        isAdmin={effectiveRole === 'admin'}
        orderCreatedAt={order.created_at}
        onSuccess={onSuccess}
      />
    </Dialog>
  );
};
