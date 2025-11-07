import { Notification } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, ExternalLink, AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}

const severityConfig = {
  info: {
    icon: Info,
    className: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  },
  success: {
    icon: CheckCircle,
    className: "bg-green-500/10 text-green-500 border-green-500/20",
  },
  warning: {
    icon: AlertTriangle,
    className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  },
  error: {
    icon: AlertCircle,
    className: "bg-red-500/10 text-red-500 border-red-500/20",
  },
};

export function NotificationItem({ notification, onMarkAsRead, onDelete }: NotificationItemProps) {
  
  const navigate = useNavigate();

  const config = severityConfig[notification.severity];
  const Icon = config.icon;
  
  // Check if this is an admin notification
  const adminNotificationTypes = ['new_signup', 'system_error', 'support_message', 'security_alert', 'admin_action_required'];
  const isAdminNotification = adminNotificationTypes.includes(notification.notification_type);

  const handleClick = () => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    if (notification.action_url) {
      // Handle follow-up notifications specially to navigate to patient chart
      if (notification.entity_type === 'follow_up' && notification.metadata?.patient_id) {
        navigate(`/patients/${notification.metadata.patient_id}?tab=follow-ups`);
      } else {
        navigate(notification.action_url);
      }
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(notification.id);
  };

  return (
    <div
      className={cn(
        "relative p-3 rounded-lg border transition-all hover:shadow-md cursor-pointer",
        !notification.read && "bg-muted/50 border-primary/20",
        notification.read && "bg-background"
      )}
      onClick={handleClick}
    >
      {/* Unread indicator */}
      {!notification.read && (
        <div className="absolute top-3 left-0 w-1 h-8 bg-primary rounded-r" />
      )}

      <div className="flex gap-3">
        {/* Icon */}
        <div className={cn("p-2 rounded-full h-fit", config.className)}>
          <Icon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="text-sm font-medium line-clamp-1">{notification.title}</h4>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 -mt-1 -mr-1 shrink-0 hover:bg-destructive/10 hover:text-destructive"
              onClick={handleDelete}
              aria-label="Delete notification"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {notification.message}
          </p>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
            </span>

            {notification.action_url && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick();
                }}
              >
                {notification.notification_type.replace("_", " ")}
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>

          {/* Type badge with admin indicator */}
          <div className="flex gap-2 mt-2">
            <Badge variant="outline" className="text-xs">
              {notification.notification_type.replace(/_/g, " ")}
            </Badge>
            {isAdminNotification && (
              <Badge variant="secondary" className="text-xs">
                Admin
              </Badge>
            )}
            {notification.metadata?.user_name && (
              <span className="text-xs text-muted-foreground">
                • {notification.metadata.user_name}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
