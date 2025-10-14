import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell } from "lucide-react";

export const AlertRulesManager = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Alert Rules Configuration
        </CardTitle>
        <CardDescription>
          Configure monitoring thresholds and notification settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 text-muted-foreground">
          <Bell className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium mb-2">Alert Rules Management</p>
          <p className="text-sm">
            Configure alert thresholds for security events, failed logins, and anomalies.
            <br />
            Set notification recipients and channels (email, Slack, etc.).
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
