import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AdminNotificationPreferencesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NotificationPreference {
  notification_type: string;
  enabled: boolean;
  label: string;
  description: string;
}

const adminNotificationTypes: NotificationPreference[] = [
  {
    notification_type: 'new_signup',
    enabled: true,
    label: 'New User Signups',
    description: 'Get notified when new users register for the platform'
  },
  {
    notification_type: 'system_error',
    enabled: true,
    label: 'System Errors',
    description: 'Critical application errors and system issues'
  },
  {
    notification_type: 'support_message',
    enabled: true,
    label: 'Support Messages',
    description: 'New messages from users requesting support'
  },
  {
    notification_type: 'security_alert',
    enabled: true,
    label: 'Security Alerts',
    description: 'Security events like brute force attempts and suspicious activity'
  },
  {
    notification_type: 'admin_action_required',
    enabled: true,
    label: 'Action Required',
    description: 'Items that need admin review or approval'
  },
];

export function AdminNotificationPreferences({ open, onOpenChange }: AdminNotificationPreferencesProps) {
  const [preferences, setPreferences] = useState<NotificationPreference[]>(adminNotificationTypes);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadPreferences();
    }
  }, [open]);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch existing preferences
      const { data, error } = await supabase
        .from('admin_notification_preferences')
        .select('notification_type, enabled')
        .eq('user_id', user.id);

      if (error) throw error;

      // Merge with defaults
      const prefsMap = new Map(data?.map(p => [p.notification_type, p.enabled]) || []);
      
      setPreferences(adminNotificationTypes.map(type => ({
        ...type,
        enabled: prefsMap.has(type.notification_type) 
          ? prefsMap.get(type.notification_type)! 
          : type.enabled
      })));
    } catch (error: any) {
      console.error('Error loading preferences:', error);
      toast({
        title: "Error",
        description: "Failed to load notification preferences",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Upsert all preferences
      const upsertData = preferences.map(pref => ({
        user_id: user.id,
        notification_type: pref.notification_type,
        enabled: pref.enabled,
      }));

      const { error } = await supabase
        .from('admin_notification_preferences')
        .upsert(upsertData, { 
          onConflict: 'user_id,notification_type',
          ignoreDuplicates: false 
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Notification preferences saved",
      });
      
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving preferences:', error);
      toast({
        title: "Error",
        description: "Failed to save preferences",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const togglePreference = (notificationType: string) => {
    setPreferences(prefs =>
      prefs.map(pref =>
        pref.notification_type === notificationType
          ? { ...pref, enabled: !pref.enabled }
          : pref
      )
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Admin Notification Preferences</DialogTitle>
          <DialogDescription>
            Customize which types of admin notifications you want to receive
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {preferences.map((pref) => (
              <div
                key={pref.notification_type}
                className="flex items-start justify-between space-x-4 rounded-lg border p-4"
              >
                <div className="flex-1 space-y-1">
                  <Label
                    htmlFor={pref.notification_type}
                    className="text-base font-medium cursor-pointer"
                  >
                    {pref.label}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {pref.description}
                  </p>
                </div>
                <Switch
                  id={pref.notification_type}
                  checked={pref.enabled}
                  onCheckedChange={() => togglePreference(pref.notification_type)}
                />
              </div>
            ))}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={savePreferences} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Preferences
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
