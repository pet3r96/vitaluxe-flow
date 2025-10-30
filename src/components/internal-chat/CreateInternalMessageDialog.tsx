import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, Circle, Info, AlertCircle, AlertTriangle, Users, MessageCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface CreateInternalMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  practiceId: string;
  onSuccess: () => void;
}

export function CreateInternalMessageDialog({
  open,
  onOpenChange,
  practiceId,
  onSuccess
}: CreateInternalMessageDialogProps) {
  const { effectiveUserId } = useAuth();
  
  // Primary destination selection
  const [destination, setDestination] = useState<'practice_team' | 'patient'>('practice_team');
  
  // Practice team fields
  const [messageType, setMessageType] = useState<'general' | 'announcement'>('general');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [regardingPatient, setRegardingPatient] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  
  // Patient communication fields
  const [selectedPatientId, setSelectedPatientId] = useState('');
  
  // Common fields
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  // Fetch practice team members
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['practice-team-members', practiceId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_practice_team_members', {
        p_practice_id: practiceId
      });
      if (error) throw error;
      return data;
    },
    enabled: open && destination === 'practice_team'
  });

  // Fetch patients for the practice
  const { data: patients = [] } = useQuery({
    queryKey: ['practice-patients', practiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id, name')
        .eq('practice_id', practiceId)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: open
  });

  const handleSelectAll = () => {
    if (selectedRecipients.length === teamMembers.length) {
      setSelectedRecipients([]);
    } else {
      setSelectedRecipients(teamMembers.map((m: any) => m.user_id));
    }
  };

  const toggleRecipient = (userId: string) => {
    setSelectedRecipients(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSend = async () => {
    if (!effectiveUserId) {
      toast.error('Not authorized to send messages. Please refresh and try again.');
      return;
    }

    // Validate based on destination
    if (destination === 'practice_team') {
      if (!subject.trim() || !body.trim() || selectedRecipients.length === 0) {
        toast.error('Please fill in all required fields and select at least one recipient');
        return;
      }
    } else {
      if (!subject.trim() || !body.trim() || !selectedPatientId) {
        toast.error('Please fill in all required fields and select a patient');
        return;
      }
    }

    setSending(true);
    try {
      if (destination === 'practice_team') {
        // Send to practice team via internal_messages
        const { data: message, error: messageError } = await supabase
          .from('internal_messages')
          .insert({
            practice_id: practiceId,
            created_by: effectiveUserId,
            subject,
            body,
            message_type: messageType,
            priority,
            patient_id: regardingPatient || null
          } as any)
          .select()
          .single();

        if (messageError) throw messageError;

        // Add recipients
        const { error: recipientsError } = await supabase
          .from('internal_message_recipients')
          .insert(
            selectedRecipients.map(recipientId => ({
              message_id: message.id,
              recipient_id: recipientId
            }))
          );

        if (recipientsError) throw recipientsError;

        toast.success('Message sent to practice team');
      } else {
        // Send to patient via edge function
        const { error } = await supabase.functions.invoke('send-patient-message', {
          body: {
            patient_id: selectedPatientId,
            subject,
            message: body,
            sender_type: 'provider',
            practice_id: practiceId
          }
        });

        if (error) throw error;

        toast.success('Message sent to patient');
      }

      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setDestination('practice_team');
    setMessageType('general');
    setPriority('normal');
    setSubject('');
    setBody('');
    setRegardingPatient('');
    setSelectedRecipients([]);
    setSelectedPatientId('');
    onOpenChange(false);
  };

  // Group recipients by role
  const groupedRecipients = teamMembers.reduce((acc: any, member: any) => {
    if (!acc[member.role_type]) {
      acc[member.role_type] = [];
    }
    acc[member.role_type].push(member);
    return acc;
  }, {});

  const canSend = destination === 'practice_team'
    ? subject.trim() && body.trim() && selectedRecipients.length > 0
    : subject.trim() && body.trim() && selectedPatientId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
          <DialogDescription>
            Send messages to your practice team or communicate with patients
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <form className="space-y-4 p-1">
            {/* Message Destination */}
            <div className="space-y-2">
              <Label>Message Destination</Label>
              <RadioGroup value={destination} onValueChange={(v: any) => setDestination(v)}>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="practice_team" id="practice_team" />
                  <Label htmlFor="practice_team" className="cursor-pointer flex items-center gap-2 flex-1">
                    <Users className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Practice Team (Internal)</div>
                      <div className="text-xs text-muted-foreground">Send to team members within your practice</div>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="patient" id="patient" />
                  <Label htmlFor="patient" className="cursor-pointer flex items-center gap-2 flex-1">
                    <MessageCircle className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Patient Communication</div>
                      <div className="text-xs text-muted-foreground">Send a message to a specific patient</div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Practice Team Fields */}
            {destination === 'practice_team' && (
              <>
                {/* Message Type */}
                <div className="space-y-2">
                  <Label>Message Type</Label>
                  <RadioGroup value={messageType} onValueChange={(v: any) => setMessageType(v)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="general" id="general" />
                      <Label htmlFor="general" className="cursor-pointer">General</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="announcement" id="announcement" />
                      <Label htmlFor="announcement" className="cursor-pointer">Announcement</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Optional Patient Reference */}
                <div className="space-y-2">
                  <Label>Regarding Patient (Optional)</Label>
                  <Select value={regardingPatient} onValueChange={setRegardingPatient}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a patient (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Categorizes the message by patient but does not send it to the patient
                  </p>
                </div>

                {/* Priority */}
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
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
                      <SelectItem value="normal">
                        <div className="flex items-center gap-2">
                          <Info className="h-4 w-4 text-blue-500" />
                          Normal
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
              </>
            )}

            {/* Patient Communication Fields */}
            {destination === 'patient' && (
              <div className="space-y-2">
                <Label>Select Patient *</Label>
                <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a patient..." />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  This message will be sent to the patient and visible in their patient portal
                </p>
              </div>
            )}

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

            {/* Recipients (Practice Team only) */}
            {destination === 'practice_team' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Recipients * ({selectedRecipients.length} selected)</Label>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    {selectedRecipients.length === teamMembers.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>

                <div className="border rounded-lg p-3 space-y-3 max-h-[200px] overflow-y-auto">
                  {Object.entries(groupedRecipients).map(([roleType, members]: [string, any]) => (
                    <div key={roleType}>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                        {roleType === 'admin' ? 'Practice Owner' : roleType === 'provider' ? 'Providers' : 'Staff'}
                      </h4>
                      <div className="space-y-2">
                        {members.map((member: any) => (
                          <div key={member.user_id} className="flex items-center space-x-2">
                            <Checkbox
                              id={member.user_id}
                              checked={selectedRecipients.includes(member.user_id)}
                              onCheckedChange={() => toggleRecipient(member.user_id)}
                            />
                            <Label
                              htmlFor={member.user_id}
                              className="text-sm font-normal cursor-pointer flex-1"
                            >
                              {member.name}
                              <span className="text-xs text-muted-foreground ml-2">
                                ({member.role_display})
                              </span>
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
