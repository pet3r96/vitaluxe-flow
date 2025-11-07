import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { realtimeManager } from "@/lib/realtimeManager";
import { useQueryClient } from "@tanstack/react-query";

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: string;
  severity: string;
  entity_type: string | null;
  entity_id: string | null;
  read: boolean;
  read_at: string | null;
  action_url: string | null;
  metadata: any;
  created_at: string;
  expires_at: string | null;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Ensure we have a valid session before critical operations
  const ensureValidSession = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      throw new Error('No valid session - please refresh the page and try again');
    }
    console.log('[useNotifications] Session validated for user:', session.user.id);
    return session;
  };

  // Check if current user is an admin
  const checkIsAdmin = async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      
      return !error && !!data;
    } catch (error) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error("Error checking admin status", error);
      });
      return false;
    }
  };

  // Fetch notifications with optional type filter
  const fetchNotifications = async (typeFilter?: string) => {
    try {
      console.log('[useNotifications] Fetching notifications...');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
        return;
      }

      // Check admin status and cache it
      const adminStatus = await checkIsAdmin(user.id);
      setIsAdmin(adminStatus);

      let query = supabase
        .from("notifications")
        .select("*");

      // Admin users see ALL notifications, regular users only see their own
      if (!adminStatus) {
        query = query.eq("user_id", user.id);
      }

      if (typeFilter) {
        query = query.eq("notification_type", typeFilter as any);
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      console.log('[useNotifications] Fetched notifications:', data?.length);
      setNotifications(data || []);
      setUnreadCount(data?.filter((n) => !n.read).length || 0);
    } catch (error) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error("Error fetching notifications", error);
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch unread count
  const fetchUnreadCount = async () => {
    try {
      const { data, error } = await supabase.rpc("get_unread_notification_count");
      if (error) throw error;
      setUnreadCount(data || 0);
    } catch (error) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error("Error fetching unread count", error);
      });
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase.rpc("mark_notification_read", {
        p_notification_id: notificationId,
      });

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read: true, read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error("Error marking notification as read", error);
      });
      toast({
        title: "Error",
        description: "Failed to mark notification as read",
        variant: "destructive",
      });
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      // Verify session before operation
      await ensureValidSession();
      
      console.log('[useNotifications] Marking all as read...');
      const { data, error } = await supabase.rpc("mark_all_notifications_read");

      if (error) {
        console.error('[useNotifications] RPC error marking all as read:', error);
        throw error;
      }

      console.log('[useNotifications] Marked', data, 'notifications as read');
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);

      toast({
        title: "Success",
        description: `Marked ${data} notifications as read`,
      });
    } catch (error: any) {
      console.error('[useNotifications] Error marking all as read:', error);
      import('@/lib/logger').then(({ logger }) => {
        logger.error("Error marking all as read", error);
      });
      
      const errorMessage = error.message?.includes('session') 
        ? error.message 
        : "Failed to mark all notifications as read. Please try again.";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId: string) => {
    try {
      // Verify session before operation
      await ensureValidSession();
      
      console.log('[useNotifications] Deleting notification:', notificationId);
      const notification = notifications.find((n) => n.id === notificationId);
      
      // Try direct delete first (fastest)
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId);

      if (error) {
        console.error('[useNotifications] Direct delete failed:', error);
        
        // If RLS policy fails, try edge function fallback
        console.log('[useNotifications] Attempting edge function fallback...');
        const { data: edgeData, error: edgeError } = await supabase.functions.invoke(
          'delete-notification',
          { body: { notificationId } }
        );
        
        if (edgeError) {
          console.error('[useNotifications] Edge function also failed:', edgeError);
          throw edgeError;
        }
        
        console.log('[useNotifications] Edge function delete succeeded:', edgeData);
      } else {
        console.log('[useNotifications] Direct delete succeeded');
      }

      console.log('[useNotifications] Notification deleted, updating state...');
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      if (notification && !notification.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      
      // Refresh both count and notifications to ensure sync with database
      console.log('[useNotifications] Refetching after delete...');
      await Promise.all([fetchUnreadCount(), fetchNotifications()]);
      
      toast({
        title: "Deleted",
        description: "Notification deleted successfully",
      });
    } catch (error: any) {
      console.error('[useNotifications] Error deleting notification:', error);
      import('@/lib/logger').then(({ logger }) => {
        logger.error("Error deleting notification", error);
      });
      
      const errorMessage = error.message?.includes('session') 
        ? error.message 
        : "Failed to delete notification. Please try refreshing the page.";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Subscribe to real-time updates using centralized realtimeManager
  useEffect(() => {
    fetchNotifications();

    // Subscribe to notifications table with custom event handler
    const handleRealtimeEvent = async (payload: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Handle INSERT events
      if (payload.eventType === 'INSERT') {
        const newNotification = payload.new as Notification;
        
        // Only process notifications for current user
        if (newNotification.user_id === user.id) {
          setNotifications((prev) => [newNotification, ...prev]);
          setUnreadCount((prev) => prev + 1);

          // Show toast for new notification
          toast({
            title: newNotification.title,
            description: newNotification.message,
            variant: newNotification.severity === "error" || newNotification.severity === "warning" 
              ? "destructive" 
              : "default",
            duration: newNotification.notification_type.includes('appointment') ? 10000 : 5000,
          });
        }
      }
      
      // Handle UPDATE events
      if (payload.eventType === 'UPDATE') {
        const updatedNotification = payload.new as Notification;
        if (updatedNotification.user_id === user.id) {
          setNotifications((prev) =>
            prev.map((n) => (n.id === updatedNotification.id ? updatedNotification : n))
          );
          fetchUnreadCount();
        }
      }
      
      // Handle DELETE events
      if (payload.eventType === 'DELETE') {
        const deletedId = payload.old.id;
        if (payload.old.user_id === user.id) {
          setNotifications((prev) => prev.filter((n) => n.id !== deletedId));
          fetchUnreadCount();
        }
      }
    };

    // Use realtimeManager for shared subscription pooling
    realtimeManager.subscribe('notifications', handleRealtimeEvent);

    // No cleanup needed - realtimeManager handles subscription pooling
    // Multiple components can share the same subscription
    return () => {
      // Don't unsubscribe - other components might be using it
    };
  }, [toast]);

  return {
    notifications,
    unreadCount,
    loading,
    isAdmin,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refetch: fetchNotifications,
  };
}
