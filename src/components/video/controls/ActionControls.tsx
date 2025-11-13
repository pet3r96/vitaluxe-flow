import { FileText, PhoneOff, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export interface ActionControlsProps {
  onToggleChart?: () => void;
  onEndCall: () => void;
  onToggleRecording?: () => void;
  isRecording?: boolean;
  callDuration?: string;
  className?: string;
}

export const ActionControls = ({
  onToggleChart,
  onEndCall,
  onToggleRecording,
  isRecording = false,
  callDuration,
  className,
}: ActionControlsProps) => {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <TooltipProvider>
        {/* Call Duration */}
        {callDuration && (
          <div className="px-4 py-2 rounded-full bg-muted text-sm font-medium text-muted-foreground">
            {callDuration}
          </div>
        )}

        {/* Recording */}
        {onToggleRecording && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isRecording ? 'destructive' : 'secondary'}
                size="lg"
                onClick={onToggleRecording}
                className="h-12 w-12 rounded-full"
              >
                <Circle className={cn('w-5 h-5', isRecording && 'animate-pulse')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isRecording ? 'Stop recording' : 'Start recording'}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Chart */}
        {onToggleChart && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="lg"
                onClick={onToggleChart}
                className="h-12 w-12 rounded-full hover:bg-secondary/80"
              >
                <FileText className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Patient chart</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* End Call */}
        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="lg"
                  className="h-12 w-12 rounded-full"
                >
                  <PhoneOff className="w-5 h-5" />
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>End call</p>
            </TooltipContent>
          </Tooltip>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>End Video Call?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to end this call? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onEndCall} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                End Call
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TooltipProvider>
    </div>
  );
};
