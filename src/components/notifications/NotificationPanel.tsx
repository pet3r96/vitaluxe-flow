import { useState } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationItem } from "./NotificationItem";
import { Button } from "@/components/ui/button";
import { CheckCheck, Loader2, Bell, Settings, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotificationPreferencesDialog } from "./NotificationPreferencesDialog";
import { supabase } from "@/integrations/supabase/client";

export function NotificationPanel() {
  const { notifications, loading, isAdmin, markAllAsRead, unreadCount, markAsRead, deleteNotification, refetch } = useNotifications();
  const [showPreferences, setShowPreferences] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);

  // Admin notification types
  const adminNotificationTypes = ['new_signup', 'system_error', 'support_message', 'security_alert', 'admin_action_required'];
  
  const filteredNotifications = filterType === 'admin'
    ? notifications.filter(n => adminNotificationTypes.includes(n.notification_type))
    : filterType 
    ? notifications.filter(n => n.notification_type === filterType)
    : notifications;
    
  // Count admin notifications
  const adminNotificationCount = notifications.filter(n => 
    adminNotificationTypes.includes(n.notification_type) && !n.read
  ).length;

  const unreadNotifications = filteredNotifications.filter((n) => !n.read);
  const readNotifications = filteredNotifications.filter((n) => n.read);

  const handleDeleteAllUnread = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    
    // Delete all notifications in parallel
    const deletePromises = unreadIds.map(id => 
      supabase.from("notifications").delete().eq("id", id)
    );
    
    await Promise.all(deletePromises);
    
    // Refetch to sync UI with database state
    await refetch();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Bell className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">No notifications yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreferences(true)}
            className="text-xs"
          >
            <Settings className="h-4 w-4 mr-1" />
            Preferences
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteAllUnread}
              className="text-xs text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete all unread
            </Button>
          )}
        </div>

        <Tabs defaultValue="all" className="mb-2" onValueChange={(v) => setFilterType(v === 'all' ? null : v)}>
          <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-5' : 'grid-cols-4'}`}>
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="admin" className="text-xs relative">
                Admin
                {adminNotificationCount > 0 && (
                  <span className="ml-1 bg-destructive text-destructive-foreground rounded-full px-1.5 py-0.5 text-[10px]">
                    {adminNotificationCount > 9 ? "9+" : adminNotificationCount}
                  </span>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="patient_message_received" className="text-xs">Messages</TabsTrigger>
            <TabsTrigger value="appointment_booked" className="text-xs">Appointments</TabsTrigger>
            <TabsTrigger value="form_completed" className="text-xs">Forms</TabsTrigger>
          </TabsList>
        </Tabs>

      <Tabs defaultValue="unread" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="unread" className="relative">
            Unread
            {unreadCount > 0 && (
              <span className="ml-2 bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                {unreadCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value="unread" className="flex-1 mt-2">
          {unreadNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <CheckCheck className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-sm">All caught up!</p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="space-y-2 pr-4">
                {unreadNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={markAsRead}
                    onDelete={deleteNotification}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="all" className="flex-1 mt-2">
          <ScrollArea className="h-full">
            <div className="space-y-2 pr-4">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onDelete={deleteNotification}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
      </div>

      <NotificationPreferencesDialog
        open={showPreferences}
        onOpenChange={setShowPreferences}
      />
    </>
  );
}
