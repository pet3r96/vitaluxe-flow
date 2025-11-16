import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock, Key, AlertTriangle } from "lucide-react";

export default function Security() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Security Center</h1>
        <p className="text-muted-foreground">Monitor and manage system security</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Access Control
            </CardTitle>
            <CardDescription>Manage user permissions and roles</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Configure role-based access control policies
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Authentication
            </CardTitle>
            <CardDescription>Authentication and session management</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Manage authentication methods and session policies
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Keys
            </CardTitle>
            <CardDescription>Manage API keys and integrations</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              View and manage system API keys
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Security Alerts
            </CardTitle>
            <CardDescription>Recent security events</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Monitor security alerts and suspicious activities
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
