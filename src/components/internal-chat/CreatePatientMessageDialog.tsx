import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Circle, Info, AlertCircle, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

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
  
  const [patientId, setPatientId] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  // Fetch patients
  const { data: patients = [], isLoading: isLoadingPatients } = useQuery({
    queryKey: ['practice-patients', practiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id, name, email, phone')
        .eq('practice_id', practiceId)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!practiceId
  });

  const handleSend = async () => {
    if (!effectiveUserId) {
      toast.error('Not authorized to send messages. Please refresh and try again.');
      return;
    }

    // Validate fields
    if (!patientId || !subject.trim() || !body.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase
        .from('patient_messages')
        .insert({
          patient_id: patientId,
          practice_id: practiceId,
          sender_id: effectiveUserId,
          sender_type: 'practice',
          subject,
          message_body: body,
          urgency: urgency || 'medium',
          resolved: false
        });

      if (error) throw error;

      toast.success('Message sent to patient');
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error sending patient message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setPatientId('');
    setUrgency('medium');
    setSubject('');
    setBody('');
    onOpenChange(false);
  };

  const canSend = patientId && subject.trim() && body.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
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
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a patient" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingPatients ? (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      Loading patients...
                    </div>
                  ) : patients.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      No patients found
                    </div>
                  ) : (
                    patients.map((patient: any) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        <div className="flex flex-col">
                          <span>{patient.name}</span>
                          {patient.email && (
                            <span className="text-xs text-muted-foreground">{patient.email}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Priority/Urgency */}
            <div className="space-y-2">
              <Label>Urgency</Label>
              <Select value={urgency} onValueChange={(v: any) => setUrgency(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <div className="flex items-center gap-2">
                      <Circle className="h-4 w-4 text-gray-500" />
                      Low
                    </div>
                  </SelectItem>
                  <SelectItem value="medium">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-500" />
                      Medium
                    </div>
                  </SelectItem>
                  <SelectItem value="high">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                      High
                    </div>
                  </SelectItem>
                  <SelectItem value="urgent">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      Urgent
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
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
