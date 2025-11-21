import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { getPayloadNew } from '@/types/realtime';
import { logger } from '@/lib/logger';

export function useMessageAlerts() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchUnreadCount = async () => {
    if (!user) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      // Determine which RPC to use based on user role
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const hasPatientRole = userRoles?.some(r => r.role === 'patient');

      // Use patient-specific RPC for patients, regular RPC for others
      const rpcFunction = hasPatientRole ? 'get_patient_unread_message_count' : 'get_unread_message_count';

      const { data, error } = await supabase.rpc(rpcFunction, {
        p_user_id: user.id
      });

      if (error) throw error;
      setUnreadCount(data || 0);
    } catch (error) {
      logger.error('Error fetching unread message count', error);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  const markThreadAsRead = async (threadId: string, lastMessageId?: string) => {
    if (!user) return;

    try {
      await supabase
        .from('message_thread_read_status')
        .upsert({
          thread_id: threadId,
          user_id: user.id,
          last_read_at: new Date().toISOString(),
        }, {
          onConflict: 'thread_id,user_id'
        });

      // Refresh count after marking as read
      await fetchUnreadCount();
    } catch (error) {
      logger.error('Error marking thread as read', error);
    }
  };

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    let channel: any;

    const setupRealtimeSubscription = async () => {
      await fetchUnreadCount();

      channel = supabase
        .channel('message-alerts')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          async (payload) => {
            const newMessage = getPayloadNew(payload);

            // Only process if message is not from current user
            if (newMessage && newMessage.sender_id !== user.id) {
              // Check if user created the thread or is mentioned
              const { data: thread } = await supabase
                .from('message_threads')
                .select('created_by')
                .eq('id', newMessage.thread_id)
                .maybeSingle();

              // If user created the thread, show notification
              if (thread?.created_by === user.id) {
                // Refresh count from server
                await fetchUnreadCount();

                // Show toast notification
                toast('New Message', {
                  description: 'You have a new message in your inbox',
                  action: {
                    label: 'View',
                    onClick: () => navigate('/messages'),
                  },
                });
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'message_thread_read_status',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            // Refresh count when read status changes
            fetchUnreadCount();
          }
        )
        .subscribe();
    };

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user, navigate]);

  return {
    unreadCount,
    loading,
    markThreadAsRead,
    refetch: fetchUnreadCount
  };
}
