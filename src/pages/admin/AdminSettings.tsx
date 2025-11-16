import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Database, Shield, Bell } from "lucide-react";

export default function AdminSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Settings</h1>
        <p className="text-muted-foreground">Configure system-wide settings</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database Settings
            </CardTitle>
            <CardDescription>Configure database and data retention policies</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Database configuration and management tools
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Settings
            </CardTitle>
            <CardDescription>Manage security policies and access controls</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Security configuration and audit settings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Settings
            </CardTitle>
            <CardDescription>Configure system notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Notification templates and delivery settings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              System Configuration
            </CardTitle>
            <CardDescription>General system settings</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              System-wide configuration options
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
