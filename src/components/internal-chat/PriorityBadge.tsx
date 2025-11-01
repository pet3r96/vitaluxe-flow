import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Info, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PriorityBadgeProps {
  priority?: 'urgent' | 'high' | 'medium' | 'low';
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const variants = {
    urgent: {
      variant: 'destructive' as const,
      icon: AlertTriangle
    },
    high: {
      variant: 'warning' as const,
      icon: AlertCircle
    },
    medium: {
      variant: 'info' as const,
      icon: Info
    },
    low: {
      variant: 'outline' as const,
      icon: Circle
    }
  };

  const normalizedPriority = (priority && variants[priority]) ? priority : 'medium';
  const config = variants[normalizedPriority];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} size="sm" className={cn("hover:opacity-90", className)}>
      <Icon className="w-3 h-3 mr-1" />
      {normalizedPriority.toUpperCase()}
    </Badge>
  );
}
