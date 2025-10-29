import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { useEffect } from "react";

interface FollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
  followUp?: any;
}

export function FollowUpDialog({
  open,
  onOpenChange,
  patientId,
  patientName,
  followUp,
}: FollowUpDialogProps) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: {
      follow_up_date: "",
      follow_up_time: "",
      reason: "",
      notes: "",
      priority: "medium",
      assigned_to: "",
    },
  });

  const { data: staffMembers } = useQuery({
    queryKey: ["staff-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", [
          ...(await supabase.from("user_roles").select("user_id").eq("role", "doctor")).data?.map(r => r.user_id) || [],
          ...(await supabase.from("user_roles").select("user_id").eq("role", "provider")).data?.map(r => r.user_id) || [],
        ])
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (followUp) {
      setValue("follow_up_date", followUp.follow_up_date);
      setValue("follow_up_time", followUp.follow_up_time || "");
      setValue("reason", followUp.reason);
      setValue("notes", followUp.notes || "");
      setValue("priority", followUp.priority);
      setValue("assigned_to", followUp.assigned_to || "");
    } else {
      reset();
    }
  }, [followUp, setValue, reset]);

  const createFollowUp = useMutation({
    mutationFn: async (data: any) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Not authenticated");

      const payload = {
        patient_id: patientId,
        created_by: user.id,
        assigned_to: data.assigned_to || null,
        follow_up_date: data.follow_up_date,
        follow_up_time: data.follow_up_time || null,
        reason: data.reason,
        notes: data.notes || null,
        priority: data.priority,
        status: "pending",
      };

      if (followUp) {
        const { error } = await supabase
          .from("patient_follow_ups" as any)
          .update(payload)
          .eq("id", followUp.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("patient_follow_ups" as any)
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-follow-ups"] });
      queryClient.invalidateQueries({ queryKey: ["follow-up-reminders"] });
      toast.success(followUp ? "Follow-up updated" : "Follow-up created");
      onOpenChange(false);
      reset();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save follow-up");
    },
  });

  const onSubmit = (data: any) => {
    createFollowUp.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {followUp ? "Edit Follow-Up" : "Add Follow-Up"} for {patientName}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              <Label htmlFor="follow_up_time">Follow-Up Time (Optional)</Label>
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
              placeholder="e.g., Check blood pressure medication effectiveness"
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
              <Label htmlFor="assigned_to">Assign To (Optional)</Label>
              <Select
                value={watch("assigned_to")}
                onValueChange={(value) => setValue("assigned_to", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {staffMembers?.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
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
              {createFollowUp.isPending
                ? "Saving..."
                : followUp
                ? "Update Follow-Up"
                : "Create Follow-Up"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
