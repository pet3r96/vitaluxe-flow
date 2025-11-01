import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Send, CheckCircle, RotateCcw, Info, User } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { PriorityBadge } from "./PriorityBadge";
import { Badge } from "@/components/ui/badge";

interface PatientMessageThreadProps {
  message: any;
  replies: any[];
  userId: string;
  isLoading: boolean;
  onClose: () => void;
  onSendReply: (replyText: string) => Promise<void>;
  onMarkResolved: () => Promise<void>;
  onReopen: () => Promise<void>;
  onShowDetails: () => void;
}

export function PatientMessageThread({
  message,
  replies,
  userId,
  isLoading,
  onClose,
  onSendReply,
  onMarkResolved,
  onReopen,
  onShowDetails
}: PatientMessageThreadProps) {
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendReply = async () => {
    if (!replyText.trim() || sending) return;
    
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
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2">
          <p>Select a message to view conversation</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col p-6 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b bg-background space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{message.subject}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <PriorityBadge priority={message.urgency || 'medium'} />
              {message.patient && (
                <Badge variant="outline" className="text-xs">
                  <User className="w-3 h-3 mr-1" />
                  {message.patient.name}
                </Badge>
              )}
              {message.resolved && (
                <Badge variant="secondary" className="text-xs">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Resolved
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onShowDetails}>
              <Info className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {!message.resolved ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onMarkResolved}
              className="gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Mark Resolved
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onReopen}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reopen
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-4xl mx-auto">
          {/* Original Message */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium">
                {(message.sender_type === 'provider' || message.sender_type === 'staff' || message.sender_type === 'practice')
                  ? (message.sender?.name || 'Practice')
                  : (message.patient?.name || 'Patient')}
              </span>
              <span>•</span>
              <span>{format(new Date(message.created_at), 'PPp')}</span>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm whitespace-pre-wrap">{message.message_body}</p>
            </div>
          </div>

          {/* Replies */}
          {replies.map((reply) => (
            <MessageBubble
              key={reply.id}
              message={reply}
              isOwn={reply.sender_id === userId}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Reply Input */}
      {!message.resolved && (
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
