import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calendar, Building, Loader2, AlertCircle, CheckCircle } from "lucide-react";

interface AppointmentBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AppointmentBookingDialog({ open, onOpenChange, onSuccess }: AppointmentBookingDialogProps) {
  const [loading, setLoading] = useState(false);
  const [loadingSoonest, setLoadingSoonest] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [validationMessage, setValidationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [validating, setValidating] = useState(false);

  // Fetch patient's assigned practice
  const { data: patientAccount } = useQuery({
    queryKey: ["patient-account"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      // Check for active impersonation session
      const { data: impersonationData } = await supabase.functions.invoke('get-active-impersonation');
      const effectiveUserId = impersonationData?.session?.impersonated_user_id || user.id;
      
      console.log("👤 [AppointmentBooking] Effective user ID:", effectiveUserId);
      
      const { data, error } = await supabase
        .from("patient_accounts")
        .select("id, practice_id, profiles!patient_accounts_practice_id_fkey(name, address_city, address_state)")
        .eq("user_id", effectiveUserId)
        .maybeSingle();
      
      console.log("📋 [AppointmentBooking] Patient account:", data);
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch providers for the patient's assigned practice only
  const { data: providers } = useQuery({
    queryKey: ["practice-providers", patientAccount?.practice_id],
    queryFn: async () => {
      if (!patientAccount?.practice_id) return [];
      
      // Use existing get_practice_team_members RPC
      const { data, error } = await supabase
        .rpc('get_practice_team_members', {
          p_practice_id: patientAccount.practice_id
        });
      
      if (error) throw error;
      
      // Filter to only providers
      return (data || []).filter((member: any) => member.role_type === 'provider');
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

  const handleFindSoonestAvailability = async () => {
    setLoadingSoonest(true);
    setValidationMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke('find-soonest-availability', {
        body: { duration: 60 }
      });
      
      if (error) throw error;
      
      if (data.available) {
        setSelectedDate(data.suggestedDate);
        setSelectedTime(data.suggestedTime);
        toast.success(data.message);
        setValidationMessage({ type: 'success', text: data.message });
      } else {
        toast.error('No availability found in the next 30 days');
        setValidationMessage({ 
          type: 'error', 
          text: 'No availability found. Please contact the practice directly.' 
        });
      }
    } catch (error: any) {
      console.error('Error finding availability:', error);
      toast.error(error.message || 'Failed to find availability');
      setValidationMessage({ type: 'error', text: error.message || 'Failed to find availability' });
    } finally {
      setLoadingSoonest(false);
    }
  };

  const validateDateTime = async (date: string, time: string) => {
    if (!date || !time) return;
    
    setValidating(true);
    setValidationMessage(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('validate-appointment-time', {
        body: { appointmentDate: date, appointmentTime: time }
      });
      
      if (error) throw error;
      
      if (data.valid) {
        setValidationMessage({ type: 'success', text: 'This time slot is available!' });
      } else {
        setValidationMessage({ type: 'error', text: data.error });
      }
    } catch (error: any) {
      console.error('Validation error:', error);
      setValidationMessage({ type: 'error', text: error.message || 'Failed to validate time' });
    } finally {
      setValidating(false);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    if (newDate && selectedTime) {
      validateDateTime(newDate, selectedTime);
    } else {
      setValidationMessage(null);
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setSelectedTime(newTime);
    if (selectedDate && newTime) {
      validateDateTime(selectedDate, newTime);
    } else {
      setValidationMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!selectedDate || !selectedTime) {
      toast.error('Please select date and time');
      return;
    }
    
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const { error } = await supabase.functions.invoke("book-appointment", {
        body: {
          providerId: formData.get("provider_id") || null,
          appointmentDate: selectedDate,
          appointmentTime: selectedTime,
          reasonForVisit: formData.get("reason"),
          visitType: 'in_person',
          notes: formData.get("notes"),
        },
      });

      if (error) throw error;

      toast.success("Appointment request sent to your practice");
      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setSelectedDate('');
      setSelectedTime('');
      setValidationMessage(null);
    } catch (error: any) {
      console.error('Booking error:', error);
      toast.error(error.message || "Failed to book appointment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
            <div className="space-y-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm text-muted-foreground">Your Practice</Label>
                  <p className="font-medium text-lg">{patientAccount.profiles?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {patientAccount.profiles?.address_city}, {patientAccount.profiles?.address_state}
                  </p>
                </div>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Building className="h-3 w-3" />
                  In-Person
                </Badge>
              </div>
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
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Button 
              type="button" 
              variant="outline" 
              className="w-full"
              onClick={handleFindSoonestAvailability}
              disabled={loadingSoonest}
            >
              {loadingSoonest ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Finding availability...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4 mr-2" />
                  Find Soonest Availability
                </>
              )}
            </Button>
          </div>

          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="appointment_date">Preferred Date *</Label>
              <Input
                id="appointment_date"
                name="appointment_date"
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={selectedDate}
                onChange={handleDateChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appointment_time">Preferred Time *</Label>
              <Input
                id="appointment_time"
                name="appointment_time"
                type="time"
                value={selectedTime}
                onChange={handleTimeChange}
                required
              />
            </div>
          </div>

          {validating && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>Checking availability...</AlertDescription>
            </Alert>
          )}

          {validationMessage && !validating && (
            <Alert variant={validationMessage.type === 'error' ? 'destructive' : 'default'}>
              {validationMessage.type === 'success' ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{validationMessage.text}</AlertDescription>
            </Alert>
          )}

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
            <Button 
              type="submit" 
              disabled={loading || validating || (validationMessage?.type === 'error')}
            >
              {loading ? "Booking..." : "Request Appointment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
