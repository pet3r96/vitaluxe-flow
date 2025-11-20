import { useMemo } from "react";
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
import { PracticeAssignableUser } from "@/types/practiceStaff";

interface FollowUpData {
  follow_up_date: string;
  follow_up_time?: string;
  reason: string;
  notes?: string;
  priority: string;
  assigned_to?: string;
  [key: string]: any;
}

interface FollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
  followUp?: FollowUpData;
}

export function FollowUpDialog({
  open,
  onOpenChange,
  patientId,
  patientName,
  followUp,
}: FollowUpDialogProps) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      follow_up_date: "",
      follow_up_time: "",
      reason: "",
      notes: "",
      priority: "medium",
      assigned_to: "",
    },
  });

  const { data: staffMembers } = useQuery<PracticeAssignableUser[]>({
    queryKey: ["staff-members", patientId],
    queryFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Not authenticated");

      // Get the patient's practice_id
      const { data: patientData, error: patientError } = await supabase
        .from("patient_accounts")
        .select("practice_id")
        .eq("id", patientId)
        .single();

      if (patientError) throw patientError;
      if (!patientData) throw new Error("Patient not found");

      // Fetch all assignable users for this practice
      const { data, error } = await supabase.rpc("get_practice_assignable_users", {
        p_practice_id: patientData.practice_id,
      });

      if (error) throw error;
      return data || [];
    },
  });

  // De-duplicate staff members by ID to prevent duplicate entries in the dropdown
  const uniqueStaffMembers = useMemo(() => {
    if (!staffMembers) return [];
    
    const seen = new Set<string>();
    return staffMembers.filter(member => {
      if (seen.has(member.id)) return false;
      seen.add(member.id);
      return true;
    });
  }, [staffMembers]);

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
      // Set default assigned_to to first available staff member
      if (uniqueStaffMembers && uniqueStaffMembers.length > 0) {
        setValue("assigned_to", uniqueStaffMembers[0].id);
      }
    }
  }, [followUp, setValue, reset, uniqueStaffMembers]);

  const createFollowUp = useMutation({
    mutationFn: async (data: any) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Not authenticated");

      // Get the patient's practice_id
      const { data: patientData, error: patientError } = await supabase
        .from("patient_accounts")
        .select("practice_id")
        .eq("id", patientId)
        .single();

      if (patientError) throw patientError;
      if (!patientData?.practice_id) throw new Error("Patient practice not found");

      // Verify user belongs to patient's practice before attempting mutation
      const { data: practiceCheck, error: rpcError } = await supabase.rpc('user_belongs_to_patient_practice', {
        _user_id: user.id,
        _patient_account_id: patientId
      });

      if (rpcError) {
        import('@/lib/logger').then(({ logger }) => {
          logger.error("Practice membership RPC check failed", rpcError, { patientId });
        });
        throw new Error(`Practice access check failed: ${rpcError.message}`);
      }

      if (!practiceCheck) {
        throw new Error("You do not have access to this patient's practice");
      }

      const payload = {
        patient_id: patientId,
        practice_id: patientData.practice_id,
        created_by: user.id,
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

      if (followUp) {
        const { error, data: result } = await supabase
          .from("patient_follow_ups")
          .update(payload)
          .eq("id", followUp.id);
        
        if (error) {
          import('@/lib/logger').then(({ logger }) => {
            logger.error("Follow-up UPDATE failed", error, { followUpId: followUp.id, patientId });
          });
          throw error;
        }
      } else {
        const { error, data: result } = await supabase
          .from("patient_follow_ups")
          .insert(payload)
          .select();
        
        if (error) {
          import('@/lib/logger').then(({ logger }) => {
            logger.error("Follow-up INSERT failed", error, { 
              patientId,
              errorCode: error.code,
              errorDetails: error.details,
              errorHint: error.hint,
              errorMessage: error.message,
              payload: { ...payload, notes: '[redacted]' }
            });
          });
          throw error;
        }
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
      import('@/lib/logger').then(({ logger }) => {
        logger.error("Follow-up mutation error", error, { patientId });
      });
      toast.error(error.message || "Failed to save follow-up");
    },
  });

  const onSubmit = (data: any) => {
    if (!data.assigned_to) {
      toast.error("Please assign this follow-up to a team member");
      return;
    }
    createFollowUp.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl">
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
              <Label htmlFor="assigned_to">Assign To *</Label>
              <Select
                value={watch("assigned_to") || ""}
                onValueChange={(value) => setValue("assigned_to", value)}
              >
                <SelectTrigger className={!watch("assigned_to") ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  
                  {uniqueStaffMembers && uniqueStaffMembers.filter(s => s.role === "admin").length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                        Admin
                      </div>
                      {uniqueStaffMembers
                        .filter(s => s.role === "admin")
                        .map(staff => (
                          <SelectItem key={staff.id} value={staff.id}>
                            {staff.name}
                          </SelectItem>
                        ))}
                    </>
                  )}
                  
                  {uniqueStaffMembers && uniqueStaffMembers.filter(s => s.role === "provider").length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground border-t mt-1 pt-2">
                        Providers
                      </div>
                      {uniqueStaffMembers
                        .filter(s => s.role === "provider")
                        .map(staff => (
                          <SelectItem key={staff.id} value={staff.id}>
                            {staff.name}
                          </SelectItem>
                        ))}
                    </>
                  )}
                  
                  {uniqueStaffMembers && uniqueStaffMembers.filter(s => s.role === "staff").length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground border-t mt-1 pt-2">
                        Staff
                      </div>
                      {uniqueStaffMembers
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
