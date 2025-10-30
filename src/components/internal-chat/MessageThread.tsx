import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, CheckCircle, User, ExternalLink, Info, RotateCcw } from "lucide-react";
import { PriorityBadge } from "./PriorityBadge";
import { MessageBubble } from "./MessageBubble";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

interface MessageThreadProps {
  message: any;
  replies: any[];
  currentUserId: string;
  onClose: () => void;
  onSendReply: (body: string) => Promise<void>;
  onMarkComplete: () => Promise<void>;
  onReopen: () => Promise<void>;
  onShowDetails: () => void;
  loading: boolean;
}

export function MessageThread({
  message,
  replies,
  currentUserId,
  onClose,
  onSendReply,
  onMarkComplete,
  onReopen,
  onShowDetails,
  loading
}: MessageThreadProps) {
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const navigate = useNavigate();

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    
    setSending(true);
    try {
      await onSendReply(replyText);
      setReplyText('');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  if (!message) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/20">
        <div className="text-center text-muted-foreground">
          <p>Select a message to view</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b">
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-20 w-3/4" />
          <Skeleton className="h-20 w-3/4 ml-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-background">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{message.subject}</h3>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <PriorityBadge priority={message.priority || 'medium'} />
              {message.patient && (
                <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => navigate(`/patients/${message.patient_id}`)}>
                  <User className="w-3 h-3 mr-1" />
                  {message.patient.name}
                </Badge>
              )}
              {message.message_type === 'announcement' && (
                <Badge variant="secondary">Announcement</Badge>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onShowDetails} className="lg:hidden">
            <Info className="h-4 w-4" />
          </Button>
          {!message.completed ? (
            <Button variant="outline" size="sm" onClick={onMarkComplete}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Complete
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={onReopen}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reopen
            </Button>
          )}
        </div>
      </div>

      {/* Message Body */}
      <ScrollArea className="flex-1 p-3">
        {/* Original Message */}
        <div className="mb-6 p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-sm">{message.sender.name}</span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(message.created_at), 'MMM dd, yyyy • h:mm a')}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm">{message.body}</p>
        </div>

        {/* Replies */}
        {replies.map((reply) => (
          <MessageBubble
            key={reply.id}
            message={reply}
            isOwn={reply.sender_id === currentUserId}
          />
        ))}
      </ScrollArea>

      {/* Reply Input */}
      {!message.completed && (
        <div className="p-1 border-t bg-background">
          <div className="flex gap-2">
            <Textarea
              placeholder="Type a reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[30px] max-h-[60px]"
              disabled={sending}
            />
            <Button
              onClick={handleSendReply}
              disabled={!replyText.trim() || sending}
              size="icon"
              className="h-[30px] w-[30px]"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
