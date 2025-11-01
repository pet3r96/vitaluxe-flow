import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CheckCheck } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: {
    id: string;
    body: string;
    created_at: string;
    sender: {
      id: string;
      name: string;
    };
  };
  isOwn: boolean;
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const initials = message.sender.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={cn(
      "flex gap-2 mb-4 animate-in fade-in slide-in-from-bottom-2",
      isOwn ? "flex-row-reverse" : "flex-row"
    )}>
      {!isOwn && (
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      )}
      
      <div className={cn(
        "max-w-[70%] rounded-lg p-3 transition-colors",
        isOwn 
          ? "bg-primary text-primary-foreground" 
          : "bg-muted"
      )}>
        {!isOwn && (
          <p className="text-xs font-semibold mb-1">{message.sender.name}</p>
        )}
        
        <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
        
        <div className={cn(
          "flex items-center gap-1 mt-1 text-xs",
          isOwn ? "text-primary-foreground/70 justify-end" : "text-muted-foreground"
        )}>
          <span>{format(new Date(message.created_at), 'h:mm a')}</span>
          {isOwn && <CheckCheck className="h-3 w-3" />}
        </div>
      </div>
    </div>
  );
}
