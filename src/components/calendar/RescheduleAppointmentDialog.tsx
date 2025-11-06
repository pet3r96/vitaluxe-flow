import { useForm } from "react-hook-form";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { Calendar } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { VideoComingSoonDialog } from "@/components/video/VideoComingSoonDialog";

interface RescheduleAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: any;
  providers: any[];
  rooms: any[];
  onSuccess?: () => void;
}

export function RescheduleAppointmentDialog({
  open,
  onOpenChange,
  appointment,
  providers,
  rooms,
  onSuccess,
}: RescheduleAppointmentDialogProps) {
  const queryClient = useQueryClient();
  const { effectiveUserId } = useAuth();
  const [createFollowUp, setCreateFollowUp] = useState(false);
  const [videoComingSoonOpen, setVideoComingSoonOpen] = useState(false);
  const [previousVisitType, setPreviousVisitType] = useState(appointment.visit_type || "in_person");
  
  const appointmentDate = new Date(appointment.start_time);
  const duration = Math.max(1, Math.round((new Date(appointment.end_time).getTime() - new Date(appointment.start_time).getTime()) / 60000));

  const { register, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
      providerId: appointment.provider_id || "",
      roomId: appointment.room_id || "none",
      appointmentDate: format(appointmentDate, 'yyyy-MM-dd'),
      startTime: format(appointmentDate, 'HH:mm'),
      duration: duration.toString(),
      appointmentType: appointment.appointment_type || "consultation",
      visitType: appointment.visit_type || "in_person",
      serviceType: appointment.service_type || "",
      serviceDescription: appointment.service_description || "",
      notes: appointment.notes || "",
    },
  });

  // Fetch service types
  const { data: serviceTypes } = useQuery({
    queryKey: ['appointment-service-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointment_service_types')
        .select('*')
        .eq('active', true)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const rescheduleMutation = useMutation({
    mutationFn: async (values: any) => {
      const startDateTime = new Date(`${values.appointmentDate}T${values.startTime}`);
      const endDateTime = new Date(startDateTime.getTime() + parseInt(values.duration) * 60000);

      // Call the update-appointment-time edge function
      const { data, error } = await supabase.functions.invoke('update-appointment-time', {
        body: {
          appointmentId: appointment.id,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          providerId: values.providerId,
          roomId: values.roomId && values.roomId !== 'none' ? values.roomId : null,
        }
      });

      if (error) {
        // Handle 409 conflict error
        if (error.message?.includes('conflict') || error.message?.includes('409')) {
          throw new Error('This time slot is not available. Please choose a different time.');
        }
        throw error;
      }

      // Update other fields directly
      const { error: updateError } = await supabase
        .from('patient_appointments')
        .update({
          appointment_type: values.appointmentType,
          service_type: values.serviceType,
          service_description: values.serviceDescription,
          notes: values.notes,
        })
        .eq('id', appointment.id);

      if (updateError) throw updateError;

      // Create follow-up if requested
      if (createFollowUp && effectiveUserId) {
        const startDateTime = new Date(`${values.appointmentDate}T${values.startTime}`);
        const followUpDate = new Date(startDateTime);
        followUpDate.setDate(followUpDate.getDate() + 7); // Default 1 week later

        await supabase.from("patient_follow_ups" as any).insert({
          patient_id: appointment.patient_id,
          created_by: effectiveUserId,
          assigned_to: values.providerId,
          follow_up_date: followUpDate.toISOString().split('T')[0],
          follow_up_time: "09:00",
          reason: values.serviceType || values.serviceDescription || "Follow-up appointment",
          notes: `Follow-up for rescheduled appointment`,
          priority: "medium",
          status: "pending",
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-data'] });
      queryClient.invalidateQueries({ queryKey: ['patient-follow-ups'] });
      toast.success(
        createFollowUp
          ? "Appointment rescheduled and follow-up created"
          : "Appointment rescheduled successfully"
      );
      onOpenChange(false);
      setCreateFollowUp(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to reschedule appointment");
    },
  });

  const onSubmit = (values: any) => {
    if (!values.serviceType) {
      toast.error("Please select a service type");
      return;
    }
    if (!values.serviceDescription) {
      toast.error("Please provide a service description");
      return;
    }
    rescheduleMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Reschedule Appointment
          </DialogTitle>
        </DialogHeader>

        <div className="mb-4 p-3 bg-muted rounded-lg">
          <div className="text-sm">
            <div className="font-medium">Current appointment:</div>
            <div className="text-muted-foreground">
              {format(new Date(appointment.start_time), 'MMMM d, yyyy')} at {format(new Date(appointment.start_time), 'h:mm a')}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="providerId">Provider *</Label>
              <Select 
                value={watch("providerId")} 
                onValueChange={(value) => setValue("providerId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers && providers.length > 0 ? (
                    providers.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.full_name || `${provider.first_name} ${provider.last_name}`}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-providers-available" disabled>
                      No providers available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="roomId">Room</Label>
              <Select value={watch("roomId")} onValueChange={(value) => setValue("roomId", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select room (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No room</SelectItem>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="appointmentDate">Date *</Label>
              <Input
                id="appointmentDate"
                type="date"
                {...register("appointmentDate", { required: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startTime">Time *</Label>
              <Input
                id="startTime"
                type="time"
                {...register("startTime", { required: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration (min) *</Label>
              <Select value={watch("duration")} onValueChange={(value) => setValue("duration", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="appointmentType">Appointment Type</Label>
            <Select value={watch("appointmentType")} onValueChange={(value) => setValue("appointmentType", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="walk_in">Walk-in</SelectItem>
                <SelectItem value="consultation">Consultation</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
                <SelectItem value="procedure">Procedure</SelectItem>
                <SelectItem value="initial">Initial Visit</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visitType">Visit Type *</Label>
            <Select 
              value={watch("visitType")} 
              onValueChange={(value) => {
                if (value === "video") {
                  setVideoComingSoonOpen(true);
                  // Don't change the value, keep previous selection
                } else {
                  setPreviousVisitType(value);
                  setValue("visitType", value);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_person">In-Person</SelectItem>
                <SelectItem value="video">Video Call</SelectItem>
                <SelectItem value="phone">Phone Call</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="serviceType">Service Type *</Label>
            <Select 
              value={watch("serviceType")} 
              onValueChange={(value) => {
                setValue("serviceType", value);
                const serviceType = serviceTypes?.find(st => st.id === value);
                if (serviceType?.typical_duration_minutes) {
                  setValue("duration", serviceType.typical_duration_minutes.toString());
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select service type" />
              </SelectTrigger>
              <SelectContent>
                {serviceTypes?.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {watch("serviceType") && (
            <div className="space-y-2">
              <Label htmlFor="serviceDescription">Service Description *</Label>
              <Textarea
                id="serviceDescription"
                {...register("serviceDescription", { required: true })}
                rows={2}
                placeholder="Describe the specific service or treatment..."
                className="resize-none"
              />
              {serviceTypes?.find(st => st.id === watch("serviceType"))?.description && (
                <p className="text-xs text-muted-foreground">
                  {serviceTypes.find(st => st.id === watch("serviceType"))?.description}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              rows={3}
              placeholder="Add any notes about this appointment..."
            />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="create-follow-up-reschedule"
              checked={createFollowUp}
              onCheckedChange={(checked) => setCreateFollowUp(checked as boolean)}
            />
            <Label
              htmlFor="create-follow-up-reschedule"
              className="text-sm font-normal cursor-pointer"
            >
              Create a follow-up (1 week after rescheduled time)
            </Label>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={rescheduleMutation.isPending}>
              {rescheduleMutation.isPending ? "Rescheduling..." : "Reschedule Appointment"}
            </Button>
          </div>
        </form>
      </DialogContent>
      
      <VideoComingSoonDialog 
        open={videoComingSoonOpen} 
        onOpenChange={setVideoComingSoonOpen}
        feature="Video Appointments"
      />
    </Dialog>
  );
}
