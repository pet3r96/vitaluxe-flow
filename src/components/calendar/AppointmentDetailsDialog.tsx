import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Clock, User, MapPin, Phone, Mail, FileText, CalendarClock, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { RescheduleAppointmentDialog } from "./RescheduleAppointmentDialog";
import { CreateFollowUpFromAppointmentDialog } from "./CreateFollowUpFromAppointmentDialog";

interface AppointmentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: any;
  providers: any[];
  rooms: any[];
}

const statusOptions = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'checked_in', label: 'Checked In' },
  { value: 'being_treated', label: 'Being Treated' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No Show' },
];

export function AppointmentDetailsDialog({
  open,
  onOpenChange,
  appointment,
  providers,
  rooms,
}: AppointmentDetailsDialogProps) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(appointment?.status);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);

  // Sync status with appointment prop
  useEffect(() => {
    if (appointment?.status) {
      setStatus(appointment.status);
    }
  }, [appointment?.status]);

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const updateData: any = { status: newStatus, updated_at: new Date().toISOString() };
      
      // Set timestamps based on status
      if (newStatus === "checked_in") {
        updateData.checked_in_at = new Date().toISOString();
      } else if (newStatus === "being_treated") {
        updateData.treatment_started_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('patient_appointments')
        .update(updateData)
        .eq('id', appointment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-data'] });
      queryClient.invalidateQueries({ queryKey: ['waiting-room'] });
      toast.success("Appointment status updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update status");
      setStatus(appointment?.status);
    },
  });

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("patient_appointments")
        .update({
          status: "checked_in",
          checked_in_at: new Date().toISOString(),
        })
        .eq("id", appointment.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-data"] });
      queryClient.invalidateQueries({ queryKey: ["waiting-room"] });
      toast.success("Patient checked in and added to waiting room");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to check in patient");
    },
  });

  const startTreatmentMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("patient_appointments")
        .update({
          status: "being_treated",
          treatment_started_at: new Date().toISOString(),
        })
        .eq("id", appointment.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-data"] });
      queryClient.invalidateQueries({ queryKey: ["waiting-room"] });
      toast.success("Treatment started");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to start treatment");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('patient_appointments')
        .delete()
        .eq('id', appointment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-data'] });
      toast.success("Appointment deleted");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete appointment");
    },
  });

  if (!appointment) return null;

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    updateStatusMutation.mutate(newStatus);
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this appointment?")) {
      deleteMutation.mutate();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Patient Info */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Patient Information</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {appointment.patient_accounts?.first_name}{' '}
                    {appointment.patient_accounts?.last_name}
                  </span>
                </div>
                {appointment.patient_accounts?.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{appointment.patient_accounts.phone}</span>
                  </div>
                )}
                {appointment.patient_accounts?.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{appointment.patient_accounts.email}</span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Appointment Details */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Appointment Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div className="text-sm">
                    <div className="font-medium">
                      {format(new Date(appointment.start_time), 'EEEE, MMMM d, yyyy')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div className="text-sm">
                    <div className="font-medium">
                      {format(new Date(appointment.start_time), 'h:mm a')} -{' '}
                      {format(new Date(appointment.end_time), 'h:mm a')}
                    </div>
                    <div className="text-muted-foreground">
                      {Math.max(1, Math.round((new Date(appointment.end_time).getTime() - new Date(appointment.start_time).getTime()) / 60000))} minutes
                    </div>
                  </div>
                </div>

                {appointment.providers && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm">
                      <div className="font-medium">
                        {appointment.providers.first_name} {appointment.providers.last_name}
                      </div>
                      {appointment.providers.specialty && (
                        <div className="text-muted-foreground">{appointment.providers.specialty}</div>
                      )}
                    </div>
                  </div>
                )}

                {appointment.practice_rooms && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm">
                      <div className="font-medium">{appointment.practice_rooms.name}</div>
                    </div>
                  </div>
                )}

                {appointment.appointment_type && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm">
                      <Badge variant="outline" className="capitalize">
                        {appointment.appointment_type}
                      </Badge>
                    </div>
                  </div>
                )}

                {appointment.service_type && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm">
                      <div className="text-muted-foreground text-xs">Service Type</div>
                      <div className="font-medium">{appointment.service_type}</div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Select value={status} onValueChange={handleStatusChange}>
                    <SelectTrigger className="w-[140px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {appointment.notes && (
              <>
                <Separator />
                <div>
                  <h3 className="text-lg font-semibold mb-2">Notes</h3>
                  <p className="text-sm bg-muted p-3 rounded">{appointment.notes}</p>
                </div>
              </>
            )}

            {appointment.service_description && (
              <>
                <Separator />
                <div>
                  <h3 className="text-lg font-semibold mb-2">Service Description</h3>
                  <p className="text-sm bg-muted p-3 rounded">{appointment.service_description}</p>
                </div>
              </>
            )}

            <Separator />

            {/* Actions */}
            <div className="flex justify-between flex-wrap gap-2">
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                Delete Appointment
              </Button>
              <div className="flex gap-2 flex-wrap">
                {(status === "scheduled" || status === "confirmed") && (
                  <Button
                    onClick={() => checkInMutation.mutate()}
                    disabled={checkInMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {checkInMutation.isPending ? "Checking In..." : "Check In"}
                  </Button>
                )}
                
                {status === "checked_in" && (
                  <Button
                    onClick={() => startTreatmentMutation.mutate()}
                    disabled={startTreatmentMutation.isPending}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {startTreatmentMutation.isPending ? "Starting..." : "Start Treatment"}
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() => setFollowUpOpen(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Follow-Up
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => setRescheduleOpen(true)}
                >
                  <CalendarClock className="h-4 w-4 mr-2" />
                  Reschedule
                </Button>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <RescheduleAppointmentDialog
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        appointment={appointment}
        providers={providers}
        rooms={rooms}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['calendar-data'] });
          onOpenChange(false);
        }}
      />
      
      <CreateFollowUpFromAppointmentDialog
        open={followUpOpen}
        onOpenChange={setFollowUpOpen}
        appointment={appointment}
      />
    </>
  );
}
