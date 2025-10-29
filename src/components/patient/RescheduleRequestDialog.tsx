import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar } from "lucide-react";

interface RescheduleRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: any;
  onSuccess: () => void;
}

export function RescheduleRequestDialog({ 
  open, 
  onOpenChange, 
  appointment,
  onSuccess 
}: RescheduleRequestDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const { error } = await supabase.functions.invoke("reschedule-appointment-request", {
        body: {
          appointmentId: appointment.id,
          newDate: formData.get("new_date"),
          newTime: formData.get("new_time"),
          reason: formData.get("reason"),
        },
      });

      if (error) throw error;

      toast.success("Reschedule request sent to practice");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to request reschedule");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Request Reschedule
          </DialogTitle>
          <DialogDescription>
            Request a new time for your appointment. The practice will review and confirm.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new_date">Preferred Date *</Label>
              <Input
                id="new_date"
                name="new_date"
                type="date"
                min={new Date().toISOString().split("T")[0]}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_time">Preferred Time *</Label>
              <Input
                id="new_time"
                name="new_time"
                type="time"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Reschedule</Label>
            <Textarea
              id="reason"
              name="reason"
              placeholder="Optional: Why do you need to reschedule?"
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Sending..." : "Request Reschedule"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
