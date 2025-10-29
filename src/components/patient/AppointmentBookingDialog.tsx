import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calendar } from "lucide-react";

interface AppointmentBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AppointmentBookingDialog({ open, onOpenChange, onSuccess }: AppointmentBookingDialogProps) {
  const [loading, setLoading] = useState(false);

  // Fetch patient's assigned practice
  const { data: patientAccount } = useQuery({
    queryKey: ["patient-account"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from("patient_accounts")
        .select("id, practice_id, profiles!patient_accounts_practice_id_fkey(name, address_city, address_state)")
        .eq("user_id", user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch providers for the patient's assigned practice only
  const { data: providers } = useQuery({
    queryKey: ["practice-providers", patientAccount?.practice_id],
    queryFn: async () => {
      if (!patientAccount?.practice_id) return [];
      const { data, error } = await supabase
        .from("providers")
        .select("user_id, profiles!providers_user_id_fkey(name)")
        .eq("practice_id", patientAccount.practice_id);
      if (error) throw error;
      return data;
    },
    enabled: !!patientAccount?.practice_id,
  });

  const commonReasons = [
    'Annual checkup',
    'Follow-up visit',
    'New patient consultation',
    'Specific concern',
    'Medication review',
    'Lab results review',
    'Other'
  ];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const { error } = await supabase.functions.invoke("book-appointment", {
        body: {
          providerId: formData.get("provider_id") || null,
          appointmentDate: formData.get("appointment_date"),
          appointmentTime: formData.get("appointment_time"),
          reasonForVisit: formData.get("reason"),
          visitType: formData.get("visit_type"),
          notes: formData.get("notes"),
        },
      });

      if (error) throw error;

      toast.success("Appointment request sent to your practice");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to book appointment");
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
            Book Appointment
          </DialogTitle>
          <DialogDescription>
            Request an appointment with your healthcare provider
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {patientAccount && (
            <div className="space-y-2 p-3 bg-muted rounded-lg">
              <Label className="text-sm text-muted-foreground">Your Practice</Label>
              <p className="font-medium">{patientAccount.profiles?.name}</p>
              <p className="text-sm text-muted-foreground">
                {patientAccount.profiles?.address_city}, {patientAccount.profiles?.address_state}
              </p>
            </div>
          )}

          {providers && providers.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="provider_id">Select Provider (Optional)</Label>
              <Select name="provider_id">
                <SelectTrigger id="provider_id">
                  <SelectValue placeholder="Any available provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider: any) => (
                    <SelectItem key={provider.user_id} value={provider.user_id}>
                      {provider.profiles?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="visit_type">Visit Type *</Label>
            <Select name="visit_type" defaultValue="in_person" required>
              <SelectTrigger id="visit_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_person">In-Person</SelectItem>
                <SelectItem value="virtual">Virtual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="appointment_date">Preferred Date *</Label>
              <Input
                id="appointment_date"
                name="appointment_date"
                type="date"
                min={new Date().toISOString().split("T")[0]}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appointment_time">Preferred Time *</Label>
              <Input
                id="appointment_time"
                name="appointment_time"
                type="time"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Visit *</Label>
            <Select name="reason" required>
              <SelectTrigger id="reason">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {commonReasons.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Any specific concerns or information..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Booking..." : "Request Appointment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
