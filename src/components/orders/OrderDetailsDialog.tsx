import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Separator } from "@/components/ui/separator";
import { Download, XCircle, AlertCircle } from "lucide-react";
import { ShippingInfoForm } from "./ShippingInfoForm";
import { ShippingAuditLog } from "./ShippingAuditLog";
import { ShipmentTrackingCard } from "./ShipmentTrackingCard";
import { CancelOrderDialog } from "./CancelOrderDialog";
import { ReportNotesSection } from "./ReportNotesSection";
import { RefundOrderDialog } from "./RefundOrderDialog";
import { RefundHistory } from "./RefundHistory";
import { OrderStatusSelector } from "./OrderStatusSelector";
import { OrderStatusHistory } from "./OrderStatusHistory";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ReceiptDownloadButton } from "./ReceiptDownloadButton";
import { logPatientPHIAccess } from "@/lib/auditLogger";
import { CreditCard, Building2, DollarSign } from "lucide-react";
import { logger } from "@/lib/logger";

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
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [decryptedPatientPHI, setDecryptedPatientPHI] = useState<Map<string, { allergies?: string | null, notes?: string | null }>>(new Map());
  const [decryptedContactInfo, setDecryptedContactInfo] = useState<Map<string, { patient_email?: string | null, patient_phone?: string | null, patient_address?: string | null }>>(new Map());
  const [regeneratedPrescriptionUrls, setRegeneratedPrescriptionUrls] = useState<Map<string, string>>(new Map());
  const [regeneratingUrls, setRegeneratingUrls] = useState(false);

  // Determine if user can view PHI (HIPAA compliance)
  const canViewPHI = ['doctor', 'provider', 'pharmacy', 'admin'].includes(effectiveRole || '');

  // Receipt downloads restricted to practice staff, pharmacies, and admins (not reps)
  const canDownloadReceipt = ['doctor', 'provider', 'pharmacy', 'admin'].includes(effectiveRole || '');

  // Prescription downloads restricted to practice staff, pharmacies, and admins (not reps)
  const canDownloadPrescription = ['doctor', 'provider', 'pharmacy', 'admin'].includes(effectiveRole || '');

  // Query payment method details to display card info
  const { data: paymentMethodDetails } = useQuery({
    queryKey: ["payment-method", order.payment_method_id],
    queryFn: async () => {
      if (!order.payment_method_id) return null;
      
      const { data, error } = await supabase
        .from("practice_payment_methods")
        .select("card_type, card_last_five, card_expiry")
        .eq("id", order.payment_method_id)
        .single();
      
      if (error) {
        logger.error('Failed to fetch payment method details', error);
        return null;
      }
      return data;
    },
    enabled: !!order.payment_method_id && open
  });

  // Regenerate signed URL for uploaded prescriptions
  const regenerateSignedUrl = async (existingUrl: string): Promise<string> => {
    try {
      // Extract file path from existing signed URL
      // Format: https://[project].supabase.co/storage/v1/object/sign/prescriptions/[path]?token=...
      const match = existingUrl.match(/\/prescriptions\/(.+?)(\?|$)/);
      if (!match || !match[1]) {
        logger.error('Could not parse prescription URL', new Error('Invalid URL format'), { url: existingUrl });
        return existingUrl; // Return original if can't parse
      }
      
      const filePath = decodeURIComponent(match[1]);
      
      // Generate new signed URL with 1-year expiry (31536000 seconds)
      const { data, error } = await supabase.storage
        .from('prescriptions')
        .createSignedUrl(filePath, 31536000);
      
      if (error) {
        logger.error('Failed to regenerate signed URL', error);
        return existingUrl; // Fallback to original
      }
      
      return data.signedUrl;
    } catch (error) {
      logger.error('Error regenerating prescription URL', error instanceof Error ? error : new Error(String(error)));
      return existingUrl; // Fallback to original
    }
  };

  // Fetch and decrypt patient allergies and contact info when dialog opens
  useEffect(() => {
    const fetchDecryptedData = async () => {
      if (!open || !canViewPHI || !order?.order_lines || order.ship_to !== 'patient') {
        return;
      }

      // Collect unique patient IDs and order line IDs
      const patientIds = new Set<string>();
      const orderLineIds: string[] = [];
      
      order.order_lines.forEach((line: any) => {
        if (line.patient_id) {
          patientIds.add(line.patient_id);
        }
        orderLineIds.push(line.id);
      });

      // Fetch PHI and contact info in parallel
      const phiCache = new Map<string, { allergies?: string | null, notes?: string | null }>();
      const contactCache = new Map<string, { patient_email?: string | null, patient_phone?: string | null, patient_address?: string | null }>();
      
      // Fetch PHI for each patient
      const phiPromises = Array.from(patientIds).map(async (patientId) => {
        try {
          const { data, error } = await supabase.rpc('get_decrypted_patient_phi', {
            p_patient_id: patientId
          });

          if (error) throw error;

          if (data && data.length > 0) {
            return {
              patientId,
              phi: {
                allergies: data[0].allergies,
                notes: data[0].notes
              }
            };
          }
        } catch (error) {
          logger.error(`Failed to decrypt PHI for patient`, error, logger.sanitize({ patientId }));
        }
        return null;
      });

      // Fetch contact info for each order line
      const contactPromises = orderLineIds.map(async (lineId) => {
        try {
          const { data, error } = await supabase.rpc('get_decrypted_order_line_contact', {
            p_order_line_id: lineId
          });

          if (error) throw error;

          if (data && data.length > 0) {
            return {
              lineId,
              contact: data[0]
            };
          }
        } catch (error) {
          logger.error(`Failed to decrypt contact info for order line`, error, logger.sanitize({ lineId }));
        }
        return null;
      });

      // Wait for all fetches to complete
      const [phiResults, contactResults] = await Promise.all([
        Promise.all(phiPromises),
        Promise.all(contactPromises)
      ]);

      // Build PHI cache and log access
      phiResults.forEach(result => {
        if (result) {
          phiCache.set(result.patientId, result.phi);

          // Log PHI access
          const line = order.order_lines.find((l: any) => l.patient_id === result.patientId);
          if (line) {
            const relationship = effectiveRole === 'admin' ? 'admin' :
                               effectiveRole === 'pharmacy' ? 'admin' :
                               'practice_admin';

            logPatientPHIAccess({
              patientId: result.patientId,
              patientName: line.patient_name,
              accessedFields: { allergies: true },
              viewerRole: effectiveRole || 'unknown',
              relationship,
              componentContext: 'OrderDetailsDialog'
            });
          }
        }
      });

      // Build contact cache and log access
      contactResults.forEach(result => {
        if (result) {
          contactCache.set(result.lineId, result.contact);

          // Log PHI access for contact info (address only, as email/phone are not in the PHI interface)
          const line = order.order_lines.find((l: any) => l.id === result.lineId);
          if (line && line.patient_id && result.contact.patient_address) {
            const relationship = effectiveRole === 'admin' ? 'admin' :
                               effectiveRole === 'pharmacy' ? 'admin' :
                               'practice_admin';

            logPatientPHIAccess({
              patientId: line.patient_id,
              patientName: line.patient_name,
              accessedFields: {
                address: true
              },
              viewerRole: effectiveRole || 'unknown',
              relationship,
              componentContext: 'OrderDetailsDialog - Contact Info'
            });
          }
        }
      });

      setDecryptedPatientPHI(phiCache);
      setDecryptedContactInfo(contactCache);

      // REGENERATE SIGNED URLs for uploaded prescriptions
      setRegeneratingUrls(true);
      const regeneratedUrls = new Map<string, string>();

      for (const line of order.order_lines) {
        if (line.prescription_url && line.prescription_method === 'uploaded') {
          const newUrl = await regenerateSignedUrl(line.prescription_url);
          regeneratedUrls.set(line.id, newUrl);
        }
      }

      setRegeneratedPrescriptionUrls(regeneratedUrls);
      setRegeneratingUrls(false);
    };

    fetchDecryptedData();
  }, [open, order, canViewPHI, effectiveRole]);

  const handleDownloadPrescription = async (prescriptionUrl: string, patientName: string) => {
    try {
      logger.info('Starting prescription download', logger.sanitize({ prescriptionUrl, patientName }));
      
      // Extract the full file path from the signed URL
      // URL format: https://.../storage/v1/object/sign/prescriptions/{path}?token=...
      const match = prescriptionUrl.match(/\/prescriptions\/(.+?)(\?|$)/);
      
      if (!match || !match[1]) {
        throw new Error('Invalid prescription URL format');
      }
      
      const filePath = decodeURIComponent(match[1]); // Decode any URL encoding
      logger.info('Extracted file path', { filePath });
      
      // Use Supabase client to download - handles auth and CORS properly
      const { data, error } = await supabase.storage
        .from('prescriptions')
        .download(filePath);
      
      if (error) {
        logger.error('Supabase storage download error', error);
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
      
      logger.info('Prescription downloaded successfully');
      
      toast({
        title: "Download Complete",
        description: "Prescription downloaded successfully.",
      });
      
    } catch (error) {
      logger.error('Error downloading prescription', error);
      
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
            {canDownloadReceipt && (
              <ReceiptDownloadButton
                orderId={order.id}
                orderDate={order.created_at}
                practiceName={order.profiles?.name || "Practice"}
                variant="outline"
                size="sm"
                showLabel
              />
            )}
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
              <div className="col-span-2">
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">${order.subtotal_before_discount?.toFixed(2) || '0.00'}</span>
                  </div>
                  
                  {order.discount_amount && order.discount_amount > 0 && (
                    <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                      <span>Discount ({order.discount_percentage}%):</span>
                      <span className="font-medium">-${order.discount_amount.toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping & Handling:</span>
                    <span className="font-medium">${order.shipping_total?.toFixed(2) || '0.00'}</span>
                  </div>
                  
                  {order.merchant_fee_amount && order.merchant_fee_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Merchant Processing Fee ({order.merchant_fee_percentage}%):
                      </span>
                      <span className="font-medium">${order.merchant_fee_amount.toFixed(2)}</span>
                    </div>
                  )}
                  
                  <Separator />
                  
                  <div className="flex justify-between text-base font-bold">
                    <span>Grand Total:</span>
                    <span className="text-primary">${order.total_amount?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>
              </div>
            )}
            <OrderStatusSelector order={order} onSuccess={onSuccess} />
            <div>
              <p className="text-sm text-muted-foreground">Fulfillment Type</p>
              <Badge variant={order.ship_to === 'practice' ? 'secondary' : 'default'}>
                {order.ship_to === 'practice' ? '🏢 Practice Order' : '👤 Patient Order'}
              </Badge>
            </div>
            {order.payment_status && (
              <div>
                <p className="text-sm text-muted-foreground">Payment Status</p>
                <Badge
                  variant={
                    order.payment_status === 'paid' ? 'default' :
                    order.payment_status === 'refunded' ? 'secondary' :
                    order.payment_status === 'partially_refunded' ? 'outline' :
                    order.payment_status === 'payment_failed' ? 'destructive' :
                    'secondary'
                  }
                >
                  {order.payment_status.replace(/_/g, ' ').toUpperCase()}
                </Badge>
              </div>
            )}
          </div>

          {order.authorizenet_transaction_id && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm">
                {order.payment_method_used === 'credit_card' ? (
                  <CreditCard className="h-4 w-4" />
                ) : (
                  <Building2 className="h-4 w-4" />
                )}
                <span className="font-medium">
                  {order.payment_method_used === 'credit_card' ? 'Credit Card' : 'Bank Account'}
                </span>
              </div>
              
              {/* Display masked card details if available */}
              {paymentMethodDetails ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium font-mono">
                    {paymentMethodDetails.card_type} ••••{paymentMethodDetails.card_last_five}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Exp: {paymentMethodDetails.card_expiry}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground font-mono">
                  Loading payment details...
                </p>
              )}
              
              {/* Show transaction ID only to admins */}
              {effectiveRole === 'admin' && (
                <p className="text-xs text-muted-foreground font-mono mt-2 pt-2 border-t">
                  Txn: {order.authorizenet_transaction_id.slice(0, 12)}...
                </p>
              )}
              
              {effectiveRole === 'admin' && 
               order.authorizenet_transaction_id && 
               (order.payment_status === 'paid' || order.payment_status === 'partially_refunded') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRefundDialogOpen(true)}
                  className="mt-2"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Process Refund
                </Button>
              )}
            </div>
          )}

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
                        {line.products?.product_types?.name && (
                          <Badge variant="outline" className="text-xs w-fit">
                            {line.products.product_types.name}
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
                        <div>
                          <p className="text-xs text-muted-foreground">Email</p>
                          <p className="text-sm">
                            {decryptedContactInfo.has(line.id) 
                              ? (decryptedContactInfo.get(line.id)?.patient_email || "N/A")
                              : "Loading..."}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Phone</p>
                          <p className="text-sm">
                            {decryptedContactInfo.has(line.id) 
                              ? (decryptedContactInfo.get(line.id)?.patient_phone || "N/A")
                              : "Loading..."}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground">Address</p>
                          <p className="text-sm">
                            {decryptedContactInfo.has(line.id) 
                              ? (decryptedContactInfo.get(line.id)?.patient_address || "N/A")
                              : "Loading..."}
                          </p>
                        </div>
                        {canViewPHI && line.patient_id && (
                          <div className="col-span-2 pt-2 border-t border-primary/30">
                            <p className="text-xs font-semibold text-primary flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Patient Allergies (PHI)
                            </p>
                             {(() => {
                               const allergies = decryptedPatientPHI.get(line.patient_id)?.allergies;
                               const isLoading = !decryptedPatientPHI.has(line.patient_id);
                               
                               return isLoading ? (
                                 <p className="text-xs text-muted-foreground italic mt-1">
                                   Loading...
                                 </p>
                               ) : !allergies ? (
                                 <p className="text-xs text-muted-foreground italic mt-1">
                                   None provided
                                 </p>
                               ) : (
                                 <p className="text-sm text-primary-foreground bg-primary/25 p-2 rounded mt-1 border border-primary/40 shadow-inner">
                                   {allergies}
                                 </p>
                               );
                             })()}
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
                          <Badge variant="success" size="sm">Required</Badge>
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
                      
                      {canDownloadPrescription ? (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            const urlToUse = regeneratedPrescriptionUrls.get(line.id) || line.prescription_url;
                            handleDownloadPrescription(urlToUse, line.patient_name);
                          }}
                          disabled={regeneratingUrls}
                          className="w-full"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          {regeneratingUrls ? 'Preparing Download...' : 'Download Prescription'}
                        </Button>
                      ) : (
                        <Alert>
                          <AlertDescription className="text-xs">
                            Prescription on file. Contact practice or pharmacy for details.
                          </AlertDescription>
                        </Alert>
                      )}
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
                    
                    {/* Shipment Tracking - Show for shipped orders with tracking info */}
                    {line.status === 'shipped' && line.tracking_number && line.shipping_carrier && (
                      <div className="mt-4">
                        <ShipmentTrackingCard
                          orderLineId={line.id}
                          trackingNumber={line.tracking_number}
                          carrier={line.shipping_carrier}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Status History */}
          <OrderStatusHistory orderId={order.id} />

          {/* Refund History Section */}
          <RefundHistory orderId={order.id} />
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

      <RefundOrderDialog
        open={refundDialogOpen}
        onOpenChange={setRefundDialogOpen}
        order={order}
        onSuccess={onSuccess}
      />
    </Dialog>
  );
};
