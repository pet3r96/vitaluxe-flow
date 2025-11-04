import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TreatmentPlan, TreatmentPlanGoal, useUpdateTreatmentPlan } from "@/hooks/useTreatmentPlans";
import { useAuth } from "@/contexts/AuthContext";

const formSchema = z.object({
  plan_title: z.string().min(1, "Plan title is required").max(200),
  diagnosis_condition: z.string().max(300).optional(),
  treatment_protocols: z.string().min(1, "Treatment protocols are required").max(2000),
  target_completion_date: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['planned', 'in_progress', 'on_hold', 'completed', 'cancelled']),
});

interface EditTreatmentPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: TreatmentPlan;
  goals: TreatmentPlanGoal[];
  providers?: Array<{ id: string; name: string }>;
}

export function EditTreatmentPlanDialog({
  open,
  onOpenChange,
  plan,
  providers = [],
}: EditTreatmentPlanDialogProps) {
  const { user } = useAuth();
  const updatePlan = useUpdateTreatmentPlan();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      plan_title: plan.plan_title,
      diagnosis_condition: plan.diagnosis_condition || "",
      treatment_protocols: plan.treatment_protocols,
      target_completion_date: plan.target_completion_date || "",
      notes: plan.notes || "",
      status: plan.status,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        plan_title: plan.plan_title,
        diagnosis_condition: plan.diagnosis_condition || "",
        treatment_protocols: plan.treatment_protocols,
        target_completion_date: plan.target_completion_date || "",
        notes: plan.notes || "",
        status: plan.status,
      });
    }
  }, [open, plan, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    await updatePlan.mutateAsync({
      planId: plan.id,
      updates: {
        plan_title: values.plan_title,
        diagnosis_condition: values.diagnosis_condition,
        treatment_protocols: values.treatment_protocols,
        target_completion_date: values.target_completion_date,
        notes: values.notes,
        status: values.status,
        last_updated_by_user_id: user?.id,
        last_updated_by_name: user?.email || 'Unknown',
      },
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Treatment Plan</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Plan Title */}
            <FormField
              control={form.control}
              name="plan_title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Skin Rejuvenation Plan" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Diagnosis/Condition */}
            <FormField
              control={form.control}
              name="diagnosis_condition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Diagnosis / Condition</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Acne Scarring, Skin Aging" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Treatment Protocols */}
            <FormField
              control={form.control}
              name="treatment_protocols"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Treatment Protocols *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe the planned treatments, frequency, and sequence..."
                      className="min-h-24"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    e.g., "3 microneedling sessions monthly, chemical peel, skincare regimen"
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Target Completion Date */}
            <FormField
              control={form.control}
              name="target_completion_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Completion Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="planned">Planned</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional notes or comments..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <p className="text-xs text-muted-foreground">
              Last edited by {plan.last_updated_by_name || plan.created_by_name} on{' '}
              {new Date(plan.updated_at).toLocaleDateString()}
            </p>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updatePlan.isPending}>
                {updatePlan.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
