import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useCreateTreatmentPlan } from "@/hooks/useTreatmentPlans";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, X, GripVertical } from "lucide-react";
import { format } from "date-fns";

const formSchema = z.object({
  plan_title: z.string().min(1, "Plan title is required").max(200),
  diagnosis_condition: z.string().max(300).optional(),
  treatment_protocols: z.string().min(1, "Treatment protocols are required").max(2000),
  responsible_provider_id: z.string().optional(),
  responsible_provider_name: z.string().optional(),
  target_completion_date: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['planned', 'in_progress', 'on_hold', 'completed', 'cancelled']).default('planned'),
});

interface Goal {
  description: string;
  is_specific: boolean;
  is_measurable: boolean;
  is_achievable: boolean;
  is_relevant: boolean;
  is_time_bound: boolean;
}

interface CreateTreatmentPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientAccountId: string;
  providers?: Array<{ id: string; name: string }>;
}

export function CreateTreatmentPlanDialog({
  open,
  onOpenChange,
  patientAccountId,
  providers = [],
}: CreateTreatmentPlanDialogProps) {
  const { user, effectiveRole } = useAuth();
  const createPlan = useCreateTreatmentPlan();
  
  const [goals, setGoals] = useState<Goal[]>([
    { description: "", is_specific: false, is_measurable: false, is_achievable: false, is_relevant: false, is_time_bound: false }
  ]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      plan_title: "",
      diagnosis_condition: "",
      treatment_protocols: "",
      responsible_provider_id: "",
      responsible_provider_name: "",
      target_completion_date: "",
      notes: "",
      status: "planned",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (goals.filter(g => g.description.trim()).length === 0) {
      form.setError("root", { message: "At least one goal is required" });
      return;
    }

    const selectedProvider = providers.find(p => p.id === values.responsible_provider_id);

    await createPlan.mutateAsync({
      plan: {
        patient_account_id: patientAccountId,
        plan_title: values.plan_title,
        diagnosis_condition: values.diagnosis_condition,
        treatment_protocols: values.treatment_protocols,
        responsible_provider_id: values.responsible_provider_id,
        responsible_provider_name: selectedProvider?.name || values.responsible_provider_name,
        target_completion_date: values.target_completion_date,
        notes: values.notes,
        status: values.status,
        created_by_user_id: user?.id!,
        created_by_role: effectiveRole!,
        created_by_name: user?.email || 'Unknown',
      },
      goals: goals
        .filter(g => g.description.trim())
        .map(g => ({
          description: g.description,
          smartFlags: {
            is_specific: g.is_specific,
            is_measurable: g.is_measurable,
            is_achievable: g.is_achievable,
            is_relevant: g.is_relevant,
            is_time_bound: g.is_time_bound,
          },
        })),
    });

    onOpenChange(false);
    form.reset();
    setGoals([{ description: "", is_specific: false, is_measurable: false, is_achievable: false, is_relevant: false, is_time_bound: false }]);
  };

  const addGoal = () => {
    setGoals([...goals, { description: "", is_specific: false, is_measurable: false, is_achievable: false, is_relevant: false, is_time_bound: false }]);
  };

  const removeGoal = (index: number) => {
    if (goals.length > 1) {
      setGoals(goals.filter((_, i) => i !== index));
    }
  };

  const updateGoal = (index: number, field: keyof Goal, value: string | boolean) => {
    const updated = [...goals];
    updated[index] = { ...updated[index], [field]: value };
    setGoals(updated);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Treatment Plan</DialogTitle>
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

            {/* Provider & Date Row */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="responsible_provider_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsible Provider</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {providers.map((provider) => (
                          <SelectItem key={provider.id} value={provider.id}>
                            {provider.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
            </div>

            {/* Status */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Initial Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="planned">Planned</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
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

            {/* Goals Section */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Treatment Goals *</h3>
                  <p className="text-sm text-muted-foreground">
                    Add SMART goals (Specific, Measurable, Achievable, Relevant, Time-bound)
                  </p>
                </div>
                <Button type="button" onClick={addGoal} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Goal
                </Button>
              </div>

              {goals.map((goal, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-start gap-2">
                    <GripVertical className="h-5 w-5 text-muted-foreground mt-2 flex-shrink-0" />
                    <div className="flex-1 space-y-3">
                      <div className="flex gap-2">
                        <Input
                          placeholder={`Goal ${index + 1} description...`}
                          value={goal.description}
                          onChange={(e) => updateGoal(index, 'description', e.target.value)}
                        />
                        {goals.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeGoal(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      {/* SMART Checkboxes */}
                      <div className="flex flex-wrap gap-4 text-sm">
                        {[
                          { key: 'is_specific', label: 'Specific' },
                          { key: 'is_measurable', label: 'Measurable' },
                          { key: 'is_achievable', label: 'Achievable' },
                          { key: 'is_relevant', label: 'Relevant' },
                          { key: 'is_time_bound', label: 'Time-bound' },
                        ].map(({ key, label }) => (
                          <label key={key} className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={goal[key as keyof Goal] as boolean}
                              onCheckedChange={(checked) => updateGoal(index, key as keyof Goal, checked as boolean)}
                            />
                            <span className="text-muted-foreground">{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {form.formState.errors.root && (
              <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createPlan.isPending}>
                {createPlan.isPending ? "Creating..." : "Create Plan"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
