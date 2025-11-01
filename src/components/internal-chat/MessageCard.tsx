import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, User, Paperclip, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface MessageCardProps {
  message: {
    id: string;
    subject: string;
    body: string;
    priority: 'urgent' | 'high' | 'medium' | 'low';
    message_type: string;
    created_at: string;
    sender: {
      name: string;
    };
    patient?: {
      name: string;
    };
    reply_count: number;
    unread_count: number;
    has_attachments: boolean;
  };
  selected: boolean;
  onClick: () => void;
}

export function MessageCard({ message, selected, onClick }: MessageCardProps) {
  const initials = message.sender.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const priorityBorderColor = {
    urgent: 'border-l-red-500',
    high: 'border-l-orange-500',
    medium: 'border-l-blue-500',
    low: 'border-l-gray-400'
  };

  const priorityBorderWidth = {
    urgent: 'border-l-4',
    high: 'border-l-4',
    medium: 'border-l-2',
    low: 'border-l'
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex gap-3 p-4 border-b cursor-pointer transition-colors hover:bg-accent",
        priorityBorderWidth[message.priority],
        priorityBorderColor[message.priority],
        selected && "bg-accent",
        message.unread_count > 0 && "bg-accent/50"
      )}
    >
      <Avatar className="h-10 w-10">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between mb-1">
          <h4 className={cn(
            "text-sm truncate flex-1",
            message.unread_count > 0 ? "font-semibold" : "font-medium"
          )}>
            {message.subject}
          </h4>
          <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
            {format(new Date(message.created_at), 'MMM dd')}
          </span>
        </div>

        <p className="text-sm text-muted-foreground truncate mb-2">
          {message.sender.name}: {message.body}
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          {message.reply_count > 0 && (
            <Badge variant="secondary" className="text-xs">
              <MessageCircle className="w-3 h-3 mr-1" />
              {message.reply_count}
            </Badge>
          )}
          {message.patient && (
            <Badge variant="outline" className="text-xs">
              <User className="w-3 h-3 mr-1" />
              {message.patient.name}
            </Badge>
          )}
          {message.has_attachments && (
            <Badge variant="outline" className="text-xs">
              <Paperclip className="w-3 h-3" />
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        {message.unread_count > 0 && (
          <Badge variant="destructive" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
            {message.unread_count}
          </Badge>
        )}
        {message.priority === 'urgent' && (
          <AlertTriangle className="h-4 w-4 text-red-500" />
        )}
      </div>
    </div>
  );
}
