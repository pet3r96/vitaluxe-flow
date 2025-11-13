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
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAddPlanUpdate } from "@/hooks/useTreatmentPlans";
import { useAuth } from "@/contexts/AuthContext";

const formSchema = z.object({
  update_type: z.enum(['progress_note', 'status_change', 'goal_update', 'treatment_completed', 'complication', 'patient_feedback', 'provider_note']),
  update_content: z.string().min(1, "Update content is required"),
  previous_status: z.string().optional(),
  new_status: z.string().optional(),
});

interface AddPlanUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  currentStatus?: string;
}

export function AddPlanUpdateDialog({
  open,
  onOpenChange,
  planId,
  currentStatus,
}: AddPlanUpdateDialogProps) {
  const { user, effectiveRole } = useAuth();
  const addUpdate = useAddPlanUpdate();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      update_type: "progress_note",
      update_content: "",
      previous_status: "",
      new_status: "",
    },
  });

  const updateType = form.watch("update_type");

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    await addUpdate.mutateAsync({
      treatment_plan_id: planId,
      update_type: values.update_type,
      update_content: values.update_content,
      previous_status: updateType === 'status_change' ? values.previous_status : undefined,
      new_status: updateType === 'status_change' ? values.new_status : undefined,
      created_by_user_id: user?.id!,
      created_by_role: effectiveRole!,
      created_by_name: user?.email || 'Unknown',
    });

    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Progress Update</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Update Type */}
            <FormField
              control={form.control}
              name="update_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Update Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="progress_note">Progress Note</SelectItem>
                      <SelectItem value="status_change">Status Change</SelectItem>
                      <SelectItem value="goal_update">Goal Update</SelectItem>
                      <SelectItem value="treatment_completed">Treatment Completed</SelectItem>
                      <SelectItem value="complication">Complication</SelectItem>
                      <SelectItem value="patient_feedback">Patient Feedback</SelectItem>
                      <SelectItem value="provider_note">Provider Note</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status Change Fields */}
            {updateType === 'status_change' && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="previous_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Previous Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
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

                <FormField
                  control={form.control}
                  name="new_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
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
              </div>
            )}

            {/* Update Content */}
            <FormField
              control={form.control}
              name="update_content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Update Details</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe the update, progress, or changes..."
                      className="min-h-32"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addUpdate.isPending}>
                {addUpdate.isPending ? "Adding..." : "Add Update"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
