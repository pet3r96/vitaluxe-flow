import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, Calendar, Clock, User, AlertTriangle, Edit2, FolderOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, parse } from "date-fns";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AppointmentRequestReviewDialogProps {
  appointment: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const AppointmentRequestReviewDialog = ({
  appointment,
  open,
  onOpenChange,
  onSuccess,
}: AppointmentRequestReviewDialogProps) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDate, setEditedDate] = useState("");
  const [editedTime, setEditedTime] = useState("");

  const patientName = appointment.patient_accounts?.profiles?.full_name || 
                     appointment.patient_accounts?.profiles?.name || 
                     'Unknown Patient';
  const providerName = appointment.providers?.profiles?.full_name || 
                      appointment.providers?.profiles?.name || 
                      'Not specified';
  const isReschedule = !!appointment.reschedule_requested_at;

  // Initialize edit fields with requested or current values
  useEffect(() => {
    if (appointment) {
      // Safe handling of requested_date
      let requestedDate = appointment.requested_date;
      if (!requestedDate && appointment.start_time) {
        try {
          requestedDate = format(new Date(appointment.start_time), 'yyyy-MM-dd');
        } catch {
          requestedDate = format(new Date(), 'yyyy-MM-dd');
        }
      }
      
      // Safe handling of requested_time (stored as TIME in DB, e.g. '09:00:00')
      let requestedTime = appointment.requested_time;
      if (requestedTime) {
        // Trim seconds if present: '09:00:00' -> '09:00'
        requestedTime = requestedTime.substring(0, 5);
      } else if (appointment.start_time) {
        try {
          requestedTime = format(new Date(appointment.start_time), 'HH:mm');
        } catch {
          requestedTime = '09:00';
        }
      } else {
        requestedTime = '09:00';
      }
      
      setEditedDate(requestedDate || format(new Date(), 'yyyy-MM-dd'));
      setEditedTime(requestedTime);
    }
  }, [appointment]);

  const checkConflicts = async (startTime: Date, endTime: Date) => {
    const { data } = await supabase
      .from('patient_appointments')
      .select('id, start_time, end_time, patient_accounts(profiles(full_name, name))')
      .eq('practice_id', appointment.practice_id)
      .not('status', 'in', '(cancelled,no_show)')
      .neq('id', appointment.id)
      .lt('start_time', endTime.toISOString())
      .gt('end_time', startTime.toISOString());

    setConflicts(data || []);
    return (data || []).length > 0;
  };

  const handleAccept = async () => {
    if (!appointment) return;

    try {
      setIsAccepting(true);

      // Validate inputs
      if (!editedDate || !editedTime) {
        toast({
          title: "Invalid Input",
          description: "Please provide a valid date and time.",
          variant: "destructive",
        });
        return;
      }

      // Calculate new start and end times with validation
      const timeMatch = editedTime.match(/^(\d{1,2}):(\d{2})$/);
      if (!timeMatch) {
        toast({
          title: "Invalid Time Format",
          description: "Please use HH:MM format (e.g., 09:00).",
          variant: "destructive",
        });
        return;
      }

      const [hours, minutes] = timeMatch.slice(1).map(Number);
      const newStartTime = new Date(editedDate);
      newStartTime.setHours(hours, minutes, 0, 0);
      
      if (isNaN(newStartTime.getTime())) {
        toast({
          title: "Invalid Date",
          description: "Please provide a valid date.",
          variant: "destructive",
        });
        return;
      }
      
      const newEndTime = new Date(newStartTime);
      newEndTime.setMinutes(newEndTime.getMinutes() + 30);

      // Check for conflicts with the new time
      const hasConflicts = await checkConflicts(newStartTime, newEndTime);
      if (hasConflicts) {
        toast({
          title: "Conflict Detected",
          description: "There are conflicting appointments. Please resolve them first.",
          variant: "destructive",
        });
        setIsAccepting(false);
        return;
      }

      // Always update the appointment directly with the edited times
      const { error } = await supabase
        .from('patient_appointments')
        .update({
          start_time: newStartTime.toISOString(),
          end_time: newEndTime.toISOString(),
          confirmation_type: 'confirmed',
          status: 'scheduled',
          requested_date: null,
          requested_time: null,
          reschedule_reason: null,
          reschedule_requested_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', appointment.id);

      if (error) throw error;

      toast({
        title: "Appointment Confirmed",
        description: `${patientName}'s appointment has been confirmed for ${format(newStartTime, 'MMMM d, yyyy at h:mm a')}.`,
      });

      // Immediately invalidate all appointment-related queries for instant UI update
      queryClient.invalidateQueries({ queryKey: ['requested-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-data'] });
      queryClient.invalidateQueries({ queryKey: ['patient_appointments'] });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!declineReason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for declining this request.",
        variant: "destructive",
      });
      return;
    }

    setIsDeclining(true);
    try {
      const { error } = await supabase
        .from('patient_appointments')
        .update({
          status: 'cancelled',
          notes: `Declined: ${declineReason}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', appointment.id);

      if (error) throw error;

      toast({
        title: "Appointment Declined",
        description: "The patient will be notified.",
      });

      // Immediately invalidate all appointment-related queries for instant UI update
      queryClient.invalidateQueries({ queryKey: ['requested-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-data'] });
      queryClient.invalidateQueries({ queryKey: ['patient_appointments'] });

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeclining(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {isReschedule ? 'Reschedule Request' : 'New Appointment Request'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Patient Information */}
          <div className="p-4 bg-accent/50 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Patient</span>
              </div>
              {appointment.patient_id && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigate(`/patients/${appointment.patient_id}`);
                    onOpenChange(false);
                  }}
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  View Patient File
                </Button>
              )}
            </div>
            <p className="text-lg font-semibold">{patientName}</p>
          </div>

          {/* Requested Time - Editable */}
          <div className="p-4 bg-accent/30 rounded-lg space-y-3 border border-border">
            <h3 className="font-semibold text-foreground">
              {isReschedule ? 'Requested New Time' : 'Requested Time'}
            </h3>
            
            {!isEditing ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-foreground text-lg">
                    {editedDate && editedTime && !isNaN(new Date(`${editedDate}T${editedTime}`).getTime())
                      ? format(new Date(`${editedDate}T${editedTime}`), 'EEEE, MMMM d, yyyy')
                      : 'Date TBD'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-foreground text-lg">
                    {editedDate && editedTime && !isNaN(new Date(`${editedDate}T${editedTime}`).getTime())
                      ? format(new Date(`${editedDate}T${editedTime}`), 'h:mm a')
                      : '--:--'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="edit-date" className="text-sm font-medium">Date</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editedDate}
                    onChange={(e) => setEditedDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-time" className="text-sm font-medium">Time</Label>
                  <Input
                    id="edit-time"
                    type="time"
                    value={editedTime}
                    onChange={(e) => setEditedTime(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <Button
                  onClick={() => setIsEditing(false)}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  Done Editing
                </Button>
              </div>
            )}
          </div>

          {/* Provider */}
          <div>
            <Label className="text-sm text-muted-foreground">Provider</Label>
            <p className="font-medium mt-1">{providerName}</p>
          </div>

          {/* Reason for Visit */}
          <div>
            <Label className="text-sm text-muted-foreground">Reason for Visit</Label>
            <p className="mt-1">{appointment.reason_for_visit}</p>
          </div>

          {/* Reschedule Reason */}
          {isReschedule && appointment.reschedule_reason && (
            <div>
              <Label className="text-sm text-muted-foreground">Reason for Reschedule</Label>
              <p className="mt-1 p-3 bg-gold1/10 rounded border border-gold1/30">
                {appointment.reschedule_reason}
              </p>
            </div>
          )}

          {/* Conflicts Warning */}
          {conflicts.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Conflict Detected:</strong> There {conflicts.length === 1 ? 'is' : 'are'} {conflicts.length} overlapping appointment{conflicts.length > 1 ? 's' : ''} at this time.
              </AlertDescription>
            </Alert>
          )}

          {/* Decline Reason */}
          {isDeclining && (
            <div className="space-y-2">
              <Label htmlFor="decline-reason">Reason for Declining *</Label>
              <Textarea
                id="decline-reason"
                placeholder="Please provide a reason for declining this request..."
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            {!isDeclining ? (
              <>
                <Button
                  onClick={handleAccept}
                  disabled={isAccepting || isEditing}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {isAccepting ? "Approving..." : "Approve Request"}
                </Button>
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="outline"
                  disabled={isEditing}
                  className="flex-1"
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Choose New Time
                </Button>
                <Button
                  onClick={() => setIsDeclining(true)}
                  variant="destructive"
                  className="flex-1"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Decline
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() => setIsDeclining(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDecline}
                  disabled={!declineReason.trim() || isDeclining}
                  variant="destructive"
                  className="flex-1"
                >
                  {isDeclining ? "Declining..." : "Confirm Decline"}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
