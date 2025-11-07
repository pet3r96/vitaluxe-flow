import { Badge } from "@/components/ui/badge";
import { Video } from "lucide-react";

interface VideoSessionStatusProps {
  status: 'scheduled' | 'waiting' | 'active' | 'ended' | 'failed';
  onClick?: () => void;
}

export const VideoSessionStatus = ({ status, onClick }: VideoSessionStatusProps) => {
  const statusConfig = {
    scheduled: {
      label: 'Scheduled',
      variant: 'secondary' as const,
      className: 'bg-muted text-muted-foreground'
    },
    waiting: {
      label: 'Waiting',
      variant: 'secondary' as const,
      className: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
    },
    active: {
      label: 'Active',
      variant: 'default' as const,
      className: 'bg-green-500/10 text-green-700 dark:text-green-400 animate-pulse'
    },
    ended: {
      label: 'Ended',
      variant: 'outline' as const,
      className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
    },
    failed: {
      label: 'Failed',
      variant: 'destructive' as const,
      className: 'bg-destructive/10 text-destructive'
    }
  };

  const config = statusConfig[status];

  return (
    <Badge
      variant={config.variant}
      className={`${config.className} cursor-pointer transition-all hover:scale-105 gap-1.5`}
      onClick={onClick}
    >
      <Video className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};
