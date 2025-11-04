import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { TreatmentPlanGoal } from "@/hooks/useTreatmentPlans";

interface GoalsProgressIndicatorProps {
  goals: TreatmentPlanGoal[];
  showDetails?: boolean;
}

export function GoalsProgressIndicator({ goals, showDetails = true }: GoalsProgressIndicatorProps) {
  const totalGoals = goals.length;
  const achievedGoals = goals.filter(g => g.status === 'achieved').length;
  const ongoingGoals = goals.filter(g => g.status === 'ongoing').length;
  const modifiedGoals = goals.filter(g => g.status === 'modified').length;
  
  const percentage = totalGoals > 0 ? (achievedGoals / totalGoals) * 100 : 0;
  
  const getColorClass = () => {
    if (percentage >= 75) return "bg-green-500";
    if (percentage >= 25) return "bg-yellow-500";
    return "bg-muted";
  };

  if (totalGoals === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No goals set
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {achievedGoals} of {totalGoals} goals achieved
        </span>
        <span className="text-muted-foreground">{Math.round(percentage)}%</span>
      </div>
      
      <Progress value={percentage} className="h-2" />
      
      {showDetails && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            <span>{achievedGoals} achieved</span>
          </div>
          <div className="flex items-center gap-1">
            <Circle className="h-3 w-3 text-yellow-500" />
            <span>{ongoingGoals} ongoing</span>
          </div>
          {modifiedGoals > 0 && (
            <div className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-orange-500" />
              <span>{modifiedGoals} modified</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
