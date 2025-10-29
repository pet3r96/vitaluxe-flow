import { useState } from "react";
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

interface CreateAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  practiceId: string;
  defaultDate?: Date;
  defaultProviderId?: string;
  providers: any[];
  rooms: any[];
  isWalkIn?: boolean;
  isProviderAccount?: boolean;
}

export function CreateAppointmentDialog({
  open,
  onOpenChange,
  practiceId,
  defaultDate,
  defaultProviderId,
  providers,
  rooms,
  isWalkIn = false,
  isProviderAccount = false,
}: CreateAppointmentDialogProps) {
  const queryClient = useQueryClient();
  const [selectedPatientId, setSelectedPatientId] = useState("");
  
  // For walk-ins, round current time to nearest 5 minutes
  const getCurrentTimeRounded = () => {
    const now = new Date();
    const minutes = Math.round(now.getMinutes() / 5) * 5;
    now.setMinutes(minutes);
    now.setSeconds(0);
    return now;
  };
  
  const walkInDate = isWalkIn ? getCurrentTimeRounded() : (defaultDate || new Date());
  
  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      providerId: defaultProviderId || (isProviderAccount && providers.length === 1 ? providers[0].id : ""),
      roomId: "",
      appointmentDate: format(walkInDate, 'yyyy-MM-dd'),
      startTime: format(walkInDate, 'HH:mm'),
      duration: isWalkIn ? "15" : "30",
      appointmentType: isWalkIn ? "walk_in" : "consultation",
      serviceType: "",
      serviceDescription: "",
      notes: "",
    },
  });

  // Fetch patients for the practice
  const { data: patients } = useQuery({
    queryKey: ['practice-patients', practiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_accounts')
        .select('id, first_name, last_name, email')
        .eq('practice_id', practiceId)
        .order('last_name');
      if (error) throw error;
      return data;
    },
    enabled: open,
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

  const createMutation = useMutation({
    mutationFn: async (values: any) => {
      const startDateTime = new Date(`${values.appointmentDate}T${values.startTime}`);
      const endDateTime = new Date(startDateTime.getTime() + parseInt(values.duration) * 60000);

      const { data, error } = await supabase
        .from('patient_appointments')
        .insert({
          patient_id: selectedPatientId,
          practice_id: practiceId,
          provider_id: values.providerId,
          room_id: values.roomId && values.roomId !== 'none' ? values.roomId : null,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          appointment_type: values.appointmentType,
          service_type: values.serviceType,
          service_description: values.serviceDescription,
          notes: values.notes,
          status: isWalkIn ? 'checked_in' : 'scheduled',
          checked_in_at: isWalkIn ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-data'] });
      queryClient.invalidateQueries({ queryKey: ['waiting-room'] });
      toast.success(isWalkIn ? "Walk-in appointment created successfully" : "Appointment created successfully");
      reset();
      setSelectedPatientId("");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create appointment");
    },
  });

  const onSubmit = (values: any) => {
    if (!selectedPatientId) {
      toast.error("Please select a patient");
      return;
    }
    if (!values.serviceType) {
      toast.error("Please select a service type");
      return;
    }
    if (!values.serviceDescription) {
      toast.error("Please provide a service description");
      return;
    }
    createMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isWalkIn && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                WALK-IN
              </span>
            )}
            {isWalkIn ? "Walk-in Patient" : "Create Appointment"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="patient">Patient *</Label>
            <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select patient" />
              </SelectTrigger>
              <SelectContent>
                {patients && patients.length > 0 ? (
                  patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.first_name} {patient.last_name} ({patient.email})
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-patients-available" disabled>
                    No patients found - please add patients first
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

              <div className="grid grid-cols-2 gap-4">
                {!isProviderAccount && (
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
                )}

                <div className={`space-y-2 ${isProviderAccount ? 'col-span-2' : ''}`}>
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
                disabled={isWalkIn}
                className={isWalkIn ? "bg-muted cursor-not-allowed" : ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startTime">Time *</Label>
              <Input
                id="startTime"
                type="time"
                {...register("startTime", { required: true })}
                disabled={isWalkIn}
                className={isWalkIn ? "bg-muted cursor-not-allowed" : ""}
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

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Appointment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
