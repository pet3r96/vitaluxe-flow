import { useNotifications } from "@/hooks/useNotifications";
import { NotificationItem } from "./NotificationItem";
import { Button } from "@/components/ui/button";
import { CheckCheck, Loader2, Bell } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function NotificationPanel() {
  const { notifications, loading, markAllAsRead, unreadCount } = useNotifications();

  const unreadNotifications = notifications.filter((n) => !n.read);
  const readNotifications = notifications.filter((n) => n.read);

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
    <div className="flex flex-col h-full">
      {unreadCount > 0 && (
        <div className="flex justify-end mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllAsRead}
            className="text-xs"
          >
            <CheckCheck className="h-4 w-4 mr-1" />
            Mark all as read
          </Button>
        </div>
      )}

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
                  <NotificationItem key={notification.id} notification={notification} />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="all" className="flex-1 mt-2">
          <ScrollArea className="h-full">
            <div className="space-y-2 pr-4">
              {notifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
