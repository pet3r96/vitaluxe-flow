import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ConversationList } from "@/components/internal-chat/ConversationList";
import { MessageThread } from "@/components/internal-chat/MessageThread";
import { MessageDetails } from "@/components/internal-chat/MessageDetails";
import { CreateInternalMessageDialog } from "@/components/internal-chat/CreateInternalMessageDialog";
import { PatientConversationList } from "@/components/internal-chat/PatientConversationList";
import { PatientMessageThread } from "@/components/internal-chat/PatientMessageThread";
import { PatientMessageDetails } from "@/components/internal-chat/PatientMessageDetails";
import { CreatePatientMessageDialog } from "@/components/internal-chat/CreatePatientMessageDialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";

const InternalChat = () => {
  const { effectiveUserId, effectiveRole } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Internal messages state
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    searchParams.get('message')
  );
  const [filterTab, setFilterTab] = useState<'active' | 'urgent' | 'patient' | 'completed'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatientFilter, setSelectedPatientFilter] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [showDetailsMobile, setShowDetailsMobile] = useState(false);

  // Patient messages state
  const [selectedPatientMessageId, setSelectedPatientMessageId] = useState<string | null>(null);
  const [patientFilterTab, setPatientFilterTab] = useState<'active' | 'urgent' | 'patient' | 'resolved'>('active');
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [selectedPatientInFilter, setSelectedPatientInFilter] = useState<string>('all');
  const [createPatientDialogOpen, setCreatePatientDialogOpen] = useState(false);
  const [showPatientDetailsMobile, setShowPatientDetailsMobile] = useState(false);

  // Get practice ID based on user role
  const { data: practiceId } = useQuery({
    queryKey: ['user-practice-id', effectiveUserId, effectiveRole],
    queryFn: async () => {
      if (effectiveRole === 'doctor') {
        return effectiveUserId;
      } else if (effectiveRole === 'provider') {
        const { data } = await supabase
          .from('providers')
          .select('practice_id')
          .eq('user_id', effectiveUserId)
          .single();
        return data?.practice_id;
      } else if (effectiveRole === 'staff') {
        const { data } = await supabase
          .from('practice_staff')
          .select('practice_id')
          .eq('user_id', effectiveUserId)
          .single();
        return data?.practice_id;
      }
      return null;
    }
  });

  // Fetch practice team members for sender name lookups
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['practice-team-members', practiceId],
    queryFn: async () => {
      if (!practiceId) return [];
      const { data, error } = await supabase.rpc('get_practice_team_members', {
        p_practice_id: practiceId
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!practiceId
  });

  // Create a map of userId -> team member for quick lookups
  const teamMap = useMemo(() => {
    return Object.fromEntries(
      teamMembers.map((m: any) => [m.user_id, m])
    );
  }, [teamMembers]);

  // Fetch messages with filters
  const { data: messagesData = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['internal-messages', practiceId, filterTab, searchQuery, selectedPatientFilter],
    queryFn: async () => {
      if (!practiceId) return [];

      let query = supabase
        .from('internal_messages')
        .select(`
          *,
          patient:patients(id, name),
          recipients:internal_message_recipients(
            id,
            recipient_id,
            read_at
          ),
          replies:internal_message_replies(id)
        `)
        .eq('practice_id', practiceId)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filterTab === 'active') {
        query = query.eq('completed', false);
      } else if (filterTab === 'urgent') {
        query = query.eq('priority', 'urgent').eq('completed', false);
      } else if (filterTab === 'patient') {
        query = query.eq('message_type', 'patient_specific');
      } else if (filterTab === 'completed') {
        query = query.eq('completed', true);
      }

      if (selectedPatientFilter) {
        query = query.eq('patient_id', selectedPatientFilter);
      }

      if (searchQuery) {
        query = query.or(`subject.ilike.%${searchQuery}%,body.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Transform data to include counts and enrich with sender names
      return data.map((msg: any) => ({
        ...msg,
        sender: { name: teamMap[msg.created_by]?.name || 'Unknown' },
        reply_count: msg.replies?.length || 0,
        unread_count: msg.recipients?.filter((r: any) => r.recipient_id === effectiveUserId && !r.read_at).length || 0,
        has_attachments: (msg.attached_document_ids?.length || 0) > 0 || (msg.attached_form_ids?.length || 0) > 0
      }));
    },
    enabled: !!practiceId
  });

  // Fetch patients for filter
  const { data: patients = [] } = useQuery({
    queryKey: ['practice-patients', practiceId],
    queryFn: async () => {
      if (!practiceId) return [];
      const { data, error } = await supabase
        .from('patients')
        .select('id, name')
        .eq('practice_id', practiceId)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!practiceId
  });

  // Fetch selected message details
  const { data: selectedMessage, isLoading: messageLoading } = useQuery({
    queryKey: ['internal-message', selectedMessageId],
    queryFn: async () => {
      if (!selectedMessageId) return null;
      const { data, error } = await supabase
        .from('internal_messages')
        .select(`
          *,
          patient:patients(id, name)
        `)
        .eq('id', selectedMessageId)
        .single();
      if (error) throw error;
      // Enrich with sender name
      return {
        ...data,
        sender: {
          id: data.created_by,
          name: teamMap[data.created_by]?.name || 'Unknown'
        }
      };
    },
    enabled: !!selectedMessageId
  });

  // Fetch replies
  const { data: replies = [] } = useQuery({
    queryKey: ['internal-message-replies', selectedMessageId],
    queryFn: async () => {
      if (!selectedMessageId) return [];
      const { data, error } = await supabase
        .from('internal_message_replies')
        .select('*')
        .eq('message_id', selectedMessageId)
        .order('created_at');
      if (error) throw error;
      // Enrich with sender names
      return data.map((reply: any) => ({
        ...reply,
        sender: {
          id: reply.sender_id,
          name: teamMap[reply.sender_id]?.name || 'Unknown'
        }
      }));
    },
    enabled: !!selectedMessageId
  });

  // Fetch recipients for selected message
  const { data: recipients = [] } = useQuery({
    queryKey: ['internal-message-recipients', selectedMessageId],
    queryFn: async () => {
      if (!selectedMessageId || !practiceId) return [];
      
      const { data, error } = await supabase
        .from('internal_message_recipients')
        .select('recipient_id, read_at')
        .eq('message_id', selectedMessageId);
      
      if (error) throw error;

      // Fetch full user details
      const { data: teamMembers } = await supabase.rpc('get_practice_team_members', {
        p_practice_id: practiceId
      });

      return data.map((r: any) => {
        const member = teamMembers?.find((m: any) => m.user_id === r.recipient_id);
        return {
          id: r.recipient_id,
          name: member?.name || 'Unknown',
          role_display: member?.role_display || 'Unknown',
          read_at: r.read_at
        };
      });
    },
    enabled: !!selectedMessageId && !!practiceId
  });

  // Mark message as read when selected
  useEffect(() => {
    if (selectedMessageId && effectiveUserId) {
      supabase
        .from('internal_message_recipients')
        .update({ read_at: new Date().toISOString() })
        .eq('message_id', selectedMessageId)
        .eq('recipient_id', effectiveUserId)
        .is('read_at', null)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['internal-messages'] });
        });
    }
  }, [selectedMessageId, effectiveUserId, queryClient]);

  // Send reply mutation
  const sendReplyMutation = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase
        .from('internal_message_replies')
        .insert({
          message_id: selectedMessageId!,
          sender_id: effectiveUserId,
          body
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-message-replies', selectedMessageId] });
      queryClient.invalidateQueries({ queryKey: ['internal-messages'] });
      toast.success('Reply sent');
    },
    onError: () => {
      toast.error('Failed to send reply');
    }
  });

  // Mark complete mutation
  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('internal_messages')
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
          completed_by: effectiveUserId
        })
        .eq('id', selectedMessageId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-messages'] });
      queryClient.invalidateQueries({ queryKey: ['internal-message', selectedMessageId] });
      toast.success('Message marked as complete');
    },
    onError: () => {
      toast.error('Failed to mark message as complete');
    }
  });

  // Reopen message mutation
  const reopenMessageMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('internal_messages')
        .update({
          completed: false,
          completed_at: null,
          completed_by: null
        })
        .eq('id', selectedMessageId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-messages'] });
      queryClient.invalidateQueries({ queryKey: ['internal-message', selectedMessageId] });
      toast.success('Message reopened');
    },
    onError: () => {
      toast.error('Failed to reopen message');
    }
  });

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('internal_messages')
        .delete()
        .eq('id', selectedMessageId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-messages'] });
      setSelectedMessageId(null);
      toast.success('Message deleted');
    },
    onError: () => {
      toast.error('Failed to delete message');
    }
  });

  // ===== PATIENT MESSAGES QUERIES AND MUTATIONS =====

  // Fetch patient messages with filters
  const { data: patientMessagesData = [], isLoading: patientMessagesLoading } = useQuery({
    queryKey: ['patient-messages', practiceId, patientFilterTab, patientSearchQuery, selectedPatientInFilter],
    queryFn: async () => {
      if (!practiceId) return [];

      let query = supabase
        .from('patient_messages')
        .select(`
          *,
          patient:patients!patient_messages_patient_id_fkey(id, name, email, phone, dob),
          sender:profiles!patient_messages_practice_id_fkey(id, name)
        `)
        .eq('practice_id', practiceId)
        .order('created_at', { ascending: false });

      // Apply filters
      if (patientFilterTab === 'active') {
        query = query.eq('resolved', false);
      } else if (patientFilterTab === 'urgent') {
        query = query.eq('urgency', 'urgent').eq('resolved', false);
      } else if (patientFilterTab === 'patient' && selectedPatientInFilter && selectedPatientInFilter !== 'all') {
        query = query.eq('patient_id', selectedPatientInFilter);
      } else if (patientFilterTab === 'resolved') {
        query = query.eq('resolved', true);
      }

      // Apply search
      if (patientSearchQuery) {
        query = query.or(`subject.ilike.%${patientSearchQuery}%,message_body.ilike.%${patientSearchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Transform data to include reply count
      return (data || []).map((msg: any) => ({
        ...msg,
        reply_count: 0, // We'll need to fetch this separately or use a join
        unread_count: msg.read_at ? 0 : 1,
        has_attachments: false,
        body: msg.message_body,
        priority: msg.urgency || 'medium'
      }));
    },
    enabled: !!practiceId
  });

  // Fetch selected patient message details
  const { data: selectedPatientMessage } = useQuery({
    queryKey: ['patient-message', selectedPatientMessageId],
    queryFn: async () => {
      if (!selectedPatientMessageId) return null;
      
      const { data, error } = await supabase
        .from('patient_messages')
        .select(`
          *,
          patient:patients!patient_messages_patient_id_fkey(id, name, email, phone, dob),
          sender:profiles!patient_messages_practice_id_fkey(id, name)
        `)
        .eq('id', selectedPatientMessageId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!selectedPatientMessageId
  });

  // Fetch patient message replies (thread)
  const { data: patientReplies = [] } = useQuery({
    queryKey: ['patient-message-replies', selectedPatientMessageId],
    queryFn: async () => {
      if (!selectedPatientMessageId) return [];

      const { data, error } = await supabase
        .from('patient_messages')
        .select(`
          *,
          patient:patients!patient_messages_patient_id_fkey(id, name),
          sender:profiles!patient_messages_practice_id_fkey(id, name)
        `)
        .eq('parent_message_id', selectedPatientMessageId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []).map((reply: any) => ({
        id: reply.id,
        body: reply.message_body,
        created_at: reply.created_at,
        sender_id: reply.sender_id,
        sender: {
          id: reply.sender_id,
          name: reply.sender_type === 'practice' 
            ? reply.sender?.name || 'Practice'
            : reply.patient?.name || 'Patient'
        }
      }));
    },
    enabled: !!selectedPatientMessageId
  });

  // Mark patient message as read when selected
  useEffect(() => {
    if (selectedPatientMessageId && effectiveUserId) {
      supabase
        .from('patient_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', selectedPatientMessageId)
        .is('read_at', null)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['patient-messages'] });
        });
    }
  }, [selectedPatientMessageId, effectiveUserId, queryClient]);

  // Send patient reply mutation
  const sendPatientReplyMutation = useMutation({
    mutationFn: async (body: string) => {
      if (!selectedPatientMessage) throw new Error('No message selected');
      
      const { error } = await supabase
        .from('patient_messages')
        .insert({
          parent_message_id: selectedPatientMessageId!,
          patient_id: selectedPatientMessage.patient_id,
          practice_id: practiceId!,
          sender_id: effectiveUserId!,
          sender_type: 'practice',
          subject: `Re: ${selectedPatientMessage.subject}`,
          message_body: body,
          urgency: selectedPatientMessage.urgency
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-message-replies', selectedPatientMessageId] });
      queryClient.invalidateQueries({ queryKey: ['patient-messages'] });
      toast.success('Reply sent');
    },
    onError: (error: any) => {
      console.error('Error sending patient reply:', error);
      toast.error('Failed to send reply');
    }
  });

  // Mark patient message resolved mutation
  const markPatientResolvedMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('patient_messages')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: effectiveUserId
        })
        .eq('id', selectedPatientMessageId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-messages'] });
      queryClient.invalidateQueries({ queryKey: ['patient-message', selectedPatientMessageId] });
      toast.success('Message marked as resolved');
    },
    onError: () => {
      toast.error('Failed to mark message as resolved');
    }
  });

  // Reopen patient message mutation
  const reopenPatientMessageMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('patient_messages')
        .update({
          resolved: false,
          resolved_at: null,
          resolved_by: null
        })
        .eq('id', selectedPatientMessageId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-messages'] });
      queryClient.invalidateQueries({ queryKey: ['patient-message', selectedPatientMessageId] });
      toast.success('Message reopened');
    },
    onError: () => {
      toast.error('Failed to reopen message');
    }
  });

  // Delete patient message mutation
  const deletePatientMessageMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('patient_messages')
        .delete()
        .eq('id', selectedPatientMessageId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-messages'] });
      setSelectedPatientMessageId(null);
      toast.success('Message deleted');
    },
    onError: () => {
      toast.error('Failed to delete message');
    }
  });

  const patientUnreadCount = patientMessagesData.filter(m => !m.read_at).length;
  const patientActiveCount = patientMessagesData.filter(m => !m.resolved).length;
  const patientUrgentCount = patientMessagesData.filter(m => m.urgency === 'urgent' && !m.resolved).length;

  // Real-time subscriptions
  useEffect(() => {
    if (!practiceId) return;

    const channel = supabase
      .channel('internal-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'internal_messages',
          filter: `practice_id=eq.${practiceId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['internal-messages'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_message_replies'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['internal-message-replies'] });
          queryClient.invalidateQueries({ queryKey: ['internal-messages'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [practiceId, queryClient]);

  const unreadCount = messagesData.filter(m => m.unread_count > 0).length;
  const activeCount = messagesData.filter(m => !m.completed).length;
  const urgentCount = messagesData.filter(m => m.priority === 'urgent' && !m.completed).length;

  if (!practiceId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Unable to determine practice context</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">Chat System</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            Internal team communication and patient messaging in one place
          </p>
        </div>
      </div>

      <Tabs defaultValue="internal" className="space-y-4">
        <TabsList>
          <TabsTrigger value="internal">Internal</TabsTrigger>
          <TabsTrigger value="patients">Patients</TabsTrigger>
        </TabsList>

        <TabsContent value="internal" className="space-y-0">
          <div className="flex h-[90vh] overflow-hidden bg-background">
        {/* Mobile: Show list or thread */}
        <div className="flex flex-1 lg:hidden">
          {!selectedMessageId ? (
            <ConversationList
              filterTab={filterTab}
              onFilterTabChange={setFilterTab}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              patientFilter={selectedPatientFilter}
              onPatientFilterChange={setSelectedPatientFilter}
              selectedMessageId={selectedMessageId}
              onSelectMessage={setSelectedMessageId}
              onNewMessage={() => setCreateDialogOpen(true)}
              messages={messagesData}
              patients={patients}
              loading={messagesLoading}
              unreadCount={unreadCount}
              activeCount={activeCount}
              urgentCount={urgentCount}
            />
          ) : (
            <MessageThread
              message={selectedMessage}
              replies={replies}
              currentUserId={effectiveUserId!}
              onClose={() => setSelectedMessageId(null)}
              onSendReply={(body) => sendReplyMutation.mutateAsync(body)}
              onMarkComplete={() => markCompleteMutation.mutateAsync()}
              onReopen={() => reopenMessageMutation.mutateAsync()}
              onShowDetails={() => setShowDetailsMobile(true)}
              loading={messageLoading}
            />
          )}
        </div>

        {/* Desktop: Three columns */}
        <div className="hidden lg:flex flex-1">
          <ConversationList
            filterTab={filterTab}
            onFilterTabChange={setFilterTab}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            patientFilter={selectedPatientFilter}
            onPatientFilterChange={setSelectedPatientFilter}
            selectedMessageId={selectedMessageId}
            onSelectMessage={setSelectedMessageId}
            onNewMessage={() => setCreateDialogOpen(true)}
            messages={messagesData}
            patients={patients}
            loading={messagesLoading}
            unreadCount={unreadCount}
            activeCount={activeCount}
            urgentCount={urgentCount}
          />

          <MessageThread
            message={selectedMessage}
            replies={replies}
            currentUserId={effectiveUserId!}
            onClose={() => setSelectedMessageId(null)}
            onSendReply={(body) => sendReplyMutation.mutateAsync(body)}
            onMarkComplete={() => markCompleteMutation.mutateAsync()}
            onReopen={() => reopenMessageMutation.mutateAsync()}
            onShowDetails={() => {}}
            loading={messageLoading}
          />

          {selectedMessage && (
            <MessageDetails
              message={selectedMessage}
              recipients={recipients}
              onMarkComplete={() => markCompleteMutation.mutateAsync()}
              onReopen={() => reopenMessageMutation.mutateAsync()}
              onDelete={() => deleteMessageMutation.mutateAsync()}
            />
          )}
        </div>
          </div>
        </TabsContent>

        <TabsContent value="patients" className="space-y-0">
          <div className="flex h-[90vh] overflow-hidden bg-background">
            {/* Mobile: Show list or thread */}
            <div className="flex flex-1 lg:hidden">
              {!selectedPatientMessageId ? (
                <PatientConversationList
                  filter={patientFilterTab}
                  setFilter={setPatientFilterTab}
                  searchQuery={patientSearchQuery}
                  setSearchQuery={setPatientSearchQuery}
                  selectedPatient={selectedPatientInFilter}
                  setSelectedPatient={setSelectedPatientInFilter}
                  messages={patientMessagesData}
                  patients={patients}
                  isLoading={patientMessagesLoading}
                  selectedMessageId={selectedPatientMessageId}
                  onSelectMessage={setSelectedPatientMessageId}
                  onNewMessage={() => setCreatePatientDialogOpen(true)}
                  unreadCount={patientUnreadCount}
                  activeCount={patientActiveCount}
                  urgentCount={patientUrgentCount}
                />
              ) : (
                <PatientMessageThread
                  message={selectedPatientMessage}
                  replies={patientReplies}
                  userId={effectiveUserId!}
                  isLoading={false}
                  onClose={() => setSelectedPatientMessageId(null)}
                  onSendReply={(text) => sendPatientReplyMutation.mutateAsync(text)}
                  onMarkResolved={() => markPatientResolvedMutation.mutateAsync()}
                  onReopen={() => reopenPatientMessageMutation.mutateAsync()}
                  onShowDetails={() => setShowPatientDetailsMobile(true)}
                />
              )}
            </div>

            {/* Desktop: Three-column layout */}
            <div className="hidden lg:flex lg:flex-1">
              <PatientConversationList
                filter={patientFilterTab}
                setFilter={setPatientFilterTab}
                searchQuery={patientSearchQuery}
                setSearchQuery={setPatientSearchQuery}
                selectedPatient={selectedPatientInFilter}
                setSelectedPatient={setSelectedPatientInFilter}
                messages={patientMessagesData}
                patients={patients}
                isLoading={patientMessagesLoading}
                selectedMessageId={selectedPatientMessageId}
                onSelectMessage={setSelectedPatientMessageId}
                onNewMessage={() => setCreatePatientDialogOpen(true)}
                unreadCount={patientUnreadCount}
                activeCount={patientActiveCount}
                urgentCount={patientUrgentCount}
              />

              <PatientMessageThread
                message={selectedPatientMessage}
                replies={patientReplies}
                userId={effectiveUserId!}
                isLoading={false}
                onClose={() => setSelectedPatientMessageId(null)}
                onSendReply={(text) => sendPatientReplyMutation.mutateAsync(text)}
                onMarkResolved={() => markPatientResolvedMutation.mutateAsync()}
                onReopen={() => reopenPatientMessageMutation.mutateAsync()}
                onShowDetails={() => {}}
              />

              {selectedPatientMessage && (
                <PatientMessageDetails
                  message={selectedPatientMessage}
                  onMarkResolved={() => markPatientResolvedMutation.mutateAsync()}
                  onReopen={() => reopenPatientMessageMutation.mutateAsync()}
                  onDelete={() => deletePatientMessageMutation.mutateAsync()}
                />
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Mobile details sheet */}
      <Sheet open={showDetailsMobile} onOpenChange={setShowDetailsMobile}>
        <SheetContent side="bottom" className="h-[80vh]">
          {selectedMessage && (
            <MessageDetails
              message={selectedMessage}
              recipients={recipients}
              onMarkComplete={() => markCompleteMutation.mutateAsync()}
              onReopen={() => reopenMessageMutation.mutateAsync()}
              onDelete={() => deleteMessageMutation.mutateAsync()}
            />
          )}
        </SheetContent>
      </Sheet>

      <CreateInternalMessageDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        practiceId={practiceId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['internal-messages'] });
        }}
      />

      <CreatePatientMessageDialog
        open={createPatientDialogOpen}
        onOpenChange={setCreatePatientDialogOpen}
        practiceId={practiceId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['patient-messages'] });
        }}
      />
    </>
  );
};

export default InternalChat;
