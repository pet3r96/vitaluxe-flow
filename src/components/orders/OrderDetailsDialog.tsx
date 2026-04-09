import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Download, XCircle, AlertCircle, Send, User } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { CreditCard, Building2, DollarSign, MapPin } from "lucide-react";
import { logger } from "@/lib/logger";
import { time, timeEnd } from "@/diag";
import type { Order } from "@/types/orders";

interface OrderDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
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
  const queryClient = useQueryClient();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [decryptedPatientPHI, setDecryptedPatientPHI] = useState<Map<string, { allergies?: string | null, notes?: string | null }>>(new Map());
  const [decryptedContactInfo, setDecryptedContactInfo] = useState<Map<string, { patient_email?: string | null, patient_phone?: string | null, patient_address?: string | null }>>(new Map());
  const [patientFallbackData, setPatientFallbackData] = useState<Map<string, any>>(new Map());
  const [regeneratedPrescriptionUrls, setRegeneratedPrescriptionUrls] = useState<Map<string, string>>(new Map());
  const [regeneratingUrls, setRegeneratingUrls] = useState(false);
  const [notesModified, setNotesModified] = useState(false);
  const [pendingNotes, setPendingNotes] = useState<string | null>(null);
  const [isSendingToPharmacy, setIsSendingToPharmacy] = useState(false);

  // Check if any order line is assigned to an API-enabled pharmacy
  const { data: pharmacyApiStatus } = useQuery({
    queryKey: ["pharmacy-api-status", order.id],
    queryFn: async () => {
      // Get unique pharmacy IDs from order lines
      const pharmacyIds = [...new Set(
        order.order_lines
          ?.map((line: any) => line.assigned_pharmacy_id)
          .filter(Boolean) || []
      )];

      if (pharmacyIds.length === 0) return { hasApiEnabled: false, pharmacies: [] };

      const { data, error } = await supabase
        .from('pharmacies')
        .select('id, name, api_enabled, api_handler_type')
        .in('id', pharmacyIds)
        .eq('api_enabled', true);

      if (error) {
        logger.error('Error checking pharmacy API status', error);
        return { hasApiEnabled: false, pharmacies: [] };
      }

      return {
        hasApiEnabled: data && data.length > 0,
        pharmacies: data || []
      };
    },
    enabled: open && ['admin', 'pharmacy'].includes(effectiveRole || ''),
    staleTime: 60 * 1000,
  });

  // Fetch practice patients for linking when ship_to is practice
  const { data: practicePatients } = useQuery({
    queryKey: ['practice-patients-for-linking', order.doctor_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('patient_accounts')
        .select('id, first_name, last_name')
        .eq('practice_id', (order as any).practice_id || order.doctor_id)
        .order('last_name');
      return data || [];
    },
    enabled: open && order.ship_to === 'practice',
  });

  const canLinkPatient = ['doctor', 'provider', 'staff', 'admin'].includes(effectiveRole || '');

  const handleLinkPatient = async (lineId: string, patientId: string) => {
    const patient = practicePatients?.find(p => p.id === patientId);
    if (!patient) return;

    const { error } = await supabase
      .from('order_lines')
      .update({
        patient_id: patient.id,
        patient_name: `${patient.first_name} ${patient.last_name}`
      })
      .eq('id', lineId);

    if (error) {
      toast({ title: "Error", description: "Failed to link patient.", variant: "destructive" });
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["order-full-details", order.id] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    onSuccess();
    toast({ title: "Patient Linked", description: `Linked to ${patient.first_name} ${patient.last_name}` });
  };

  const handleUnlinkPatient = async (lineId: string) => {
    const { error } = await supabase
      .from('order_lines')
      .update({
        patient_id: null,
        patient_name: 'Practice Order'
      })
      .eq('id', lineId);

    if (error) {
      toast({ title: "Error", description: "Failed to unlink patient.", variant: "destructive" });
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["order-full-details", order.id] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    onSuccess();
    toast({ title: "Patient Unlinked", description: "Patient has been unlinked from this order line." });
  };

  const canSendToPharmacy = ['admin', 'pharmacy'].includes(effectiveRole || '') && 
    pharmacyApiStatus?.hasApiEnabled && 
    order.status !== 'cancelled';

  const handleSendToPharmacy = async () => {
    if (!pharmacyApiStatus?.pharmacies?.length) {
      toast({
        title: "No API-Enabled Pharmacy",
        description: "No order lines are assigned to pharmacies with API integration enabled.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingToPharmacy(true);

    try {
      // Group order lines by pharmacy
      const linesByPharmacy = new Map<string, string[]>();
      
      order.order_lines?.forEach((line: any) => {
        if (line.assigned_pharmacy_id) {
          const pharmacy = pharmacyApiStatus.pharmacies.find(
            (p: any) => p.id === line.assigned_pharmacy_id
          );
          if (pharmacy) {
            const existing = linesByPharmacy.get(line.assigned_pharmacy_id) || [];
            existing.push(line.id);
            linesByPharmacy.set(line.assigned_pharmacy_id, existing);
          }
        }
      });

      // Send to each pharmacy
      const results = await Promise.all(
        Array.from(linesByPharmacy.entries()).map(async ([pharmacyId, lineIds]) => {
          const { data, error } = await supabase.functions.invoke('send-order-to-pharmacy', {
            body: {
              order_id: order.id,
              order_line_ids: lineIds,
              pharmacy_id: pharmacyId
            }
          });

          return { pharmacyId, data, error };
        })
      );

      const failures = results.filter(r => r.error || !r.data?.success);
      const successes = results.filter(r => !r.error && r.data?.success);

      if (successes.length > 0) {
        toast({
          title: "Order Sent to Pharmacy",
          description: `Successfully sent ${successes.length} order(s) to pharmacy API.`,
        });
        onSuccess();
      }

      if (failures.length > 0) {
        const errorMessages = failures.map(f => {
          if (f.error?.message) return f.error.message;
          if (f.data?.error) return f.data.error;
          if (f.data?.results) {
            const viosErrors = f.data.results
              .filter((r: any) => !r.success && r.error)
              .map((r: any) => r.error);
            if (viosErrors.length > 0) return viosErrors.join('; ');
          }
          if (f.data?.summary) return f.data.summary;
          return 'Unknown error';
        }).join(', ');
        
        toast({
          title: "Some Transmissions Failed",
          description: errorMessages,
          variant: "destructive",
        });
      }
    } catch (error) {
      logger.error('Error sending order to pharmacy', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send order to pharmacy",
        variant: "destructive",
      });
    } finally {
      setIsSendingToPharmacy(false);
    }
  };

  // Auto-save notes if modified before closing
  const saveNotesIfModified = async () => {
    if (!notesModified || !pendingNotes || !orderData) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ report_notes: pendingNotes })
        .eq('id', orderData.id);

      if (error) throw error;
      
      setNotesModified(false);
      setPendingNotes(null);
    } catch (error) {
      logger.error('Error auto-saving notes:', error);
    }
  };

  // Determine if user can view PHI (HIPAA compliance)
  const canViewPHI = ['doctor', 'provider', 'staff', 'pharmacy', 'admin'].includes(effectiveRole || '');

  // Receipt downloads restricted to practice staff, pharmacies, and admins (not reps)
  const canDownloadReceipt = ['doctor', 'provider', 'staff', 'pharmacy', 'admin'].includes(effectiveRole || '');

  // Prescription downloads restricted to practice staff, pharmacies, and admins (not reps)
  const canDownloadPrescription = ['doctor', 'provider', 'staff', 'pharmacy', 'admin'].includes(effectiveRole || '');

  // Lazy-load full order details when dialog opens using edge function
  const { data: fullOrderDetails } = useQuery({
    queryKey: ["order-full-details", order.id],
    queryFn: async () => {
      if (import.meta.env.DEV) time(`[OrderDetails] Load full data for ${order.id}`);
      
      const { data, error } = await supabase.functions.invoke('get-order-details', {
        body: { orderId: order.id }
      });

      if (error) {
        logger.error('[OrderDetails] Error fetching order details', error);
        throw error;
      }

      if (import.meta.env.DEV) timeEnd(`[OrderDetails] Load full data for ${order.id}`);
      
      return data;
    },
    enabled: open,
    staleTime: 60 * 1000,
  });

  // Use full details if available, otherwise use the summary from table
  const orderData = fullOrderDetails || order;
  const paymentMethodDetails = orderData?.practice_payment_methods;

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
      
      // Collect patient account IDs from order lines
      const patientAccountIds = new Set<string>();
      order.order_lines.forEach((line: any) => {
        if (line.patient_id) {
          patientAccountIds.add(line.patient_id);
        }
      });

      // Fetch plain-text patient data as fallback by id (not user_id)
      const patientDataMap = new Map<string, any>();
      if (patientAccountIds.size > 0) {
        try {
          const { data: patientData } = await supabase
            .from('patient_accounts')
            .select('id, user_id, first_name, last_name, email, phone, address_street, address_suite, address_city, address_state, address_zip, allergies')
            .in('id', Array.from(patientAccountIds));
          
          patientData?.forEach(p => {
            patientDataMap.set(p.id, p); // Key by id, not user_id
          });
        } catch (error) {
          logger.error('Failed to fetch patient fallback data', error);
        }
      }
      
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
        
        // Fallback to plain-text if available (using id not user_id)
        const plainData = patientDataMap.get(patientId);
        if (plainData?.allergies && plainData.allergies !== '[ENCRYPTED]') {
          return {
            patientId,
            phi: {
              allergies: plainData.allergies,
              notes: null
            }
          };
        }
        
        // Always return something to mark as loaded
        return { 
          patientId, 
          phi: { 
            allergies: 'NKDA' // Default fallback
          } 
        };
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
        
        // Fallback to plain-text patient data
        const line = order.order_lines.find((l: any) => l.id === lineId);
        const plainData = line?.patient_id ? patientDataMap.get(line.patient_id) : null;
        if (plainData) {
          return {
            lineId,
            contact: {
              patient_email: plainData.email !== '[ENCRYPTED]' ? plainData.email : null,
              patient_phone: plainData.phone !== '[ENCRYPTED]' ? plainData.phone : null,
              patient_address: (() => {
                const parts = [plainData.address_street, plainData.address_suite, plainData.address_city, plainData.address_state, plainData.address_zip].filter(Boolean);
                const constructed = parts.join(', ');
                return constructed || null;
              })(),
            }
          };
        }
        
        return { lineId, contact: {} }; // Always return something to mark as loaded
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

          // Log PHI access only if allergies exist
          const line = order.order_lines.find((l: any) => l.patient_id === result.patientId);
          if (line && result.phi.allergies) {
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
      setPatientFallbackData(patientDataMap);

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

  const handleDialogClose = async (open: boolean) => {
    if (!open) {
      // Auto-save notes if modified before closing
      await saveNotesIfModified();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
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
          <div className="flex flex-wrap gap-2 mt-2">
            {canSendToPharmacy && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendToPharmacy}
                disabled={isSendingToPharmacy}
                className="w-fit"
              >
                <Send className="h-4 w-4 mr-2" />
                {isSendingToPharmacy ? "Sending..." : "Send to Pharmacy API"}
              </Button>
            )}
            {order.status !== 'cancelled' && canCancelOrder() && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setCancelDialogOpen(true)}
                className="w-fit"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel Order
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <ReportNotesSection
            orderId={order.id}
            initialNotes={orderData.report_notes}
            doctorId={order.doctor_id}
            practiceId={order.order_lines?.[0]?.providers?.practice_id}
            onSuccess={onSuccess}
            onNotesChange={(notes) => {
              setNotesModified(true);
              setPendingNotes(notes);
            }}
          />

          <div className="grid grid-cols-2 gap-4">
            {(() => {
              const doctorName = order.profiles?.prescriber_name || order.profiles?.full_name || order.profiles?.name || null;
              return doctorName ? (
                <div>
                  <p className="text-sm text-muted-foreground">Doctor</p>
                  <p className="font-medium">{doctorName}</p>
                </div>
              ) : null;
            })()}
            {effectiveRole !== "pharmacy" && (
              <div className="col-span-2">
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">${orderData.subtotal_before_discount?.toFixed(2) || '0.00'}</span>
                  </div>
                  
                  {orderData.discount_amount && orderData.discount_amount > 0 && (
                    <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                      <span>Discount ({orderData.discount_percentage}%):</span>
                      <span className="font-medium">-${orderData.discount_amount.toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping & Handling:</span>
                    <span className="font-medium">${orderData.shipping_total?.toFixed(2) || '0.00'}</span>
                  </div>
                  
                  {orderData.merchant_fee_amount && orderData.merchant_fee_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Merchant Processing Fee ({orderData.merchant_fee_percentage}%):
                      </span>
                      <span className="font-medium">${orderData.merchant_fee_amount.toFixed(2)}</span>
                    </div>
                  )}
                  
                  <Separator />
                  
                  <div className="flex justify-between text-base font-bold">
                    <span>Grand Total:</span>
                    <span className="text-primary">${orderData.total_amount?.toFixed(2) || '0.00'}</span>
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
            <div className="p-4 bg-muted rounded-lg flex items-start gap-3">
              <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold mb-1">
                  {orderData.ship_to === 'practice' ? 'Ship to Practice' : 'Ship to Patient'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {orderData.ship_to === 'practice'
                    ? (orderData.practice_address || order.practice_address || 'No practice address on file')
                    : (() => {
                        // Priority: 1) decrypted contact, 2) formatted_shipping_address from fresh data, 3) patient fallback, 4) message
                        const firstLineId = orderData.order_lines?.[0]?.id || order.order_lines?.[0]?.id;
                        const addr = firstLineId ? decryptedContactInfo.get(firstLineId)?.patient_address : null;
                        if (addr) return addr;
                        if (orderData.formatted_shipping_address) return orderData.formatted_shipping_address;
                        if (order.formatted_shipping_address) return order.formatted_shipping_address;
                        // Try constructing from patient fallback data
                        const firstPatientId = orderData.order_lines?.[0]?.patient_id || order.order_lines?.[0]?.patient_id;
                        if (firstPatientId && patientFallbackData.has(firstPatientId)) {
                          const p = patientFallbackData.get(firstPatientId);
                          const parts = [p.address_street, p.address_suite, p.address_city, p.address_state, p.address_zip].filter(Boolean);
                          if (parts.length > 0) return parts.join(', ');
                        }
                        return 'No patient address on file';
                      })()
                  }
                </p>
              </div>
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


          <div>
            <h3 className="text-lg font-semibold mb-4">Order Lines</h3>
            <div className="space-y-4">
              {(orderData?.order_lines || order.order_lines)?.map((line: any) => (
                <div key={line.id} className="p-4 border border-border rounded-md space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Product</p>
                      <div className="flex flex-col gap-1">
                        <p className="font-medium">
                          {line.products?.name || "N/A"}
                          {line.product_variants?.dosage_label && (
                            <span className="text-sm text-muted-foreground ml-1">
                              {line.product_variants.dosage_label}
                            </span>
                          )}
                        </p>
                        {line.products?.product_types?.name && (
                          <Badge variant="outline" className="text-xs w-fit">
                            {line.products.product_types.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Qty</p>
                      <p className="font-medium">{line.quantity}</p>
                    </div>
                    {(() => {
                      const dlMatch = line.product_variants?.dosage_label?.match(/[\-–]\s*(\d+)\s*mL/i);
                      if (dlMatch) {
                        return (
                          <div>
                            <p className="text-sm text-muted-foreground">Volume</p>
                            <p className="font-medium">{dlMatch[1]}mL</p>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    <div>
                      <p className="text-sm text-muted-foreground">Shipping Speed</p>
                      <Badge variant="outline" className="capitalize w-fit">
                        {line.shipping_speed === '2day' ? '2-Day Shipping' :
                         line.shipping_speed === 'overnight' ? 'Overnight Shipping' :
                         line.shipping_speed === 'priority' ? 'Priority Shipping' :
                         line.shipping_speed === 'first_class' ? 'First Class' :
                         'Ground (historical)'}
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
                  
                  {order.ship_to === 'practice' && canLinkPatient && (
                    <div className="pt-2 border-t border-border">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Patient</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {line.patient_id && line.patient_name !== 'Practice Order' ? (
                          <>
                            <p className="text-sm font-medium">{line.patient_name}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => handleUnlinkPatient(line.id)}
                            >
                              Clear
                            </Button>
                          </>
                        ) : (
                          <Select onValueChange={(value) => handleLinkPatient(line.id, value)}>
                            <SelectTrigger className="w-[220px] h-8 text-sm">
                              <SelectValue placeholder="Select Patient" />
                            </SelectTrigger>
                            <SelectContent>
                              {practicePatients?.map((patient) => (
                                <SelectItem key={patient.id} value={patient.id}>
                                  {patient.last_name}, {patient.first_name}
                                </SelectItem>
                              ))}
                              {(!practicePatients || practicePatients.length === 0) && (
                                <SelectItem value="__none" disabled>No patients found</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {order.ship_to === 'patient' && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-sm text-muted-foreground mb-2">Patient Information</p>
                      <div className="grid grid-cols-2 gap-2">
                         <div>
                           <p className="text-xs text-muted-foreground">Name</p>
                           <p className="text-sm font-medium">
                             {line.patient_name || (() => {
                               const patientInfo = patientFallbackData.get(line.patient_id);
                               return patientInfo?.first_name && patientInfo?.last_name 
                                 ? `${patientInfo.first_name} ${patientInfo.last_name}` 
                                 : 'Patient';
                             })()}
                           </p>
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
                        {canViewPHI && line.patient_id && (
                          <div className="col-span-2 pt-2 border-t border-primary/30">
                            <p className="text-xs font-semibold text-primary flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Patient Allergies (PHI)
                             </p>
                              {(() => {
                                const phi = decryptedPatientPHI.get(line.patient_id);
                                const isLoading = !decryptedPatientPHI.has(line.patient_id);
                                
                                if (isLoading) {
                                  return (
                                    <p className="text-xs text-muted-foreground italic mt-1">
                                      Loading...
                                    </p>
                                  );
                                }
                                
                                const allergiesText = phi?.allergies || 'NKDA';
                                
                                return (
                                  <p className="text-sm text-primary-foreground bg-primary/25 p-2 rounded mt-1 border border-primary/40 shadow-inner">
                                    {allergiesText}
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
