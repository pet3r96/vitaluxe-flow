import { TreatmentPlan } from "@/hooks/useTreatmentPlans";
import { TreatmentPlanCard } from "./TreatmentPlanCard";
import { useTreatmentPlan } from "@/hooks/useTreatmentPlans";
import { Skeleton } from "@/components/ui/skeleton";

interface TreatmentPlanListItemProps {
  plan: TreatmentPlan;
  onViewDetails: () => void;
  onAddUpdate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function TreatmentPlanListItem({
  plan,
  onViewDetails,
  onAddUpdate,
  onEdit,
  onDelete,
}: TreatmentPlanListItemProps) {
  const { data: planData, isLoading } = useTreatmentPlan(plan.id);

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  return (
    <TreatmentPlanCard
      key={plan.id}
      plan={plan}
      goals={planData?.goals || []}
      updateCount={planData?.updates?.length || 0}
      attachmentCount={planData?.attachments?.length || 0}
      onViewDetails={onViewDetails}
      onAddUpdate={onAddUpdate}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
}
