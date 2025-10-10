import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddressVerificationPanel } from "@/components/admin/AddressVerificationPanel";
import { ImpersonationLogsView } from "@/components/admin/ImpersonationLogsView";
import { PracticesDataTable } from "@/components/practices/PracticesDataTable";
import { ProvidersDataTable } from "@/components/providers/ProvidersDataTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, MapPin, Activity, Building2, Users } from "lucide-react";

const AdminSettings = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage system-wide settings, address verification, and audit logs
        </p>
      </div>

      <Tabs defaultValue="practices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="practices" className="gap-2">
            <Building2 className="h-4 w-4" />
            Practices
          </TabsTrigger>
          <TabsTrigger value="providers" className="gap-2">
            <Users className="h-4 w-4" />
            Providers
          </TabsTrigger>
          <TabsTrigger value="addresses" className="gap-2">
            <MapPin className="h-4 w-4" />
            Address Verification
          </TabsTrigger>
          <TabsTrigger value="impersonation" className="gap-2">
            <Shield className="h-4 w-4" />
            Impersonation Logs
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <Activity className="h-4 w-4" />
            Audit Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="practices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Practice Management</CardTitle>
              <CardDescription>
                Manage all medical practices, view statistics, and control account status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PracticesDataTable />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="providers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Provider Management</CardTitle>
              <CardDescription>
                Manage all medical providers across all practices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProvidersDataTable />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="addresses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Global Address Verification</CardTitle>
              <CardDescription>
                Validate and standardize addresses across all entities using Zippopotam.us API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AddressVerificationPanel />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="impersonation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Impersonation Activity</CardTitle>
              <CardDescription>
                View all admin impersonation sessions with full audit trail
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImpersonationLogsView />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Audit Logs</CardTitle>
              <CardDescription>
                Track all user actions and system events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSettings;
