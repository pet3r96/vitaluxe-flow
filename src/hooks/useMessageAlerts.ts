import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

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
      const { data, error } = await supabase.rpc('get_unread_message_count', {
        p_user_id: user.id
      });

      if (error) throw error;
      setUnreadCount(data || 0);
    } catch (error) {
      console.error('Error fetching unread message count:', error);
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
          last_read_message_id: lastMessageId,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'thread_id,user_id'
        });

      // Refresh count after marking as read
      await fetchUnreadCount();
    } catch (error) {
      console.error('Error marking thread as read:', error);
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
            const newMessage = payload.new as any;

            // Only process if message is not from current user
            if (newMessage.sender_id !== user.id) {
              // Check if user is participant in this thread
              const { data: isParticipant } = await supabase
                .from('thread_participants')
                .select('thread_id')
                .eq('thread_id', newMessage.thread_id)
                .eq('user_id', user.id)
                .maybeSingle();

              if (isParticipant) {
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
