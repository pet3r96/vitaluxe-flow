import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { NotificationPreferencesDialog } from "@/components/notifications/NotificationPreferencesDialog";

export function NotificationPreferencesSection() {
  const [showPreferences, setShowPreferences] = useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Manage your email and SMS notification settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => setShowPreferences(true)}
          >
            <Bell className="mr-2 h-4 w-4" />
            Manage Notifications
          </Button>
        </CardContent>
      </Card>

      <NotificationPreferencesDialog
        open={showPreferences}
        onOpenChange={setShowPreferences}
      />
    </>
  );
}
