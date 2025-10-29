import { useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { addWeeks, addMonths, format } from "date-fns";

interface CompleteAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: any;
  providers: any[];
  rooms: any[];
  onSuccess: () => void;
}

export function CompleteAppointmentDialog({
  open,
  onOpenChange,
  appointment,
  providers,
  rooms,
  onSuccess,
}: CompleteAppointmentDialogProps) {
  const queryClient = useQueryClient();
  const { effectiveUserId } = useAuth();
  const [scheduleFollowUp, setScheduleFollowUp] = useState<string>("no");
  const [scheduleNextAppointment, setScheduleNextAppointment] = useState<string>("no");

  const { register, handleSubmit, setValue, watch, reset } = useForm({
    defaultValues: {
      // Follow-up fields
      followUpDate: format(addWeeks(new Date(), 1), "yyyy-MM-dd"),
      followUpTime: "09:00",
      followUpReason: `Follow-up on ${appointment?.service_type || "treatment"}`,
      followUpPriority: "medium",
      followUpAssignedTo: appointment?.provider_id || "unassigned",
      followUpNotes: "",
      // Next appointment fields
      nextApptDate: format(addWeeks(new Date(), 2), "yyyy-MM-dd"),
      nextApptTime: "09:00",
      nextApptDuration: "30",
      nextApptProvider: appointment?.provider_id || "",
      nextApptRoom: appointment?.room_id || "none",
      nextApptServiceType: appointment?.service_type || "",
    },
  });

  // Fetch staff members for follow-up assignment
  const { data: staffMembers } = useQuery({
    queryKey: ["staff-members", appointment?.practice_id],
    queryFn: async () => {
      if (!appointment?.practice_id) return [];
      const { data, error } = await supabase.rpc("get_practice_assignable_users", {
        p_practice_id: appointment.practice_id,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!appointment?.practice_id && open,
  });

  // Fetch service types
  const { data: serviceTypes } = useQuery({
    queryKey: ["appointment-service-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_service_types")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const completeMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!effectiveUserId) throw new Error("Not authenticated");

      // 1. Complete the appointment
      const { error: updateError } = await supabase
        .from("patient_appointments")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", appointment.id);

      if (updateError) throw updateError;

      // 2. Create follow-up if requested
      if (scheduleFollowUp === "yes") {
        const { error: followUpError } = await supabase
          .from("patient_follow_ups" as any)
          .insert({
            patient_id: appointment.patient_id,
            created_by: effectiveUserId,
            assigned_to: data.followUpAssignedTo === "unassigned" ? null : data.followUpAssignedTo,
            follow_up_date: data.followUpDate,
            follow_up_time: data.followUpTime || null,
            reason: data.followUpReason,
            notes: data.followUpNotes || null,
            priority: data.followUpPriority,
            status: "pending",
          });

        if (followUpError) throw followUpError;
      }

      // 3. Create next appointment if requested
      if (scheduleNextAppointment === "yes") {
        const startDateTime = new Date(`${data.nextApptDate}T${data.nextApptTime}`);
        const endDateTime = new Date(
          startDateTime.getTime() + parseInt(data.nextApptDuration) * 60000
        );

        const { error: apptError } = await supabase
          .from("patient_appointments")
          .insert({
            patient_id: appointment.patient_id,
            practice_id: appointment.practice_id,
            provider_id: data.nextApptProvider,
            room_id: data.nextApptRoom && data.nextApptRoom !== "none" ? data.nextApptRoom : null,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            appointment_type: "follow_up",
            service_type: data.nextApptServiceType,
            service_description: `Follow-up appointment from ${format(new Date(), "MMM d, yyyy")}`,
            status: "scheduled",
          });

        if (apptError) throw apptError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["being-treated-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["waiting-room-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-data"] });
      queryClient.invalidateQueries({ queryKey: ["patient-follow-ups"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-follow-ups"] });

      const messages = ["Appointment completed"];
      if (scheduleFollowUp === "yes") messages.push("follow-up created");
      if (scheduleNextAppointment === "yes") messages.push("next appointment scheduled");

      toast.success(messages.join(", ") + ".");
      reset();
      setScheduleFollowUp("no");
      setScheduleNextAppointment("no");
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to complete appointment");
    },
  });

  const onSubmit = (data: any) => {
    if (scheduleFollowUp === "yes" && !data.followUpReason?.trim()) {
      toast.error("Please provide a reason for the follow-up");
      return;
    }
    if (scheduleNextAppointment === "yes" && !data.nextApptProvider) {
      toast.error("Please select a provider for the next appointment");
      return;
    }
    completeMutation.mutate(data);
  };

  const setQuickFollowUpDate = (preset: string) => {
    let date: Date;
    switch (preset) {
      case "1w":
        date = addWeeks(new Date(), 1);
        break;
      case "2w":
        date = addWeeks(new Date(), 2);
        break;
      case "1m":
        date = addMonths(new Date(), 1);
        break;
      case "3m":
        date = addMonths(new Date(), 3);
        break;
      default:
        date = addWeeks(new Date(), 1);
    }
    setValue("followUpDate", format(date, "yyyy-MM-dd"));
  };

  const setQuickApptDate = (preset: string) => {
    let date: Date;
    switch (preset) {
      case "1w":
        date = addWeeks(new Date(), 1);
        break;
      case "2w":
        date = addWeeks(new Date(), 2);
        break;
      case "1m":
        date = addMonths(new Date(), 1);
        break;
      case "3m":
        date = addMonths(new Date(), 3);
        break;
      case "6m":
        date = addMonths(new Date(), 6);
        break;
      default:
        date = addWeeks(new Date(), 2);
    }
    setValue("nextApptDate", format(date, "yyyy-MM-dd"));
  };

  if (!appointment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Complete Treatment - {appointment.patient_accounts?.first_name}{" "}
            {appointment.patient_accounts?.last_name}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Schedule Follow-Up Section */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Schedule Follow-Up?</Label>
            <RadioGroup
              value={scheduleFollowUp}
              onValueChange={setScheduleFollowUp}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="followup-yes" />
                <Label htmlFor="followup-yes" className="font-normal cursor-pointer">
                  Yes
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="followup-no" />
                <Label htmlFor="followup-no" className="font-normal cursor-pointer">
                  No
                </Label>
              </div>
            </RadioGroup>

            {scheduleFollowUp === "yes" && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                {/* Quick Date Presets */}
                <div className="space-y-2">
                  <Label className="text-sm">Quick Date Selection</Label>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickFollowUpDate("1w")}
                    >
                      1 Week
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickFollowUpDate("2w")}
                    >
                      2 Weeks
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickFollowUpDate("1m")}
                    >
                      1 Month
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickFollowUpDate("3m")}
                    >
                      3 Months
                    </Button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="followUpDate">Date *</Label>
                    <Input
                      id="followUpDate"
                      type="date"
                      {...register("followUpDate", { required: scheduleFollowUp === "yes" })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="followUpTime">Time</Label>
                    <Input id="followUpTime" type="time" {...register("followUpTime")} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="followUpReason">Reason *</Label>
                  <Textarea
                    id="followUpReason"
                    placeholder="e.g., Check treatment progress, Review lab results"
                    {...register("followUpReason")}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="followUpPriority">Priority</Label>
                    <Select
                      value={watch("followUpPriority")}
                      onValueChange={(value) => setValue("followUpPriority", value)}
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
                    <Label htmlFor="followUpAssignedTo">Assign To</Label>
                    <Select
                      value={watch("followUpAssignedTo")}
                      onValueChange={(value) => setValue("followUpAssignedTo", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select staff member" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {(staffMembers as any)?.map((staff: any) => (
                          <SelectItem key={staff.id} value={staff.id}>
                            {staff.name} ({staff.role_display})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="followUpNotes">Notes</Label>
                  <Textarea
                    id="followUpNotes"
                    placeholder="Additional notes"
                    {...register("followUpNotes")}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Schedule Next Appointment Section */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Schedule Next Appointment?</Label>
            <RadioGroup
              value={scheduleNextAppointment}
              onValueChange={setScheduleNextAppointment}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="nextappt-yes" />
                <Label htmlFor="nextappt-yes" className="font-normal cursor-pointer">
                  Yes
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="nextappt-no" />
                <Label htmlFor="nextappt-no" className="font-normal cursor-pointer">
                  No
                </Label>
              </div>
            </RadioGroup>

            {scheduleNextAppointment === "yes" && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                {/* Quick Date Presets */}
                <div className="space-y-2">
                  <Label className="text-sm">Quick Date Selection</Label>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickApptDate("1w")}
                    >
                      1 Week
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickApptDate("2w")}
                    >
                      2 Weeks
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickApptDate("1m")}
                    >
                      1 Month
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickApptDate("3m")}
                    >
                      3 Months
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickApptDate("6m")}
                    >
                      6 Months
                    </Button>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nextApptDate">Date *</Label>
                    <Input
                      id="nextApptDate"
                      type="date"
                      {...register("nextApptDate", {
                        required: scheduleNextAppointment === "yes",
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nextApptTime">Time *</Label>
                    <Input id="nextApptTime" type="time" {...register("nextApptTime")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nextApptDuration">Duration *</Label>
                    <Select
                      value={watch("nextApptDuration")}
                      onValueChange={(value) => setValue("nextApptDuration", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 min</SelectItem>
                        <SelectItem value="30">30 min</SelectItem>
                        <SelectItem value="45">45 min</SelectItem>
                        <SelectItem value="60">60 min</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nextApptProvider">Provider *</Label>
                    <Select
                      value={watch("nextApptProvider")}
                      onValueChange={(value) => setValue("nextApptProvider", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {providers?.map((provider) => (
                          <SelectItem key={provider.id} value={provider.id}>
                            {provider.full_name || "Unknown"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nextApptRoom">Room</Label>
                    <Select
                      value={watch("nextApptRoom")}
                      onValueChange={(value) => setValue("nextApptRoom", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select room (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No room</SelectItem>
                        {rooms?.map((room) => (
                          <SelectItem key={room.id} value={room.id}>
                            {room.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nextApptServiceType">Service Type</Label>
                  <Select
                    value={watch("nextApptServiceType")}
                    onValueChange={(value) => setValue("nextApptServiceType", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select service type" />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceTypes?.map((type) => (
                        <SelectItem key={type.id} value={type.name}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={completeMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {completeMutation.isPending ? "Completing..." : "Complete & Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
