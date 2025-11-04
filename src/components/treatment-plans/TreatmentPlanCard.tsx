import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TreatmentPlan, TreatmentPlanGoal } from "@/hooks/useTreatmentPlans";
import { GoalsProgressIndicator } from "./GoalsProgressIndicator";
import { Calendar, User, FileText, Image, MoreVertical } from "lucide-react";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TreatmentPlanCardProps {
  plan: TreatmentPlan;
  goals: TreatmentPlanGoal[];
  updateCount: number;
  attachmentCount: number;
  onViewDetails: () => void;
  onAddUpdate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const statusConfig = {
  planned: { label: "Planned", className: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", className: "bg-yellow-500 text-white" },
  on_hold: { label: "On Hold", className: "bg-orange-500 text-white" },
  completed: { label: "Completed", className: "bg-green-500 text-white" },
  cancelled: { label: "Cancelled", className: "bg-red-500 text-white" },
};

export function TreatmentPlanCard({
  plan,
  goals,
  updateCount,
  attachmentCount,
  onViewDetails,
  onAddUpdate,
  onEdit,
  onDelete,
}: TreatmentPlanCardProps) {
  const statusInfo = statusConfig[plan.status];

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold">{plan.plan_title}</h3>
            <Badge className={statusInfo.className}>
              {statusInfo.label}
            </Badge>
            {plan.is_locked && (
              <Badge variant="outline" className="text-xs">
                🔒 Locked
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Created by {plan.created_by_name} • {format(new Date(plan.created_at), 'MMM dd, yyyy')}
          </p>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onViewDetails}>
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAddUpdate}>
              Add Update
            </DropdownMenuItem>
            {!plan.is_locked && (
              <DropdownMenuItem onClick={onEdit}>
                Edit Plan
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              Delete Plan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Goals Progress */}
      {goals.length > 0 && (
        <div className="mb-4">
          <GoalsProgressIndicator goals={goals} />
        </div>
      )}

      {/* Plan Details */}
      <div className="space-y-2 mb-4">
        {plan.diagnosis_condition && (
          <div className="text-sm">
            <span className="font-medium">Diagnosis:</span>{' '}
            <span className="text-muted-foreground">{plan.diagnosis_condition}</span>
          </div>
        )}
        
        <div className="text-sm">
          <span className="font-medium">Treatment:</span>{' '}
          <span className="text-muted-foreground line-clamp-2">{plan.treatment_protocols}</span>
        </div>

        {plan.responsible_provider_name && (
          <div className="flex items-center gap-1 text-sm">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{plan.responsible_provider_name}</span>
          </div>
        )}

        {plan.target_completion_date && (
          <div className="flex items-center gap-1 text-sm">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">
              Target: {format(new Date(plan.target_completion_date), 'MMM dd, yyyy')}
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {attachmentCount > 0 && (
            <div className="flex items-center gap-1">
              <Image className="h-4 w-4" />
              <span>{attachmentCount}</span>
            </div>
          )}
          {updateCount > 0 && (
            <div className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              <span>{updateCount} updates</span>
            </div>
          )}
        </div>

        <Button onClick={onViewDetails} variant="outline" size="sm">
          View Details
        </Button>
      </div>
    </Card>
  );
}
