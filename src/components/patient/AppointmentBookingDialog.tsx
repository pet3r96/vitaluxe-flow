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
  const [selectedPractice, setSelectedPractice] = useState("");

  const { data: practices } = useQuery({
    queryKey: ["available-practices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, address_city, address_state")
        .in("id", (await supabase.from("user_roles").select("user_id").eq("role", "doctor")).data?.map(r => r.user_id) || []);
      if (error) throw error;
      return data;
    },
  });

  const { data: providers } = useQuery({
    queryKey: ["practice-providers", selectedPractice],
    queryFn: async () => {
      if (!selectedPractice) return [];
      const { data, error } = await supabase
        .from("providers")
        .select("user_id, profiles!providers_user_id_fkey(name)")
        .eq("practice_id", selectedPractice);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedPractice,
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const { error } = await supabase.functions.invoke("book-appointment", {
        body: {
          practiceId: formData.get("practice_id"),
          providerId: formData.get("provider_id") || null,
          appointmentDate: formData.get("appointment_date"),
          appointmentTime: formData.get("appointment_time"),
          reasonForVisit: formData.get("reason"),
          notes: formData.get("notes"),
        },
      });

      if (error) throw error;

      toast.success("Appointment request sent successfully");
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
          <div className="space-y-2">
            <Label htmlFor="practice_id">Select Practice *</Label>
            <Select
              name="practice_id"
              value={selectedPractice}
              onValueChange={setSelectedPractice}
              required
            >
              <SelectTrigger id="practice_id">
                <SelectValue placeholder="Choose a practice" />
              </SelectTrigger>
              <SelectContent>
                {practices?.map((practice: any) => (
                  <SelectItem key={practice.id} value={practice.id}>
                    {practice.name} - {practice.address_city}, {practice.address_state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPractice && providers && providers.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="provider_id">Select Provider (Optional)</Label>
              <Select name="provider_id">
                <SelectTrigger id="provider_id">
                  <SelectValue placeholder="Any provider" />
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
            <Input
              id="reason"
              name="reason"
              placeholder="e.g., Annual checkup, Follow-up"
              required
            />
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
