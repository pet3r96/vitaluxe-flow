import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { addDays, addWeeks, addMonths, format } from "date-fns";
import { AppointmentWithRelations } from "@/types/appointments";
import { PracticeAssignableUser } from "@/types/practiceStaff";

interface CreateFollowUpFromAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentWithRelations;
}

export function CreateFollowUpFromAppointmentDialog({
  open,
  onOpenChange,
  appointment,
}: CreateFollowUpFromAppointmentDialogProps) {
  const queryClient = useQueryClient();
  const { effectiveUserId } = useAuth();
  
  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      follow_up_date: format(addWeeks(new Date(), 1), 'yyyy-MM-dd'),
      follow_up_time: "09:00",
      reason: appointment?.service_type || appointment?.service_description || "",
      notes: `Follow-up for appointment on ${format(new Date(appointment?.start_time || new Date()), 'MMM d, yyyy')}`,
      priority: "medium",
      assigned_to: appointment?.provider_id || "",
    },
  });

  const { data: staffMembers } = useQuery<PracticeAssignableUser[]>({
    queryKey: ["staff-members", appointment?.practice_id],
    queryFn: async () => {
      if (!appointment?.practice_id) return [];
      const { data, error } = await supabase.rpc("get_practice_assignable_users", {
        p_practice_id: appointment.practice_id,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!appointment?.practice_id,
  });

  const createFollowUp = useMutation({
    mutationFn: async (data: any) => {
      if (!effectiveUserId) throw new Error("Not authenticated");

      const payload = {
        patient_id: appointment.patient_id,
        practice_id: appointment.practice_id,
        created_by: effectiveUserId,
        assigned_to: data.assigned_to || null,
        due_date: data.follow_up_date,
        follow_up_date: data.follow_up_date,
        follow_up_time: data.follow_up_time || null,
        subject: data.reason || "Follow-up",
        reason: data.reason,
        notes: data.notes || null,
        priority: data.priority,
        status: "pending",
      };

      const { error } = await supabase
        .from("patient_follow_ups")
        .insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-follow-ups"] });
      queryClient.invalidateQueries({ queryKey: ["follow-up-reminders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-follow-ups"] });
      toast.success("Follow-up created successfully");
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Failed to create follow-up";
      toast.error(message);
    },
  });

  const onSubmit = (data: any) => {
    if (!data.reason?.trim()) {
      toast.error("Please provide a reason for the follow-up");
      return;
    }
    if (!data.assigned_to) {
      toast.error("Please assign this follow-up to a team member");
      return;
    }
    createFollowUp.mutate(data);
  };

  const setQuickDate = (preset: string) => {
    let date: Date;
    switch (preset) {
      case "3d":
        date = addDays(new Date(), 3);
        break;
      case "1w":
        date = addWeeks(new Date(), 1);
        break;
      case "2w":
        date = addWeeks(new Date(), 2);
        break;
      case "1m":
        date = addMonths(new Date(), 1);
        break;
      default:
        date = addWeeks(new Date(), 1);
    }
    setValue("follow_up_date", format(date, 'yyyy-MM-dd'));
  };

  if (!appointment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Create Follow-Up for {appointment.patient_account?.first_name}{' '}
            {appointment.patient_account?.last_name}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Quick Date Presets */}
          <div className="space-y-2">
            <Label>Quick Date Selection</Label>
            <div className="flex gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuickDate("3d")}
              >
                3 Days
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuickDate("1w")}
              >
                1 Week
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuickDate("2w")}
              >
                2 Weeks
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuickDate("1m")}
              >
                1 Month
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="follow_up_date">Follow-Up Date *</Label>
              <Input
                id="follow_up_date"
                type="date"
                {...register("follow_up_date", { required: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="follow_up_time">Follow-Up Time</Label>
              <Input
                id="follow_up_time"
                type="time"
                {...register("follow_up_time")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <Textarea
              id="reason"
              placeholder="e.g., Check treatment progress, Review lab results"
              {...register("reason", { required: true })}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={watch("priority")}
                onValueChange={(value) => setValue("priority", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assigned_to">Assign To *</Label>
              <Select
                value={watch("assigned_to")}
                onValueChange={(value) => setValue("assigned_to", value)}
              >
                <SelectTrigger className={!watch("assigned_to") ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staffMembers && staffMembers.filter(s => s.role === "admin").length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                        Admin
                      </div>
                      {staffMembers
                        .filter(s => s.role === "admin")
                        .map(staff => (
                          <SelectItem key={staff.id} value={staff.id}>
                            {staff.name}
                          </SelectItem>
                        ))}
                    </>
                  )}
                  
                  {staffMembers && staffMembers.filter(s => s.role === "provider").length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground border-t mt-1 pt-2">
                        Providers
                      </div>
                      {staffMembers
                        .filter(s => s.role === "provider")
                        .map(staff => (
                          <SelectItem key={staff.id} value={staff.id}>
                            {staff.name}
                          </SelectItem>
                        ))}
                    </>
                  )}
                  
                  {staffMembers && staffMembers.filter(s => s.role === "staff").length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground border-t mt-1 pt-2">
                        Staff
                      </div>
                      {staffMembers
                        .filter(s => s.role === "staff")
                        .map(staff => (
                          <SelectItem key={staff.id} value={staff.id}>
                            <div className="flex flex-col">
                              <span>{staff.name}</span>
                              {staff.staff_role_type && (
                                <span className="text-xs text-muted-foreground">
                                  {staff.staff_role_type}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes or instructions"
              {...register("notes")}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createFollowUp.isPending}>
              {createFollowUp.isPending ? "Creating..." : "Create Follow-Up"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
