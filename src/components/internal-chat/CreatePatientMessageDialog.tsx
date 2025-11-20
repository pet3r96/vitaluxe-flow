import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Circle, Info, AlertCircle, AlertTriangle, UserPlus } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";
import { useQueryClient } from "@tanstack/react-query";

interface CreatePatientMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  practiceId: string;
  onSuccess: () => void;
}

export function CreatePatientMessageDialog({
  open,
  onOpenChange,
  practiceId,
  onSuccess
}: CreatePatientMessageDialogProps) {
  const { effectiveUserId } = useAuth();
  
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const queryClient = useQueryClient();

  // Fetch patients directly from patient_accounts table (matches Practice Calendar approach)
  const { data: patients = [], isLoading: isLoadingPatients, refetch: refetchPatients } = useQuery({
    queryKey: ['practice-patients-dialog', practiceId, open],
    queryFn: async () => {
      if (!practiceId) {
        logger.warn('[CreatePatientMessageDialog] No practiceId available');
        return [];
      }
      
      logger.info('[CreatePatientMessageDialog] Fetching patients for practice:', { practiceId });
      
      const { data, error } = await supabase
        .from('patient_accounts')
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone,
          practice_id,
          user_id,
          status
        `)
        .eq('practice_id', practiceId)
        .order('last_name');
      
      if (error) {
        logger.error('[CreatePatientMessageDialog] Error fetching patients:', error);
        throw error;
      }
      
      // Transform data to match component expectations
      const transformedData = (data || []).map(pa => ({
        patient_id: pa.id,
        patient_account_id: pa.id,
        name: `${pa.first_name || ''} ${pa.last_name || ''}`.trim(),
        email: pa.email || '',
        phone: pa.phone,
        practice_id: pa.practice_id,
        has_portal_access: pa.user_id !== null && pa.status !== 'disabled',
        has_portal_account: pa.user_id !== null
      }));
      
      logger.info('[CreatePatientMessageDialog] Patients fetched:', { 
        count: transformedData.length,
        withPortal: transformedData.filter(p => p.has_portal_access).length 
      });
      return transformedData;
    },
    enabled: open && !!practiceId,
    staleTime: 0,
    refetchOnMount: true
  });

  // Mutation to create portal account
  const createPortalAccountMutation = useMutation({
    mutationFn: async (patientId: string) => {
      const { data, error } = await supabase.functions.invoke('create-patient-portal-account', {
        body: { patientId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Portal account created successfully');
      refetchPatients();
    },
    onError: (error: any) => {
      logger.error('Error creating portal account', error);
      toast.error(error.message || 'Failed to create portal account');
    }
  });

  const handleSend = async () => {
    if (!effectiveUserId) {
      toast.error('Not authorized to send messages. Please refresh and try again.');
      return;
    }

    // Validate fields
    if (!selectedPatient || !subject.trim() || !body.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Check if patient has portal account
    if (!selectedPatient.patient_account_id) {
      toast.error('This patient does not have a portal account. Please create one first.');
      return;
    }

    setSending(true);
    try {
      // Use the edge function with patient_account_id
      const { data, error } = await supabase.functions.invoke('send-patient-message', {
        body: {
          patient_id: selectedPatient.patient_account_id,
          practice_id: practiceId,
          subject: subject,
          message: body,
          sender_type: 'practice' // ✅ FIX: Use 'practice' to match CHECK constraint
        }
      });

      if (error) throw error;

      // ✅ PHASE 3: Query invalidations for UI refresh
      queryClient.invalidateQueries({ queryKey: ['patient-messages', selectedPatient.patient_account_id] });
      queryClient.invalidateQueries({ queryKey: ['patient-chat-threads', selectedPatient.patient_account_id] });
      queryClient.invalidateQueries({ queryKey: ['patient-messages-inbox', practiceId] });
      queryClient.invalidateQueries({ queryKey: ['inbox-unread-threads', practiceId] });

      toast.success('Message sent to patient');
      onSuccess();
      handleClose();
    } catch (error) {
      logger.error('Error sending patient message', error, { patientAccountId: selectedPatient.patient_account_id });
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setSelectedPatient(null);
    setSubject('');
    setBody('');
    onOpenChange(false);
  };

  const canSend = selectedPatient && subject.trim() && body.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>New Patient Message</DialogTitle>
          <DialogDescription>
            Send a message to a patient
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <form className="space-y-4 p-1">
            {/* Patient Selector */}
            <div className="space-y-2">
              <Label>Patient *</Label>
              <Select 
                value={selectedPatient?.patient_id || ''} 
                onValueChange={(id) => {
                  const patient = patients.find((p: any) => p.patient_id === id);
                  setSelectedPatient(patient || null);
                }}
              >
                <SelectTrigger disabled={patients.length === 0}>
                  <SelectValue placeholder={patients.length === 0 ? "No patients available" : "Select a patient"} />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingPatients ? (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      Loading patients...
                    </div>
                   ) : patients.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      No patients found. Please add patients to your practice first.
                    </div>
                  ) : (
                    patients.map((patient: any) => (
                      <SelectItem key={patient.patient_id} value={patient.patient_id}>
                        <div className="flex flex-col">
                          <span>{patient.name}</span>
                          {patient.email && (
                            <span className="text-xs text-muted-foreground">{patient.email}</span>
                          )}
                          {!patient.has_portal_access && (
                            <span className="text-xs text-orange-500">⚠ No portal account</span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              
              {/* Create Portal Account Button */}
              {selectedPatient && !selectedPatient.has_portal_access && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => createPortalAccountMutation.mutate(selectedPatient.patient_id)}
                  disabled={createPortalAccountMutation.isPending}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  {createPortalAccountMutation.isPending ? 'Creating...' : 'Create Portal Account'}
                </Button>
              )}
            </div>


            {/* Subject */}
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Input
                placeholder="Enter message subject..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            {/* Message Body */}
            <div className="space-y-2">
              <Label>Message *</Label>
              <Textarea
                placeholder="Type your message here..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
              />
            </div>
          </form>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!canSend || sending}>
            <Send className="mr-2 h-4 w-4" />
            {sending ? 'Sending...' : 'Send Message'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
