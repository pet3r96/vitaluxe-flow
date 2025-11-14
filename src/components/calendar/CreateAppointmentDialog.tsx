import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeChannel } from "@/lib/video/normalizeChannel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { getProviderDisplayName } from "@/utils/providerNameUtils";

interface CreateAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  practiceId: string;
  defaultDate?: Date;
  defaultProviderId?: string;
  defaultPatientId?: string;
  providers: any[];
  rooms: any[];
  isWalkIn?: boolean;
  isProviderAccount?: boolean;
  defaultVisitType?: string;
}

export function CreateAppointmentDialog({
  open,
  onOpenChange,
  practiceId,
  defaultDate,
  defaultProviderId,
  defaultPatientId,
  providers,
  rooms,
  isWalkIn = false,
  isProviderAccount = false,
  defaultVisitType,
}: CreateAppointmentDialogProps) {
  const queryClient = useQueryClient();
  const { effectiveUserId } = useAuth();
  const [selectedPatientId, setSelectedPatientId] = useState(defaultPatientId || "");
  const [createFollowUp, setCreateFollowUp] = useState(false);

  // Debug logging for providers
  useEffect(() => {
    if (open) {
      console.log('[CreateAppointmentDialog] Providers received:', providers);
      console.log('[CreateAppointmentDialog] Number of providers:', providers?.length);
      providers?.forEach((p, idx) => {
        console.log(`[CreateAppointmentDialog] Provider ${idx}:`, {
          id: p.id,
          full_name: p.full_name,
          first_name: p.first_name,
          last_name: p.last_name,
          raw: p
        });
      });
    }
  }, [open, providers]);
  
  // Sync selectedPatientId when dialog opens with a defaultPatientId
  useEffect(() => {
    if (open && defaultPatientId) {
      setSelectedPatientId(defaultPatientId);
    }
  }, [open, defaultPatientId]);
  
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
      visitType: defaultVisitType || "in_person",
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
        .select('id, first_name, last_name, email, user_id')
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

  // Watch visitType to conditionally fetch rooms
  const visitType = watch("visitType");

  // Fetch rooms dynamically when visit type is in-person
  const { data: fetchedRooms, isLoading: roomsLoading } = useQuery({
    queryKey: ['practice-rooms', practiceId, visitType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('practice_rooms')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: open && visitType === 'in_person',
  });

  // Determine which rooms to display
  const displayRooms = visitType === 'in_person' 
    ? (fetchedRooms || rooms) 
    : rooms;

  const createMutation = useMutation({
    mutationFn: async (values: any) => {
      const startDateTime = new Date(`${values.appointmentDate}T${values.startTime}`);
      const endDateTime = new Date(startDateTime.getTime() + parseInt(values.duration) * 60000);

      const { data, error } = await supabase
        .from('patient_appointments')
        .insert({
          patient_id: selectedPatientId,
          practice_id: practiceId,
          provider_id: values.providerId || null,
          room_id: values.roomId && values.roomId !== 'none' ? values.roomId : null,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          appointment_type: values.appointmentType,
          visit_type: values.visitType,
          service_type: values.serviceType || null,
          service_description: values.serviceDescription,
          notes: values.notes,
          status: isWalkIn ? 'checked_in' : 'scheduled',
          checked_in_at: isWalkIn ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (error) throw error;

      console.log('[CreateAppointmentDialog] ✅ Appointment created:', {
        id: data.id,
        type: values.appointmentType,
        status: isWalkIn ? 'checked_in' : 'scheduled',
        isWalkIn,
        patient_id: selectedPatientId,
        start_time: startDateTime.toISOString()
      });

      // If this is a video appointment, create video session via edge function
      if (values.visitType === 'video') {
        console.log('[CreateAppointmentDialog] Creating video session via edge function');

        const { data: videoSession, error: videoError } = await supabase.functions.invoke(
          'create-video-session',
          {
            body: {
              practiceId: practiceId,
              providerId: values.providerId,
              patientId: selectedPatientId,
              sessionType: 'scheduled',
              scheduledStart: startDateTime.toISOString(),
              scheduledEnd: endDateTime.toISOString()
            }
          }
        );

        if (videoError) {
          console.error('[CreateAppointmentDialog] Error creating video session:', videoError);
          throw videoError;
        }

        console.log('[CreateAppointmentDialog] Video session created:', videoSession);

        // Link video session to appointment
        const sessionId = videoSession?.session?.id;
        if (sessionId) {
          const { error: updateError } = await supabase
            .from('patient_appointments')
            .update({ video_session_id: sessionId })
            .eq('id', data.id);

          if (updateError) {
            console.error('[CreateAppointmentDialog] Error linking video session:', updateError);
            throw updateError;
          }

          data.video_session_id = sessionId;
        }
      }

      // Create follow-up if requested
      if (createFollowUp && data && effectiveUserId) {
        const followUpDate = new Date(startDateTime);
        followUpDate.setDate(followUpDate.getDate() + 7); // Default 1 week later

        await supabase.from("patient_follow_ups" as any).insert({
          patient_id: selectedPatientId,
          created_by: effectiveUserId,
          assigned_to: values.providerId,
          follow_up_date: followUpDate.toISOString().split('T')[0],
          follow_up_time: "09:00",
          reason: values.serviceType || values.serviceDescription || "Follow-up appointment",
          notes: `Follow-up for appointment on ${values.appointmentDate}`,
          priority: "medium",
          status: "pending",
        });
      }

      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-data'] });
      queryClient.invalidateQueries({ queryKey: ['waiting-room'] });
      queryClient.invalidateQueries({ queryKey: ['patient-follow-ups'] });
      
      // Send notification to patient if they have portal access
      const selectedPatient = patients?.find(p => p.id === selectedPatientId);
      if (selectedPatient?.user_id) {
        try {
          const appointmentDate = new Date(data.start_time);
          const formattedDate = appointmentDate.toLocaleDateString();
          const formattedTime = appointmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          
          // Fetch practice address
          const { data: practice } = await supabase
            .from('profiles')
            .select('address_street, address_city, address_state, address_zip')
            .eq('id', practiceId)
            .single();
          
          const isVideo = data.visit_type === 'video';
          const title = isVideo ? 'Video Appointment Scheduled' : 'Appointment Scheduled';
          
          // Generate join URLs for video appointments
          let providerJoinUrl: string | undefined;
          let patientJoinUrl: string | undefined;

          if (isVideo && data.video_session_id) {
            const baseUrl = window.location.origin;
            providerJoinUrl = `${baseUrl}/practice/video/${data.video_session_id}`;
            patientJoinUrl = `${baseUrl}/patient/video/${data.video_session_id}`;
            
            console.log('[CreateAppointmentDialog] Video join URLs generated:', {
              provider: providerJoinUrl,
              patient: patientJoinUrl
            });
          }
          
          let message;
          if (isVideo) {
            message = `Your video appointment is scheduled for ${formattedDate} at ${formattedTime}.`;
            if (patientJoinUrl) {
              message += `\n\nJoin here: ${patientJoinUrl}`;
            }
          } else {
            const address = practice 
              ? `${practice.address_street}, ${practice.address_city}, ${practice.address_state} ${practice.address_zip}`
              : '';
            message = `Your appointment is scheduled for an in-office appointment on ${formattedDate} at ${formattedTime}${address ? ` at ${address}` : ''}.`;
          }
          
          await supabase.functions.invoke('handleNotifications', {
            body: {
              user_id: selectedPatient.user_id,
              notification_type: 'appointment_confirmed',
              title,
              message,
              metadata: {
                appointmentId: data.id,
                appointmentDate: formattedDate,
                appointmentTime: formattedTime,
                visitType: data.visit_type,
                ...(isVideo && data.video_session_id && {
                  videoSessionId: data.video_session_id,
                  join_links: {
                    provider: providerJoinUrl,
                    patient: patientJoinUrl
                  }
                })
              },
              entity_type: 'appointment',
              entity_id: data.id
            }
          });
          console.log('[CreateAppointmentDialog] Notification sent for appointment:', data.id);
        } catch (notifError) {
          console.error('[CreateAppointmentDialog] Failed to send notification:', notifError);
        }
      } else {
        console.log('[CreateAppointmentDialog] No portal access for patient; skipping notifications.');
      }
      
      toast.success(
        createFollowUp 
          ? (isWalkIn ? "Walk-in and follow-up created" : "Appointment and follow-up created")
          : (isWalkIn ? "Walk-in appointment created successfully" : "Appointment created successfully")
      );
      reset();
      setSelectedPatientId("");
      setCreateFollowUp(false);
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
    if (!values.providerId) {
      toast.error("Please select a provider");
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
    
    // Prevent creating scheduled appointments in the past
    if (!isWalkIn) {
      const startDateTime = new Date(`${values.appointmentDate}T${values.startTime}`);
      const now = new Date();
      if (startDateTime < now) {
        toast.error("Appointment start time can't be in the past");
        return;
      }
    }
    
    createMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isWalkIn && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gold1/15 text-gold1 dark:bg-gold1/20">
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
                            <div className="flex items-center justify-between w-full gap-2">
                              <span>{(provider as any).display_name || getProviderDisplayName(provider)}</span>
                              {(provider as any).type && (
                                <Badge 
                                  variant={(provider as any).type === 'provider' ? 'default' : 'secondary'}
                                  className="ml-2 text-[10px] px-1.5 py-0"
                                >
                                  {(provider as any).type === 'provider' ? 'Provider' : 'Staff'}
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-providers-available" disabled>
                          No providers or staff available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

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
            <Label htmlFor="visitType">Visit Type *</Label>
            <Select value={watch("visitType")} onValueChange={(value) => setValue("visitType", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_person">In-Person</SelectItem>
                <SelectItem value="video">Video Call</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="roomId">
              Room 
              {visitType === 'video' && (
                <span className="text-muted-foreground text-xs ml-1">
                  (Not required for video)
                </span>
              )}
              {visitType === 'in_person' && !displayRooms?.length && (
                <span className="text-amber-500 text-xs ml-1">
                  (No rooms configured)
                </span>
              )}
            </Label>
            <Select 
              value={watch("roomId")} 
              onValueChange={(value) => setValue("roomId", value)}
              disabled={roomsLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  roomsLoading 
                    ? "Loading rooms..." 
                    : visitType === 'in_person' && displayRooms?.length 
                      ? "Select room (optional)" 
                      : "No room"
                } />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No room</SelectItem>
                {displayRooms?.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: room.color }}
                      />
                      {room.name}
                      {room.capacity && (
                        <span className="text-xs text-muted-foreground">
                          (Cap: {room.capacity})
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
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
              id="create-follow-up"
              checked={createFollowUp}
              onCheckedChange={(checked) => setCreateFollowUp(checked as boolean)}
            />
            <Label
              htmlFor="create-follow-up"
              className="text-sm font-normal cursor-pointer"
            >
              Create a follow-up (1 week after this appointment)
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
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Appointment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
