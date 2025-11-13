import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { AlertCircle, Calendar as CalendarIcon, Clock } from "lucide-react";
import { format, addHours, addDays, addWeeks } from "date-fns";

interface BlockTimeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  practiceId: string;
  providers: any[];
  isProviderAccount: boolean;
  defaultProviderId?: string;
  onSuccess: () => void;
}

export const BlockTimeDialog = ({
  open,
  onOpenChange,
  practiceId,
  providers,
  isProviderAccount,
  defaultProviderId,
  onSuccess
}: BlockTimeDialogProps) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [acknowledgedConflicts, setAcknowledgedConflicts] = useState(false);

  const [formData, setFormData] = useState({
    blockType: isProviderAccount ? 'provider_unavailable' : '',
    providerId: defaultProviderId || '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    startTime: format(new Date(), 'HH:mm'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    endTime: format(addHours(new Date(), 1), 'HH:mm'),
    reason: '',
    notes: ''
  });

  const reasons = [
    'Vacation',
    'Sick Leave',
    'Training',
    'Holiday',
    'Maintenance',
    'Personal',
    'Other'
  ];

  const applyPreset = (preset: string) => {
    const now = new Date();
    let endDate = new Date();
    let endTime = format(now, 'HH:mm');

    switch (preset) {
      case '1hour':
        endDate = addHours(now, 1);
        endTime = format(endDate, 'HH:mm');
        break;
      case 'restofday':
        endDate = now;
        endTime = '17:00';
        break;
      case '1day':
        endDate = addDays(now, 1);
        break;
      case '1week':
        endDate = addWeeks(now, 1);
        break;
      case '2weeks':
        endDate = addWeeks(now, 2);
        break;
    }

    setFormData({
      ...formData,
      endDate: format(endDate, 'yyyy-MM-dd'),
      endTime
    });
  };

  const checkConflicts = async () => {
    try {
      const startDateTime = `${formData.startDate}T${formData.startTime}:00`;
      const endDateTime = `${formData.endDate}T${formData.endTime}:00`;

      const { data, error } = await supabase.rpc('get_appointments_during_blocked_time', {
        p_practice_id: practiceId,
        p_provider_id: formData.blockType === 'provider_unavailable' ? formData.providerId : null,
        p_start_time: startDateTime,
        p_end_time: endDateTime
      });

      if (error) {
        console.error('Error checking conflicts:', error);
        throw error;
      }

      setConflicts(data || []);
      return data || [];
    } catch (error: any) {
      console.error('Conflict check failed:', error);
      toast.error('Failed to check for conflicts: ' + (error.message || 'Unknown error'));
      throw error;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const startDateTime = `${formData.startDate}T${formData.startTime}:00`;
      const endDateTime = `${formData.endDate}T${formData.endTime}:00`;

      const { data, error } = await supabase.functions.invoke('create-blocked-time', {
        body: {
          practiceId,
          blockType: formData.blockType,
          providerId: formData.blockType === 'provider_unavailable' ? formData.providerId : null,
          startTime: startDateTime,
          endTime: endDateTime,
          reason: formData.reason,
          notes: formData.notes
        }
      });

      if (error) throw error;

      toast.success('Time blocked successfully');
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Failed to block time');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setConflicts([]);
    setAcknowledgedConflicts(false);
    setFormData({
      blockType: isProviderAccount ? 'provider_unavailable' : '',
      providerId: defaultProviderId || '',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      startTime: format(new Date(), 'HH:mm'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
      endTime: format(addHours(new Date(), 1), 'HH:mm'),
      reason: '',
      notes: ''
    });
  };

  const handleNext = async () => {
    if (step === 3) {
      try {
        setLoading(true);
        await checkConflicts();
        setLoading(false);
        // Always proceed to confirmation step; do not submit yet
        setStep(4);
      } catch (error) {
        setLoading(false);
      }
    } else {
      setStep(step + 1);
    }
  };

  const canProceed = () => {
    if (step === 1) return !!formData.blockType;
    if (step === 2 && formData.blockType === 'provider_unavailable') return !!formData.providerId;
    if (step === 3) return !!formData.reason;
    if (step === 4) return conflicts.length === 0 || acknowledgedConflicts;
    return true;
  };

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Block Time</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step 1: Block Type */}
          {step >= 1 && (
            <div className="space-y-3">
              <Label>What would you like to block?</Label>
              {!isProviderAccount ? (
                <Select 
                  value={formData.blockType} 
                  onValueChange={(value) => setFormData({ ...formData, blockType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select block type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="practice_closure">Whole Practice</SelectItem>
                    <SelectItem value="provider_unavailable">Specific Provider</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-3 bg-muted rounded-md">
                  <Badge>My Availability Only</Badge>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Provider Selection */}
          {step >= 2 && formData.blockType === 'provider_unavailable' && !isProviderAccount && (
            <div className="space-y-3">
              <Label>Select Provider</Label>
              <Select 
                value={formData.providerId} 
                onValueChange={(value) => setFormData({ ...formData, providerId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Step 2/3: Date/Time Selection */}
          {step >= 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => applyPreset('1hour')}>1 Hour</Button>
                <Button size="sm" variant="outline" onClick={() => applyPreset('restofday')}>Rest of Day</Button>
                <Button size="sm" variant="outline" onClick={() => applyPreset('1day')}>1 Day</Button>
                <Button size="sm" variant="outline" onClick={() => applyPreset('1week')}>1 Week</Button>
                <Button size="sm" variant="outline" onClick={() => applyPreset('2weeks')}>2 Weeks</Button>
              </div>
            </div>
          )}

          {/* Step 3: Reason & Notes */}
          {step >= 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Reason *</Label>
                <Select 
                  value={formData.reason} 
                  onValueChange={(value) => setFormData({ ...formData, reason: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {reasons.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {reason}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Additional details..."
                />
              </div>
            </div>
          )}

          {/* Step 4: Conflicts Warning or Confirmation */}
          {step === 4 && (
            <Alert variant={conflicts.length > 0 ? "destructive" : "default"}>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>
                {conflicts.length > 0 ? `Conflicting Appointments Found` : `No Conflicts Found`}
              </AlertTitle>
              <AlertDescription>
                {conflicts.length > 0 ? (
                  <>
                    <p className="mb-3">You have {conflicts.length} appointment(s) scheduled during this time:</p>
                    <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                      {conflicts.map((appt) => (
                        <div key={appt.appointment_id} className="p-2 bg-background rounded text-sm">
                          <div className="font-medium">{appt.patient_name}</div>
                          <div className="text-muted-foreground text-xs">
                            {format(new Date(appt.start_time), 'MMM d, h:mm a')} - {format(new Date(appt.end_time), 'h:mm a')}
                            {appt.provider_name && ` • ${appt.provider_name}`}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="acknowledge"
                        checked={acknowledgedConflicts}
                        onCheckedChange={(checked) => setAcknowledgedConflicts(checked as boolean)}
                      />
                      <label htmlFor="acknowledge" className="text-sm font-medium cursor-pointer">
                        I understand and will reschedule these appointments
                      </label>
                    </div>
                  </>
                ) : (
                  <p>✓ No appointments conflict with this blocked time. You can proceed to block the time.</p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                if (step > 1) setStep(step - 1);
                else onOpenChange(false);
              }}
              disabled={loading}
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </Button>
            
            <Button
              onClick={step === 4 ? handleSubmit : handleNext}
              disabled={!canProceed() || loading}
            >
              {loading ? 'Processing...' : step === 4 ? (conflicts.length > 0 ? 'Block Time Anyway' : 'Confirm & Block Time') : step === 3 ? 'Check Conflicts' : 'Next'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
