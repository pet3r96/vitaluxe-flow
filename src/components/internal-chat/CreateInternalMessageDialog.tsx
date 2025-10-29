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
import { Send, Circle, Info, AlertCircle, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const [messageType, setMessageType] = useState<'general' | 'announcement' | 'patient_specific'>('general');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
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
    enabled: open
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
    enabled: open && messageType === 'patient_specific'
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
    if (!subject.trim() || !body.trim() || selectedRecipients.length === 0) {
      toast.error('Please fill in all required fields and select at least one recipient');
      return;
    }

    if (messageType === 'patient_specific' && !selectedPatient) {
      toast.error('Please select a patient');
      return;
    }

    setSending(true);
    try {
      // Create the message
      const { data: message, error: messageError } = await supabase
        .from('internal_messages')
        .insert({
          subject,
          body,
          message_type: messageType,
          priority,
          patient_id: messageType === 'patient_specific' ? selectedPatient : null
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

      toast.success('Message sent successfully');
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
    setMessageType('general');
    setPriority('medium');
    setSubject('');
    setBody('');
    setSelectedPatient('');
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

  const canSend = subject.trim() && body.trim() && selectedRecipients.length > 0 &&
    (messageType !== 'patient_specific' || selectedPatient);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>New Internal Message</DialogTitle>
          <DialogDescription>
            Send a secure message to your practice team
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
                  <Label htmlFor="general" className="cursor-pointer">General Message</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="announcement" id="announcement" />
                  <Label htmlFor="announcement" className="cursor-pointer">Announcement</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="patient_specific" id="patient" />
                  <Label htmlFor="patient" className="cursor-pointer">Patient-Specific</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Conditional Patient Selector */}
            {messageType === 'patient_specific' && (
              <div className="space-y-2">
                <Label>Patient *</Label>
                <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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

            {/* Recipients */}
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
