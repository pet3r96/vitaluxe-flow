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
  
  // Practice team fields only
  const [messageType, setMessageType] = useState<'general' | 'announcement'>('general');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [regardingPatient, setRegardingPatient] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  
  // Common fields
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  // Fetch practice team members (always fetch when dialog is open)
  const { data: teamMembers = [], isLoading: isLoadingTeamMembers, refetch: refetchTeamMembers } = useQuery({
    queryKey: ['practice-team-members', practiceId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_practice_team_members', {
        p_practice_id: practiceId
      });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!practiceId
  });

  // Fetch patients for the "Regarding Patient" optional field
  const { data: patients = [] } = useQuery({
    queryKey: ['practice-patients', practiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_accounts')
        .select('id, first_name, last_name')
        .eq('practice_id', practiceId)
        .order('last_name');
      if (error) throw error;
      return (data || []).map(p => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name}`
      }));
    },
    enabled: open && !!practiceId
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

    // Validate fields
    if (!subject.trim() || !body.trim() || selectedRecipients.length === 0) {
      toast.error('Please fill in all required fields and select at least one recipient');
      return;
    }

    setSending(true);
    try {
      // Validate patient ID - ensure it exists in the loaded patients list
      const validPatientIds = new Set(patients.map((p: any) => p.id));
      const validatedPatientId = regardingPatient && validPatientIds.has(regardingPatient) 
        ? regardingPatient 
        : null;

      if (regardingPatient && !validatedPatientId) {
        console.warn('⚠️ Patient ID not found, clearing patient reference:', regardingPatient);
      }

      console.log('📨 Sending internal message:', {
        practice_id: practiceId,
        created_by: effectiveUserId,
        subject,
        message_type: messageType,
        priority,
        patient_id: validatedPatientId,
        recipient_count: selectedRecipients.length
      });

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
          patient_id: validatedPatientId
        } as any)
        .select()
        .single();

      if (messageError) {
        console.error('❌ Error inserting internal_messages:', messageError);
        
        // Check if it's a FK constraint error on patient_id
        if (messageError.message?.includes('internal_messages_patient_id_fkey')) {
          // Retry without patient reference
          console.log('🔄 Retrying without patient reference...');
          const { data: retryMessage, error: retryError } = await supabase
            .from('internal_messages')
            .insert({
              practice_id: practiceId,
              created_by: effectiveUserId,
              subject,
              body,
              message_type: messageType,
              priority,
              patient_id: null
            } as any)
            .select()
            .single();

          if (retryError) {
            throw new Error(`Failed to create message: ${retryError.message}`);
          }

          toast.warning('Message sent without patient link (patient not found)');
          
          // Continue with recipients using the retry message
          const recipientsData = selectedRecipients.map(recipientId => ({
            message_id: retryMessage.id,
            recipient_id: recipientId
          }));

          const { error: recipientsError } = await supabase
            .from('internal_message_recipients')
            .insert(recipientsData);

          if (recipientsError) {
            throw new Error(`Failed to add recipients: ${recipientsError.message}`);
          }

          onSuccess();
          handleClose();
          return;
        }
        
        throw new Error(`Failed to create message: ${messageError.message || JSON.stringify(messageError)}`);
      }

      console.log('✅ Message created:', message.id);

      // Add recipients
      const recipientsData = selectedRecipients.map(recipientId => ({
        message_id: message.id,
        recipient_id: recipientId
      }));

      console.log('📬 Adding recipients:', recipientsData);

      const { error: recipientsError } = await supabase
        .from('internal_message_recipients')
        .insert(recipientsData);

      if (recipientsError) {
        console.error('❌ Error inserting internal_message_recipients:', recipientsError);
        throw new Error(`Failed to add recipients: ${recipientsError.message || JSON.stringify(recipientsError)}`);
      }

      console.log('✅ Recipients added successfully');
      toast.success('Message sent to practice team');
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('❌ Error sending internal message:', error);
      toast.error(error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setMessageType('general');
    setPriority('medium');
    setSubject('');
    setBody('');
    setRegardingPatient('');
    setSelectedRecipients([]);
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

  const canSend = subject.trim() && body.trim() && selectedRecipients.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>New Internal Message</DialogTitle>
          <DialogDescription>
            Send a message to your practice team members
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <form className="space-y-4 p-1">
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
                  <Select value={regardingPatient || "none"} onValueChange={(v) => setRegardingPatient(v === "none" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a patient (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="text-muted-foreground italic">None (System-wide message)</span>
                      </SelectItem>
                      {patients.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Categorizes the message by patient but does not send it to the patient
                  </p>
                </div>

                {/* Recipients (Practice Team only) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Recipients * ({selectedRecipients.length} selected)</Label>
                    {teamMembers.length > 0 && (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={handleSelectAll}
                      >
                        {selectedRecipients.length === teamMembers.length ? 'Deselect All' : 'Select All'}
                      </Button>
                    )}
                  </div>

                  <div className="border rounded-lg p-3 space-y-3 max-h-[200px] overflow-y-auto">
                    {isLoadingTeamMembers ? (
                      <div className="text-sm text-muted-foreground text-center py-4">
                        Loading team members...
                      </div>
                    ) : teamMembers.length === 0 ? (
                      <div className="text-center py-4 space-y-2">
                        <p className="text-sm text-muted-foreground">No team members found</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => refetchTeamMembers()}
                        >
                          Retry
                        </Button>
                      </div>
                    ) : Object.keys(groupedRecipients).length === 0 ? (
                      <div className="space-y-2">
                        {teamMembers.map((member: any) => (
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
                    ) : (
                      Object.entries(groupedRecipients).map(([roleType, members]: [string, any]) => (
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
                      ))
                    )}
                  </div>
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
