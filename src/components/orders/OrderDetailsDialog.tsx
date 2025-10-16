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
import { Download, XCircle, AlertCircle } from "lucide-react";
import { ShippingInfoForm } from "./ShippingInfoForm";
import { ShippingAuditLog } from "./ShippingAuditLog";
import { CancelOrderDialog } from "./CancelOrderDialog";
import { ReportNotesSection } from "./ReportNotesSection";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ReceiptDownloadButton } from "./ReceiptDownloadButton";

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
  const { toast } = useToast();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  // Determine if user can view PHI (HIPAA compliance)
  const canViewPHI = ['doctor', 'provider', 'pharmacy', 'admin'].includes(effectiveRole || '');

  const handleDownloadPrescription = async (prescriptionUrl: string, patientName: string) => {
    try {
      if (import.meta.env.DEV) {
        console.log('Starting prescription download:', { prescriptionUrl, patientName });
      }
      
      // Extract the full file path from the signed URL
      // URL format: https://.../storage/v1/object/sign/prescriptions/{path}?token=...
      const match = prescriptionUrl.match(/\/prescriptions\/(.+?)(\?|$)/);
      
      if (!match || !match[1]) {
        throw new Error('Invalid prescription URL format');
      }
      
      const filePath = decodeURIComponent(match[1]); // Decode any URL encoding
      if (import.meta.env.DEV) {
        console.log('Extracted file path:', filePath);
      }
      
      // Use Supabase client to download - handles auth and CORS properly
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
      
      // Determine correct file extension from MIME type
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

      // Log mismatches for admin visibility
      if (mimeExt && pathExt && mimeExt !== pathExt) {
        await supabase.functions.invoke('log-error', {
          body: {
            action_type: 'client_error',
            entity_type: 'prescription_filetype_mismatch',
            details: {
              filePath,
              blobType,
              inferredExt: mimeExt,
              pathExt,
              userId: effectiveUserId,
              userRole: effectiveRole,
              timestamp: new Date().toISOString(),
            },
          },
        });
      }
      
      // Create blob URL and trigger download
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Small timeout before cleanup to ensure download starts
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 200);
      
      if (import.meta.env.DEV) {
        console.log('Prescription downloaded successfully');
      }
      
      toast({
        title: "Download Complete",
        description: "Prescription downloaded successfully.",
      });
      
    } catch (error) {
      console.error('Error downloading prescription:', error);
      
      // Log to backend error system
      await supabase.functions.invoke('log-error', {
        body: {
          action_type: 'client_error',
          entity_type: 'prescription_download_error',
          details: {
            message: error instanceof Error ? error.message : String(error),
            prescriptionUrl,
            patientName,
            userId: effectiveUserId,
            userRole: effectiveRole,
            timestamp: new Date().toISOString(),
            stack: error instanceof Error ? error.stack : undefined,
          },
        },
      });
      
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to download prescription. Please try again.",
        variant: "destructive",
      });
    }
  };

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
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>Order Details</DialogTitle>
              <DialogDescription>
                Order #{order.id.slice(0, 8)} - {new Date(order.created_at).toLocaleDateString()}
              </DialogDescription>
            </div>
            <ReceiptDownloadButton
              orderId={order.id}
              orderDate={order.created_at}
              practiceName={order.profiles?.name || "Practice"}
              variant="outline"
              size="sm"
              showLabel
            />
          </div>
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
                      <div className="flex flex-col gap-1">
                        <p className="font-medium">{line.products?.name || "N/A"}</p>
                        {line.products?.product_type && (
                          <Badge variant="outline" className="text-xs w-fit">
                            {line.products.product_type}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Quantity</p>
                      <p className="font-medium">{line.quantity}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Shipping Speed</p>
                      <Badge variant="outline" className="capitalize w-fit">
                        {line.shipping_speed === '2day' ? '2-Day Shipping' :
                         line.shipping_speed === 'overnight' ? 'Overnight Shipping' :
                         'Ground (5-7 days)'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Shipping Cost</p>
                      <p className="font-medium">${line.shipping_cost?.toFixed(2) || '0.00'}</p>
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
                        {canViewPHI && line.patients?.allergies && (
                          <div className="col-span-2 pt-2 border-t border-primary/30">
                            <p className="text-xs font-semibold text-primary flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Patient Allergies (PHI)
                            </p>
                            <p className="text-sm text-primary-foreground bg-primary/25 p-2 rounded mt-1 border border-primary/40 shadow-inner">
                              {line.patients.allergies}
                            </p>
                          </div>
                        )}
                        {canViewPHI && line.patients?.allergies === null && (
                          <div className="col-span-2 pt-2 border-t">
                            <p className="text-xs text-muted-foreground italic">No known allergies recorded</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {line.prescription_url && (
                    <div className="pt-3 border-t">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-muted-foreground">Prescription Details</p>
                        {line.products?.requires_prescription && (
                          <Badge variant="default" className="bg-green-600">Required</Badge>
                        )}
                      </div>
                      
                      {canViewPHI && (line.custom_dosage || line.custom_sig || line.order_notes) && (
                        <div className="space-y-2 mb-3 p-3 bg-muted/50 rounded-md border">
                          {line.custom_dosage && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">Dosage Instructions</p>
                              <p className="text-sm">{line.custom_dosage}</p>
                            </div>
                          )}
                          {line.custom_sig && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">SIG (Directions for Use)</p>
                              <p className="text-sm">{line.custom_sig}</p>
                            </div>
                          )}
                          {line.order_notes && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">Additional Notes</p>
                              <p className="text-sm text-muted-foreground">{line.order_notes}</p>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDownloadPrescription(line.prescription_url, line.patient_name)}
                        className="w-full"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Prescription
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
