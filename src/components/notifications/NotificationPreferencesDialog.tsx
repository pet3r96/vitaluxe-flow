import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface NotificationPreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NotificationPreference {
  event_type: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  in_app_enabled: boolean;
}

const PATIENT_NOTIFICATION_TYPES = [
  { value: 'practice_message_received', label: 'Practice Messages', description: 'When your practice sends you a message' },
  { value: 'appointment_confirmed', label: 'Appointment Confirmations', description: 'When your appointment is confirmed' },
  { value: 'appointment_rescheduled', label: 'Appointment Changes', description: 'When your appointment is rescheduled' },
  { value: 'appointment_cancelled', label: 'Appointment Cancellations', description: 'When an appointment is cancelled' },
  { value: 'document_assigned', label: 'New Documents', description: 'When documents are shared with you' },
];

const PROVIDER_NOTIFICATION_TYPES = [
  { value: 'patient_message_received', label: 'Patient Messages', description: 'When a patient sends you a message' },
  { value: 'appointment_booked', label: 'Appointments Booked', description: 'When a patient books an appointment' },
  { value: 'appointment_cancelled', label: 'Appointments Cancelled', description: 'When an appointment is cancelled' },
  { value: 'document_uploaded_by_patient', label: 'Documents Uploaded', description: 'When a patient uploads a document' },
];

export function NotificationPreferencesDialog({ open, onOpenChange }: NotificationPreferencesDialogProps) {
  const [preferences, setPreferences] = useState<Record<string, NotificationPreference>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchPreferences();
    }
  }, [open]);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user is a patient (check patient_accounts table)
      // NOTE: Notification preferences are PER-USER, not per-practice
      // Each user has their own rows in notification_preferences table with unique user_id
      const { data: patientAccount } = await supabase
        .from('patient_accounts')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      const isPatient = !!patientAccount;
      setUserRole(isPatient ? 'patient' : 'provider');

      // Fetch this user's notification preferences (scoped to user_id)
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      const prefsMap: Record<string, NotificationPreference> = {};
      data?.forEach((pref: any) => {
        prefsMap[pref.event_type] = {
          event_type: pref.event_type,
          email_enabled: pref.email_enabled,
          sms_enabled: pref.sms_enabled,
          in_app_enabled: pref.in_app_enabled ?? true,
        };
      });

      // Set defaults for missing types based on user role
      const notificationTypes = isPatient ? PATIENT_NOTIFICATION_TYPES : PROVIDER_NOTIFICATION_TYPES;
      notificationTypes.forEach(type => {
        if (!prefsMap[type.value]) {
          prefsMap[type.value] = {
            event_type: type.value,
            email_enabled: true,
            sms_enabled: false,
            in_app_enabled: true,
          };
        }
      });

      setPreferences(prefsMap);
    } catch (error) {
      console.error('Error fetching preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to load notification preferences',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Upsert all preferences
      const prefsArray = Object.values(preferences).map(pref => ({
        user_id: user.id,
        event_type: pref.event_type,
        email_enabled: pref.email_enabled,
        sms_enabled: pref.sms_enabled,
        in_app_enabled: pref.in_app_enabled,
      }));

      const { error } = await supabase
        .from('notification_preferences')
        .upsert(prefsArray, { onConflict: 'user_id,event_type' });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Notification preferences saved',
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to save preferences',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const togglePreference = (type: string, channel: 'email' | 'sms' | 'in_app') => {
    setPreferences(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [`${channel}_enabled`]: !prev[type]?.[`${channel}_enabled`],
      },
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Notification Preferences</DialogTitle>
          <DialogDescription>
            Choose how you want to receive notifications
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {(userRole === 'patient' ? PATIENT_NOTIFICATION_TYPES : PROVIDER_NOTIFICATION_TYPES).map((type, index) => (
              <div key={type.value}>
                {index > 0 && <Separator className="my-4" />}
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium">{type.label}</h4>
                    <p className="text-sm text-muted-foreground">{type.description}</p>
                  </div>
                  <div className="flex items-center justify-between pl-4">
                    <Label htmlFor={`${type.value}-email`} className="text-sm">Email</Label>
                    <Switch
                      id={`${type.value}-email`}
                      checked={preferences[type.value]?.email_enabled || false}
                      onCheckedChange={() => togglePreference(type.value, 'email')}
                    />
                  </div>
                  <div className="flex items-center justify-between pl-4">
                    <Label htmlFor={`${type.value}-sms`} className="text-sm">SMS</Label>
                    <Switch
                      id={`${type.value}-sms`}
                      checked={preferences[type.value]?.sms_enabled || false}
                      onCheckedChange={() => togglePreference(type.value, 'sms')}
                    />
                  </div>
                  <div className="flex items-center justify-between pl-4">
                    <Label htmlFor={`${type.value}-in-app`} className="text-sm">In-app</Label>
                    <Switch
                      id={`${type.value}-in-app`}
                      checked={preferences[type.value]?.in_app_enabled ?? true}
                      onCheckedChange={() => togglePreference(type.value, 'in_app')}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Preferences'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
