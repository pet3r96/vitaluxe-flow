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
      color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300',
      icon: AlertTriangle
    },
    high: {
      color: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300',
      icon: AlertCircle
    },
    medium: {
      color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300',
      icon: Info
    },
    low: {
      color: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300',
      icon: Circle
    }
  };

  const normalizedPriority = (priority && variants[priority]) ? priority : 'medium';
  const variant = variants[normalizedPriority];
  const Icon = variant.icon;

  return (
    <Badge className={cn(variant.color, className)} variant="outline">
      <Icon className="w-3 h-3 mr-1" />
      {normalizedPriority.toUpperCase()}
    </Badge>
  );
}
