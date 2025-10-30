import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Calendar, Clock, User, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [conflicts, setConflicts] = useState<any[]>([]);

  const patientName = appointment.patient_accounts?.profiles?.full_name || 
                     appointment.patient_accounts?.profiles?.name || 
                     'Unknown Patient';
  const providerName = appointment.providers?.profiles?.full_name || 
                      appointment.providers?.profiles?.name || 
                      'Not specified';
  const isReschedule = !!appointment.reschedule_requested_at;

  const checkConflicts = async () => {
    const startTime = new Date(appointment.start_time);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // +1 hour

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
    setIsAccepting(true);
    try {
      const hasConflicts = await checkConflicts();
      if (hasConflicts) {
        toast({
          title: "Conflict Detected",
          description: "There are conflicting appointments. Please resolve them first.",
          variant: "destructive",
        });
        setIsAccepting(false);
        return;
      }

      const { error } = await supabase
        .from('patient_appointments')
        .update({
          confirmation_type: 'confirmed',
          status: 'scheduled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', appointment.id);

      if (error) throw error;

      toast({
        title: "Appointment Confirmed",
        description: `${patientName}'s appointment has been confirmed.`,
      });

      onSuccess();
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
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Patient</span>
            </div>
            <p className="text-lg font-semibold">{patientName}</p>
          </div>

          {/* Requested Time */}
          <div className="p-4 border border-border rounded-lg space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground">
              {isReschedule ? 'New Requested Time' : 'Requested Time'}
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="font-medium">
                  {format(new Date(appointment.requested_date || appointment.start_time), 'EEEE, MMMM d, yyyy')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="font-medium">
                  {appointment.requested_time || format(new Date(appointment.start_time), 'h:mm a')}
                </span>
              </div>
            </div>
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
              <p className="mt-1 p-3 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-800">
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
                  disabled={isAccepting}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {isAccepting ? "Confirming..." : "Accept"}
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
