import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, ClipboardList } from "lucide-react";
import { useTreatmentPlans, useTreatmentPlan, useDeleteTreatmentPlan } from "@/hooks/useTreatmentPlans";
import { TreatmentPlanCard } from "./TreatmentPlanCard";
import { CreateTreatmentPlanDialog } from "./CreateTreatmentPlanDialog";
import { TreatmentPlanDetailsDialog } from "./TreatmentPlanDetailsDialog";
import { AddPlanUpdateDialog } from "./AddPlanUpdateDialog";
import { EditTreatmentPlanDialog } from "./EditTreatmentPlanDialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TreatmentPlansTabProps {
  patientAccountId: string;
  providers?: Array<{ id: string; name: string }>;
}

export function TreatmentPlansTab({ patientAccountId, providers }: TreatmentPlansTabProps) {
  const { data: plans = [], isLoading } = useTreatmentPlans(patientAccountId);
  const deletePlan = useDeleteTreatmentPlan();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [addUpdateDialogOpen, setAddUpdateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<string | null>(null);

  const { data: selectedPlanData } = useTreatmentPlan(selectedPlanId || undefined);

  const handleViewDetails = (planId: string) => {
    setSelectedPlanId(planId);
    setDetailsDialogOpen(true);
  };

  const handleAddUpdate = (planId: string) => {
    setSelectedPlanId(planId);
    setAddUpdateDialogOpen(true);
  };

  const handleEdit = (planId: string) => {
    setSelectedPlanId(planId);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (planId: string) => {
    setPlanToDelete(planId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (planToDelete) {
      await deletePlan.mutateAsync(planToDelete);
      setDeleteDialogOpen(false);
      setPlanToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Treatment Plans & Goals</h2>
          <p className="text-muted-foreground">
            Track patient treatment protocols and progress
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Treatment Plan
        </Button>
      </div>

      {/* Plans List */}
      {plans.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No treatment plans yet</h3>
          <p className="text-muted-foreground mb-4">
            Create the first plan to start tracking patient progress
          </p>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create First Plan
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {plans.map((plan) => {
            // Fetch goals and updates for each plan
            const { data: planData } = useTreatmentPlan(plan.id);
            
            return (
              <TreatmentPlanCard
                key={plan.id}
                plan={plan}
                goals={planData?.goals || []}
                updateCount={planData?.updates?.length || 0}
                attachmentCount={planData?.attachments?.length || 0}
                onViewDetails={() => handleViewDetails(plan.id)}
                onAddUpdate={() => handleAddUpdate(plan.id)}
                onEdit={() => handleEdit(plan.id)}
                onDelete={() => handleDeleteClick(plan.id)}
              />
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <CreateTreatmentPlanDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        patientAccountId={patientAccountId}
        providers={providers}
      />

      {selectedPlanId && selectedPlanData && (
        <>
          <TreatmentPlanDetailsDialog
            open={detailsDialogOpen}
            onOpenChange={setDetailsDialogOpen}
            plan={selectedPlanData.plan}
            goals={selectedPlanData.goals}
            updates={selectedPlanData.updates}
            attachments={selectedPlanData.attachments}
            onEdit={() => {
              setDetailsDialogOpen(false);
              setEditDialogOpen(true);
            }}
            onAddUpdate={() => {
              setDetailsDialogOpen(false);
              setAddUpdateDialogOpen(true);
            }}
          />

          <AddPlanUpdateDialog
            open={addUpdateDialogOpen}
            onOpenChange={setAddUpdateDialogOpen}
            planId={selectedPlanId}
            currentStatus={selectedPlanData.plan.status}
          />

          <EditTreatmentPlanDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            plan={selectedPlanData.plan}
            goals={selectedPlanData.goals}
            providers={providers}
          />
        </>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Treatment Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this treatment plan and all associated goals, updates, and attachments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive">
              Delete Plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
