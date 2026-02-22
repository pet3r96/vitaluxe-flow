import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
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
  providers: import("@/hooks/useProvidersAndStaff").ProviderOrStaff[];
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
  
  // Helper function to derive appointment_type from service type name
  const deriveAppointmentType = (serviceTypeName: string | undefined): string => {
    if (!serviceTypeName) return 'other';
    
    const nameLower = serviceTypeName.toLowerCase();
    
    if (nameLower.includes('consultation')) return 'consultation';
    if (nameLower.includes('follow-up') || nameLower.includes('follow up')) return 'follow_up';
    if (nameLower.includes('treatment') || nameLower.includes('procedure')) return 'procedure';
    
    if (nameLower.includes('walk-in') || nameLower.includes('walk in')) return 'walk_in';
    
    return 'other';
  };
  const queryClient = useQueryClient();
  const { effectiveUserId } = useAuth();
  const [selectedPatientId, setSelectedPatientId] = useState(defaultPatientId || "");
  const [createFollowUp, setCreateFollowUp] = useState(false);
  const [showComingSoonDialog, setShowComingSoonDialog] = useState(false);

  // Debug logging for providers
  useEffect(() => {
    if (open) {
      import('@/lib/logger').then(({ logger }) => {
        logger.info('CreateAppointmentDialog providers', { count: providers?.length });
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
  
  // Find the logged-in provider's ID
  const loggedInProviderId = isProviderAccount 
    ? providers.find(p => p.user_id === effectiveUserId)?.id 
    : undefined;
  
  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      providerId: defaultProviderId || loggedInProviderId || "",
      roomId: "",
      appointmentDate: format(walkInDate, 'yyyy-MM-dd'),
      startTime: format(walkInDate, 'HH:mm'),
      duration: isWalkIn ? "15" : "30",
      visitType: defaultVisitType || "in_person",
      serviceType: "",
      serviceDescription: "",
      notes: "",
    },
  });
  
  // Auto-select logged-in provider when dialog opens
  useEffect(() => {
    if (open && isProviderAccount && !defaultProviderId) {
      const myProvider = providers.find(p => p.user_id === effectiveUserId);
      if (myProvider) {
        import('@/lib/logger').then(({ logger }) => {
          logger.info('Auto-selecting logged-in provider');
        });
        setValue('providerId', myProvider.id);
      }
    }
  }, [open, isProviderAccount, effectiveUserId, providers, defaultProviderId, setValue]);

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

  // Fetch rooms dynamically when visit type is in-person using edge function
  const { data: fetchedRooms, isLoading: roomsLoading } = useQuery({
    queryKey: ['practice-rooms', practiceId, visitType],
    queryFn: async () => {
      console.log('[CreateAppointmentDialog] Fetching rooms via edge function');
      
      const { data, error } = await supabase.functions.invoke('get-practice-rooms', {
        body: { practiceId }
      });

      if (error) {
        console.error('[CreateAppointmentDialog] Edge function error:', error);
        throw new Error(error.message || 'Failed to fetch rooms');
      }
      
      // Filter for active rooms only
      const activeRooms = (data?.rooms || []).filter((room: any) => room.active);
      console.log('[CreateAppointmentDialog] Active rooms fetched:', activeRooms.length);
      return activeRooms;
    },
    enabled: open && visitType === 'in_person',
  });

  // Determine which rooms to display
  const displayRooms = visitType === 'in_person' 
    ? (fetchedRooms || rooms) 
    : rooms;

  const createMutation = useMutation({
    mutationFn: async (values: any) => {
      // Validate session and refresh if needed
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          throw new Error('Session expired. Please log in again.');
        }
      }

      const startDateTime = new Date(`${values.appointmentDate}T${values.startTime}`);
      const endDateTime = new Date(startDateTime.getTime() + parseInt(values.duration) * 60000);

      // Look up the selected service type to get its name
      const selectedServiceType = serviceTypes?.find(st => st.id === values.serviceType);
      const appointmentType = isWalkIn 
        ? 'walk_in' 
        : deriveAppointmentType(selectedServiceType?.name);

      const { data, error } = await supabase
        .from('patient_appointments')
        .insert({
          patient_id: selectedPatientId,
          practice_id: practiceId,
          provider_id: values.providerId || null,
          room_id: values.roomId && values.roomId !== 'none' ? values.roomId : null,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          appointment_type: appointmentType,
          visit_type: values.visitType,
          service_type: selectedServiceType?.name || null, // Store NAME not ID
          service_description: values.serviceDescription,
          notes: values.notes,
          status: isWalkIn ? 'checked_in' : 'scheduled',
          checked_in_at: isWalkIn ? new Date().toISOString() : null,
        })
        .select(`
          *,
          patient_accounts!inner(id, first_name, last_name, email, phone),
          providers!left(
            id,
            user_id,
            profiles!providers_user_id_fkey(id, name, full_name, prescriber_name, email)
          ),
          practice_rooms(id, name)
        `)
        .single();

      if (error) {
        // If 401, session expired - throw error asking user to retry
        if (error.message?.includes('401') || error.message?.includes('JWT')) {
          throw new Error('Session expired. Please try again.');
        }
        throw error;
      }

      import('@/lib/logger').then(({ logger }) => {
        logger.info('Appointment created', { 
          appointmentId: data.id,
          type: values.appointmentType,
          isWalkIn 
        });
      });
      
      // Add extra logging for walk-ins
      if (isWalkIn) {
        import('@/lib/logger').then(({ logger }) => {
          logger.info('Walk-in appointment created', {
            appointmentId: data.id,
            status: data.status
          });
        });
      }

      // Create follow-up if requested
      if (createFollowUp && data && effectiveUserId) {
        const followUpDate = new Date(startDateTime);
        followUpDate.setDate(followUpDate.getDate() + 7); // Default 1 week later
        const followUpDateStr = followUpDate.toISOString().split('T')[0];

        await supabase.from("patient_follow_ups").insert({
          patient_id: selectedPatientId,
          practice_id: values.practiceId,
          created_by: effectiveUserId,
          assigned_to: values.providerId,
          due_date: followUpDateStr,
          follow_up_date: followUpDateStr,
          follow_up_time: "09:00",
          subject: values.serviceType || values.serviceDescription || "Follow-up appointment",
          reason: values.serviceType || values.serviceDescription || "Follow-up appointment",
          notes: `Follow-up for appointment on ${values.appointmentDate}`,
          priority: "medium",
          status: "pending",
        });
      }

      return data;
    },
    onSuccess: async (data) => {
      // Invalidate ALL calendar-related queries using predicate
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = String(query.queryKey[0]);
          return key.includes('patient_appointments') || 
                 key.includes('calendar') || 
                 key.includes('waiting-room') ||
                 key.includes('being-treated') ||
                 key.includes('patient-follow-ups');
        }
      });
      
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
            .select('address_street, address_suite, address_city, address_state, address_zip')
            .eq('id', practiceId)
            .single();
          
          const title = 'Appointment Scheduled';
          
          const address = practice 
            ? [practice.address_street, practice.address_suite, practice.address_city, `${practice.address_state} ${practice.address_zip}`].filter(Boolean).join(', ')
            : '';
          const message = `Your appointment is scheduled for an in-office appointment on ${formattedDate} at ${formattedTime}${address ? ` at ${address}` : ''}.`;
          
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
                visitType: data.visit_type
              },
              entity_type: 'appointment',
              entity_id: data.id
            }
          });
          import('@/lib/logger').then(({ logger }) => {
            logger.info('Notification sent for appointment');
          });
        } catch (notifError) {
          import('@/lib/logger').then(({ logger }) => {
            logger.error('Failed to send notification', notifError);
          });
        }
      } else {
        import('@/lib/logger').then(({ logger }) => {
          logger.info('No portal access for patient; skipping notifications');
        });
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
      import('@/lib/logger').then(({ logger }) => {
        logger.error('Create appointment failed', error, {
          practiceId,
          isWalkIn,
        });
      });
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
                              <span>{getProviderDisplayName(provider)}</span>
                              {provider.type && (
                                <Badge 
                                  variant={provider.type === 'provider' ? 'default' : 'secondary'}
                                  className="ml-2 text-[10px] px-1.5 py-0"
                                >
                                  {provider.type === 'provider' ? 'Provider' : 'Staff'}
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
            <Label htmlFor="roomId">
              Room 
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
            <Label htmlFor="serviceType">Appointment Type</Label>
            <Select 
              value={watch("serviceType")} 
              onValueChange={(value) => {
                const serviceType = serviceTypes?.find(st => st.id === value);
                
                // Check if video appointment selected - show coming soon dialog
                if (serviceType?.name?.toLowerCase().includes('video')) {
                  setShowComingSoonDialog(true);
                  setValue("serviceType", "");
                  return;
                }
                
                setValue("serviceType", value);
                
                // Auto-derive visit_type based on service selection
                if (serviceType?.name?.toLowerCase().includes('video')) {
                  setValue("visitType", "video");
                } else {
                  setValue("visitType", "in_person");
                }
                
                // Set default duration if available
                if (serviceType?.typical_duration_minutes) {
                  setValue("duration", serviceType.typical_duration_minutes.toString());
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select appointment type (optional)" />
              </SelectTrigger>
              <SelectContent>
                {serviceTypes?.map((type) => {
                  const isVideo = type.name?.toLowerCase().includes('video');
                  return (
                    <SelectItem 
                      key={type.id} 
                      value={type.id}
                      disabled={isVideo}
                    >
                      <div className="flex items-center gap-2">
                        {type.name}
                        {isVideo && (
                          <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {watch("serviceType") && (
            <div className="space-y-2">
              <Label htmlFor="serviceDescription">Service Description</Label>
              <Textarea
                id="serviceDescription"
                {...register("serviceDescription")}
                rows={2}
                placeholder="Describe the specific service or treatment (optional)..."
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

      {/* Coming Soon Dialog for Video Consultations */}
      <AlertDialog open={showComingSoonDialog} onOpenChange={setShowComingSoonDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Video Consultations - Coming Soon!</AlertDialogTitle>
            <AlertDialogDescription>
              Video consultation features are currently being enhanced and will be available soon. 
              Please schedule an in-person appointment for now.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Got it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
