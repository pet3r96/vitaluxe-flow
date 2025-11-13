import { MessageSquare, Users, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface CommunicationControlsProps {
  onOpenChat?: () => void;
  onOpenParticipants?: () => void;
  onSendReaction?: () => void;
  unreadMessages?: number;
  className?: string;
}

export const CommunicationControls = ({
  onOpenChat,
  onOpenParticipants,
  onSendReaction,
  unreadMessages = 0,
  className,
}: CommunicationControlsProps) => {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <TooltipProvider>
        {/* Chat */}
        {onOpenChat && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="lg"
                onClick={onOpenChat}
                className="h-12 w-12 rounded-full hover:bg-secondary/80 relative"
              >
                <MessageSquare className="w-5 h-5" />
                {unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-xs text-primary-foreground flex items-center justify-center">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Chat</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Participants */}
        {onOpenParticipants && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="lg"
                onClick={onOpenParticipants}
                className="h-12 w-12 rounded-full hover:bg-secondary/80"
              >
                <Users className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Participants</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Reactions */}
        {onSendReaction && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="lg"
                onClick={onSendReaction}
                className="h-12 w-12 rounded-full hover:bg-secondary/80"
              >
                <ThumbsUp className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Send reaction</p>
            </TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    </div>
  );
};
