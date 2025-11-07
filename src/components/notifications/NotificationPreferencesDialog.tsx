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
  { value: 'appointment_booked', label: 'New Appointments', description: 'When appointments are booked' },
  { value: 'appointment_cancelled', label: 'Appointment Cancellations', description: 'When an appointment is cancelled' },
  { value: 'system_alerts', label: 'System Alerts', description: 'Important system notifications' },
  { value: 'document_uploaded_by_patient', label: 'Documents Uploaded', description: 'When documents are uploaded' },
  { value: 'order_updates', label: 'Order Updates', description: 'Order and fulfillment updates' },
  { value: 'practice_announcements', label: 'Practice Announcements', description: 'Important practice updates' },
];

const PRACTICE_NOTIFICATION_TYPES = [
  { value: 'patient_message_received', label: 'Patient Messages', description: 'When a patient sends a message' },
  { value: 'appointment_booked', label: 'New Appointments', description: 'When appointments are booked' },
  { value: 'appointment_cancelled', label: 'Appointment Cancellations', description: 'When appointments are cancelled' },
  { value: 'system_alerts', label: 'System Alerts', description: 'Important system notifications' },
  { value: 'document_uploaded_by_patient', label: 'Documents Uploaded', description: 'When documents are uploaded' },
  { value: 'order_updates', label: 'Order Updates', description: 'Order and fulfillment updates' },
  { value: 'payment_updates', label: 'Payment Updates', description: 'Payment and billing notifications' },
  { value: 'practice_announcements', label: 'Practice Announcements', description: 'Important practice updates' },
];

const STAFF_NOTIFICATION_TYPES = [
  { value: 'patient_message_received', label: 'Patient Messages', description: 'When a patient sends a message' },
  { value: 'appointment_booked', label: 'New Appointments', description: 'When appointments are booked' },
  { value: 'appointment_cancelled', label: 'Appointment Cancellations', description: 'When an appointment is cancelled' },
  { value: 'system_alerts', label: 'System Alerts', description: 'Important system notifications' },
  { value: 'document_uploaded_by_patient', label: 'Documents Uploaded', description: 'When documents are uploaded' },
  { value: 'order_updates', label: 'Order Updates', description: 'Order and fulfillment updates' },
  { value: 'practice_announcements', label: 'Practice Announcements', description: 'Important practice updates' },
];

const PHARMACY_NOTIFICATION_TYPES = [
  { value: 'new_prescriptions', label: 'New Prescriptions', description: 'When new prescriptions are sent' },
  { value: 'prescription_status', label: 'Prescription Status Updates', description: 'When prescription status changes' },
  { value: 'patient_message_received', label: 'Patient Messages', description: 'When patients send messages' },
  { value: 'order_updates', label: 'Order Updates', description: 'Order and fulfillment updates' },
];

const TOPLINE_REP_NOTIFICATION_TYPES = [
  { value: 'new_practice_added', label: 'New Practice Added', description: 'When a new practice is added' },
  { value: 'new_downline_added', label: 'New Downline Added', description: 'When a new downline is added' },
  { value: 'commission_updates', label: 'Commission Updates', description: 'Commission and payment updates' },
  { value: 'team_activity', label: 'Team Activity', description: 'Activity from your team' },
  { value: 'support_tickets', label: 'Support Tickets', description: 'Support ticket notifications' },
];

const DOWNLINE_REP_NOTIFICATION_TYPES = [
  { value: 'new_practice_added', label: 'New Practice Added', description: 'When a new practice is added' },
  { value: 'commission_updates', label: 'Commission Updates', description: 'Commission and payment updates' },
  { value: 'team_activity', label: 'Team Activity', description: 'Activity from your team' },
  { value: 'support_tickets', label: 'Support Tickets', description: 'Support ticket notifications' },
];

const ADMIN_NOTIFICATION_TYPES = [
  { value: 'system_alerts', label: 'System Alerts', description: 'Critical system notifications' },
  { value: 'user_activity', label: 'User Activity', description: 'Important user activity alerts' },
  { value: 'security_notifications', label: 'Security Notifications', description: 'Security-related alerts' },
  { value: 'support_requests', label: 'Support Requests', description: 'User support requests' },
  { value: 'new_practice_requested', label: 'New Practice Requested', description: 'When a new practice is requested' },
  { value: 'new_downline_requested', label: 'New Downline Requested', description: 'When a new downline is requested' },
];

const getNotificationTypesForRole = (role: string) => {
  switch (role) {
    case 'patient':
      return PATIENT_NOTIFICATION_TYPES;
    case 'provider':
      return PROVIDER_NOTIFICATION_TYPES;
    case 'doctor':
      return PRACTICE_NOTIFICATION_TYPES;
    case 'staff':
      return STAFF_NOTIFICATION_TYPES;
    case 'pharmacy':
      return PHARMACY_NOTIFICATION_TYPES;
    case 'topline':
      return TOPLINE_REP_NOTIFICATION_TYPES;
    case 'downline':
      return DOWNLINE_REP_NOTIFICATION_TYPES;
    case 'admin':
      return ADMIN_NOTIFICATION_TYPES;
    default:
      return PROVIDER_NOTIFICATION_TYPES;
  }
};

export function NotificationPreferencesDialog({ open, onOpenChange }: NotificationPreferencesDialogProps) {
  const [preferences, setPreferences] = useState<Record<string, NotificationPreference>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [userPhone, setUserPhone] = useState<string | null>(null);
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

      // Get user's role from user_roles table
      // NOTE: Notification preferences are PER-USER, not per-practice
      // Each user has their own rows in notification_preferences table with unique user_id
      const { data: userRoleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      // Fallback: check if user is a patient
      const { data: patientAccount } = await supabase
        .from('patient_accounts')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      const role = userRoleData?.role || (patientAccount ? 'patient' : 'provider');
      setUserRole(role);

      // Get user's phone number from profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', user.id)
        .single();

      setUserPhone(profileData?.phone || null);

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
      const notificationTypes = getNotificationTypesForRole(role);
      notificationTypes.forEach(type => {
        if (!prefsMap[type.value]) {
          prefsMap[type.value] = {
            event_type: type.value,
            email_enabled: false,
            sms_enabled: role === 'patient',
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
    // Check if trying to enable SMS without a phone number
    if (channel === 'sms' && !preferences[type]?.sms_enabled && !userPhone) {
      toast({
        title: "Phone Number Required",
        description: "Please add a phone number to your profile to enable SMS notifications.",
        variant: "destructive",
      });
      return;
    }

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
          {!userPhone && (
            <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive font-medium">
                ⚠️ No phone number on file
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                SMS notifications are disabled until you add a phone number to your profile.
              </p>
            </div>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {getNotificationTypesForRole(userRole).map((type, index) => (
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
