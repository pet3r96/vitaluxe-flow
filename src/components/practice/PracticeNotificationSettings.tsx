import { useState } from "react";
import { AlertCircle, Bell, Mail, MessageSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePracticeNotificationSettings } from "@/hooks/usePracticeNotificationSettings";

interface PracticeNotificationSettingsProps {
  practiceId: string;
}

export function PracticeNotificationSettings({ practiceId }: PracticeNotificationSettingsProps) {
  const { settings, isLoading, updateSettings, isUpdating } = usePracticeNotificationSettings(practiceId);
  
  const [localEmailEnabled, setLocalEmailEnabled] = useState(settings?.enable_email_notifications ?? true);
  const [localSmsEnabled, setLocalSmsEnabled] = useState(settings?.enable_sms_notifications ?? true);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [pendingChange, setPendingChange] = useState<{ type: 'email' | 'sms'; value: boolean } | null>(null);

  // Update local state when settings load
  useState(() => {
    if (settings) {
      setLocalEmailEnabled(settings.enable_email_notifications);
      setLocalSmsEnabled(settings.enable_sms_notifications);
    }
  });

  const handleToggleChange = (type: 'email' | 'sms', value: boolean) => {
    if (!value) {
      // Show confirmation dialog when disabling
      setPendingChange({ type, value });
      setShowDisableDialog(true);
    } else {
      // Enable immediately
      if (type === 'email') {
        setLocalEmailEnabled(value);
      } else {
        setLocalSmsEnabled(value);
      }
    }
  };

  const confirmDisable = () => {
    if (pendingChange) {
      if (pendingChange.type === 'email') {
        setLocalEmailEnabled(pendingChange.value);
      } else {
        setLocalSmsEnabled(pendingChange.value);
      }
    }
    setShowDisableDialog(false);
    setPendingChange(null);
  };

  const handleSave = () => {
    updateSettings({
      enable_email_notifications: localEmailEnabled,
      enable_sms_notifications: localSmsEnabled,
    });
  };

  const hasChanges = 
    localEmailEnabled !== settings?.enable_email_notifications ||
    localSmsEnabled !== settings?.enable_sms_notifications;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle>Practice Notification Settings</CardTitle>
          </div>
          <CardDescription>
            Master controls for email and SMS notifications sent to all patients in your practice
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p>
                  These settings control <strong>only automated practice workflows</strong>, such as:
                </p>
                <ul className="list-disc ml-5 text-sm space-y-1">
                  <li>Appointment reminders</li>
                  <li>Follow-up reminders</li>
                  <li>Subscription reminders</li>
                </ul>
                <p className="mt-2">
                  <strong>These settings do NOT affect:</strong>
                </p>
                <ul className="list-disc ml-5 text-sm space-y-1">
                  <li>Direct messages from providers to patients</li>
                  <li>Order notifications</li>
                  <li>Payment notifications</li>
                  <li>System or security alerts</li>
                  <li>Individual user notification preferences</li>
                </ul>
                <p className="mt-2 text-muted-foreground">
                  Each user can still control their own notification preferences independently.
                </p>
              </div>
            </AlertDescription>
          </Alert>

          <div className="space-y-6">
            {/* Email Notifications Toggle */}
            <div className="flex items-start justify-between space-x-4 rounded-lg border border-border p-4">
              <div className="flex items-start space-x-3 flex-1">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-1 flex-1">
                  <Label htmlFor="email-notifications" className="text-base font-medium">
                    Enable Email Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Allow patients to receive email notifications from this platform. 
                    Disable this if you use an external email automation system.
                  </p>
                  {!localEmailEnabled && (
                    <p className="text-sm text-destructive font-medium mt-2">
                      ⚠️ Patients will NOT receive email notifications
                    </p>
                  )}
                </div>
              </div>
              <Switch
                id="email-notifications"
                checked={localEmailEnabled}
                onCheckedChange={(value) => handleToggleChange('email', value)}
                disabled={isUpdating}
              />
            </div>

            {/* SMS Notifications Toggle */}
            <div className="flex items-start justify-between space-x-4 rounded-lg border border-border p-4">
              <div className="flex items-start space-x-3 flex-1">
                <MessageSquare className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-1 flex-1">
                  <Label htmlFor="sms-notifications" className="text-base font-medium">
                    Enable SMS Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Allow patients to receive SMS text notifications from this platform. 
                    Disable this if you use an external SMS automation system.
                  </p>
                  {!localSmsEnabled && (
                    <p className="text-sm text-destructive font-medium mt-2">
                      ⚠️ Patients will NOT receive SMS notifications
                    </p>
                  )}
                </div>
              </div>
              <Switch
                id="sms-notifications"
                checked={localSmsEnabled}
                onCheckedChange={(value) => handleToggleChange('sms', value)}
                disabled={isUpdating}
              />
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Note:</strong> In-app notifications will always work regardless of these settings. 
              These controls only affect email and SMS delivery. When notifications are enabled here, 
              individual patient preferences will still be respected.
            </AlertDescription>
          </Alert>

          {hasChanges && (
            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => {
                  setLocalEmailEnabled(settings?.enable_email_notifications ?? true);
                  setLocalSmsEnabled(settings?.enable_sms_notifications ?? true);
                }}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isUpdating}>
                {isUpdating ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable {pendingChange?.type === 'email' ? 'Email' : 'SMS'} Notifications?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will prevent <strong>all patients</strong> in your practice from receiving{' '}
                {pendingChange?.type === 'email' ? 'email' : 'SMS'} notifications, regardless of their 
                personal preferences.
              </p>
              <p className="font-medium">
                Use this if you have external automation in place for patient communications.
              </p>
              <p className="text-sm text-muted-foreground">
                In-app notifications will continue to work normally.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingChange(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDisable}>
              Disable {pendingChange?.type === 'email' ? 'Email' : 'SMS'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
