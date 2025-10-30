import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, CheckCircle2, Clock, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface PatientMessagesTabProps {
  practiceId: string;
  userId: string;
}

interface PatientMessage {
  id: string;
  patient_id: string;
  practice_id: string;
  sender_id: string;
  sender_type: string;
  subject: string;
  message_body: string;
  urgency: 'low' | 'normal' | 'high' | 'urgent';
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  read_at: string | null;
  created_at: string;
  patient: {
    name: string;
    email: string;
  };
}

export const PatientMessagesTab = ({ practiceId, userId }: PatientMessagesTabProps) => {
  const [selectedMessage, setSelectedMessage] = useState<PatientMessage | null>(null);
  const [replyText, setReplyText] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("unresolved");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const queryClient = useQueryClient();

  // Fetch patient messages
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['patient-messages', practiceId, urgencyFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('patient_messages')
        .select('*')
        .eq('practice_id', practiceId)
        .order('created_at', { ascending: false });

      if (urgencyFilter !== 'all') {
        query = query.eq('urgency', urgencyFilter);
      }

      if (statusFilter === 'resolved') {
        query = query.eq('resolved', true);
      } else if (statusFilter === 'unresolved') {
        query = query.eq('resolved', false);
      }

      const { data: messagesData, error } = await query;
      if (error) throw error;

      // Fetch patient details for each message
      const patientIds = [...new Set(messagesData?.map(m => m.patient_id))];
      const { data: patientsData } = await supabase
        .from('patients')
        .select('id, name, email')
        .in('id', patientIds);

      const patientsMap = new Map(patientsData?.map(p => [p.id, p]) || []);

      return (messagesData || []).map(msg => ({
        ...msg,
        patient: patientsMap.get(msg.patient_id) || { name: 'Unknown', email: '' }
      })) as PatientMessage[];
    },
  });

  // Group messages by patient
  const messagesByPatient = messages.reduce((acc, msg) => {
    const key = msg.patient_id;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(msg);
    return acc;
  }, {} as Record<string, PatientMessage[]>);

  // Get thread for selected message
  const { data: threadMessages = [] } = useQuery({
    queryKey: ['patient-message-thread', selectedMessage?.patient_id],
    queryFn: async () => {
      if (!selectedMessage) return [];
      
      const { data, error } = await supabase
        .from('patient_messages')
        .select('*')
        .eq('patient_id', selectedMessage.patient_id)
        .eq('practice_id', practiceId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedMessage,
  });

  // Send reply mutation
  const sendReplyMutation = useMutation({
    mutationFn: async ({ patientId, message }: { patientId: string; message: string }) => {
      // Get the thread_id from the first message
      const threadId = threadMessages[0]?.thread_id || threadMessages[0]?.id;
      
      const { error } = await supabase
        .from('patient_messages')
        .insert({
          patient_id: patientId,
          practice_id: practiceId,
          sender_id: userId,
          sender_type: 'provider',
          thread_id: threadId,
          parent_message_id: threadMessages[0]?.id,
          subject: 'Reply from Practice',
          message_body: message,
          urgency: selectedMessage?.urgency || 'normal',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Reply sent');
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ['patient-messages'] });
      queryClient.invalidateQueries({ queryKey: ['patient-message-thread'] });
    },
    onError: (error: any) => {
      toast.error('Failed to send reply', { description: error.message });
    },
  });

  // Update urgency mutation
  const updateUrgencyMutation = useMutation({
    mutationFn: async ({ messageId, urgency }: { messageId: string; urgency: string }) => {
      const { error } = await supabase
        .from('patient_messages')
        .update({ urgency })
        .eq('id', messageId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Urgency updated');
      queryClient.invalidateQueries({ queryKey: ['patient-messages'] });
    },
  });

  // Resolve message mutation
  const resolveMutation = useMutation({
    mutationFn: async ({ patientId, notes }: { patientId: string; notes: string }) => {
      // Update all messages in this patient thread
      const { error } = await supabase
        .from('patient_messages')
        .update({
          resolved: true,
          resolved_by: userId,
          resolved_at: new Date().toISOString(),
          resolution_notes: notes || null,
        })
        .eq('patient_id', patientId)
        .eq('practice_id', practiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Conversation marked as resolved');
      setResolutionNotes("");
      setSelectedMessage(null);
      queryClient.invalidateQueries({ queryKey: ['patient-messages'] });
    },
  });

  // Reopen mutation
  const reopenMutation = useMutation({
    mutationFn: async (patientId: string) => {
      const { error } = await supabase
        .from('patient_messages')
        .update({
          resolved: false,
          resolved_by: null,
          resolved_at: null,
          resolution_notes: null,
        })
        .eq('patient_id', patientId)
        .eq('practice_id', practiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Conversation reopened');
      queryClient.invalidateQueries({ queryKey: ['patient-messages'] });
    },
  });

  const getUrgencyBadge = (urgency: string) => {
    const config = {
      urgent: { color: "bg-red-500/10 text-red-500 border-red-500/30", icon: AlertCircle },
      high: { color: "bg-orange-500/10 text-orange-500 border-orange-500/30", icon: AlertCircle },
      normal: { color: "bg-blue-500/10 text-blue-500 border-blue-500/30", icon: Clock },
      low: { color: "bg-gray-500/10 text-gray-500 border-gray-500/30", icon: Clock },
    };
    const { color, icon: Icon } = config[urgency as keyof typeof config] || config.normal;
    
    return (
      <Badge variant="outline" className={color}>
        <Icon className="w-3 h-3 mr-1" />
        {urgency.charAt(0).toUpperCase() + urgency.slice(1)}
      </Badge>
    );
  };

  const handleSelectMessage = (msg: PatientMessage) => {
    setSelectedMessage(msg);
    
    // Mark as read
    if (!msg.read_at && msg.sender_type === 'patient') {
      supabase
        .from('patient_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', msg.id)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['patient-messages'] });
        });
    }
  };

  return (
    <div className="flex gap-4 h-[600px]">
      {/* Left: Message list */}
      <div className="w-1/3 border-r border-border pr-4">
        <div className="space-y-4 mb-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unresolved">Unresolved</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Urgency</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="h-[480px]">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : Object.entries(messagesByPatient).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No messages</div>
          ) : (
            <div className="space-y-2">
              {Object.entries(messagesByPatient).map(([patientId, msgs]) => {
                const latestMsg = msgs[0];
                const unreadCount = msgs.filter(m => !m.read_at && m.sender_type === 'patient').length;
                
                return (
                  <Card
                    key={patientId}
                    className={`p-3 cursor-pointer hover:bg-accent transition-colors ${
                      selectedMessage?.patient_id === patientId ? 'bg-accent' : ''
                    }`}
                    onClick={() => handleSelectMessage(latestMsg)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm truncate">
                            {latestMsg.patient.name}
                          </p>
                          {unreadCount > 0 && (
                            <Badge variant="default" className="text-xs">
                              {unreadCount}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {latestMsg.message_body}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          {getUrgencyBadge(latestMsg.urgency)}
                          {latestMsg.resolved && (
                            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Resolved
                            </Badge>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(latestMsg.created_at), 'MMM d')}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right: Message thread */}
      <div className="flex-1">
        {selectedMessage ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h3 className="font-semibold">{selectedMessage.patient.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedMessage.patient.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={selectedMessage.urgency}
                  onValueChange={(value) => updateUrgencyMutation.mutate({ messageId: selectedMessage.id, urgency: value })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
                
                {selectedMessage.resolved ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => reopenMutation.mutate(selectedMessage.patient_id)}
                  >
                    Reopen
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (resolutionNotes || confirm('Mark as resolved without notes?')) {
                        resolveMutation.mutate({ patientId: selectedMessage.patient_id, notes: resolutionNotes });
                      }
                    }}
                  >
                    Mark Resolved
                  </Button>
                )}
              </div>
            </div>

            <ScrollArea className="h-[350px]">
              <div className="space-y-4">
                {threadMessages.map((msg) => (
                  <Card key={msg.id} className={`p-4 ${msg.sender_type === 'patient' ? 'bg-accent/50' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-sm">
                        {msg.sender_type === 'patient' ? selectedMessage.patient.name : 'You'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{msg.message_body}</p>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            {!selectedMessage.resolved && (
              <div className="space-y-2">
                <Textarea
                  placeholder="Type your reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={3}
                />
                <Button
                  onClick={() => sendReplyMutation.mutate({ patientId: selectedMessage.patient_id, message: replyText })}
                  disabled={!replyText.trim() || sendReplyMutation.isPending}
                  className="w-full"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Reply
                </Button>

                <Textarea
                  placeholder="Resolution notes (optional)..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={2}
                  className="mt-2"
                />
              </div>
            )}

            {selectedMessage.resolved && selectedMessage.resolution_notes && (
              <Card className="p-4 bg-green-500/5 border-green-500/20">
                <p className="text-sm font-medium text-green-600 mb-1">Resolution Notes:</p>
                <p className="text-sm">{selectedMessage.resolution_notes}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Resolved on {format(new Date(selectedMessage.resolved_at!), 'MMM d, yyyy h:mm a')}
                </p>
              </Card>
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            Select a conversation to view messages
          </div>
        )}
      </div>
    </div>
  );
};
