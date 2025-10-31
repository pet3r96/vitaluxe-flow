import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorLogsView } from "@/components/admin/ErrorLogsView";
import { ImpersonationLogsView } from "@/components/admin/ImpersonationLogsView";
import { SecurityOverview } from "@/components/security/SecurityOverview";
import { AuditLogsViewer } from "@/components/security/AuditLogsViewer";
import { SecurityEventsTable } from "@/components/security/SecurityEventsTable";
import { AlertRulesManager } from "@/components/security/AlertRulesManager";
import { AlertsViewer } from "@/components/security/AlertsViewer";
import { ArchivedLogsViewer } from "@/components/security/ArchivedLogsViewer";
import { AccountSecurityManager } from "@/components/security/AccountSecurityManager";
import { PHIAccessMonitor } from "@/components/security/PHIAccessMonitor";
import { EncryptionStatusManager } from "@/components/security/EncryptionStatusManager";
import { PaymentMethodAuditLog } from "@/components/security/PaymentMethodAuditLog";
import { PrescriptionAccessAudit } from "@/components/security/PrescriptionAccessAudit";
import { CartSecurityMonitor } from "@/components/security/CartSecurityMonitor";
import { IPBanlistManager } from "@/components/admin/IPBanlistManager";
import { PatientMedicalVaultActivityLog } from "@/components/security/PatientMedicalVaultActivityLog";
import { Shield, AlertTriangle, Activity, Bell, Archive, Lock, FileText, UserCheck, Eye, Key, CreditCard, ShoppingCart, ShieldBan, History } from "lucide-react";

const Security = () => {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-8">
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-foreground">Security & Monitoring</h1>
        <p className="text-muted-foreground mt-2">
          Comprehensive security monitoring, audit logs, and HIPAA compliance management
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-12 pt-2">
        <TabsList className="flex flex-wrap h-auto w-full justify-start gap-2 p-2 bg-muted">
          <TabsTrigger value="overview" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="phi-access" className="gap-2">
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">PHI Access</span>
          </TabsTrigger>
          <TabsTrigger value="encryption" className="gap-2">
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">Encryption</span>
          </TabsTrigger>
          <TabsTrigger value="prescriptions" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Prescriptions</span>
          </TabsTrigger>
          <TabsTrigger value="banking" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Banking</span>
          </TabsTrigger>
          <TabsTrigger value="cart" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Cart</span>
          </TabsTrigger>
          <TabsTrigger value="errors" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Errors</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Audit</span>
          </TabsTrigger>
          <TabsTrigger value="security-events" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Events</span>
          </TabsTrigger>
          <TabsTrigger value="impersonation" className="gap-2">
            <UserCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Impersonation</span>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Alerts</span>
          </TabsTrigger>
          <TabsTrigger value="archived" className="gap-2">
            <Archive className="h-4 w-4" />
            <span className="hidden sm:inline">Archived</span>
          </TabsTrigger>
          <TabsTrigger value="account-security" className="gap-2">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Lockouts</span>
          </TabsTrigger>
          <TabsTrigger value="ip-banlist" className="gap-2">
            <ShieldBan className="h-4 w-4" />
            <span className="hidden sm:inline">IP Ban List</span>
          </TabsTrigger>
          <TabsTrigger value="vault-activity" className="gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Vault Activity</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <SecurityOverview onViewAllErrors={() => setActiveTab("errors")} />
        </TabsContent>

        <TabsContent value="phi-access">
          <PHIAccessMonitor />
        </TabsContent>

        <TabsContent value="encryption">
          <EncryptionStatusManager />
        </TabsContent>

        <TabsContent value="prescriptions">
          <PrescriptionAccessAudit />
        </TabsContent>

        <TabsContent value="banking">
          <PaymentMethodAuditLog />
        </TabsContent>

        <TabsContent value="cart">
          <CartSecurityMonitor />
        </TabsContent>

        <TabsContent value="errors">
          <ErrorLogsView />
        </TabsContent>

        <TabsContent value="audit">
          <AuditLogsViewer />
        </TabsContent>

        <TabsContent value="security-events">
          <SecurityEventsTable />
        </TabsContent>

        <TabsContent value="impersonation">
          <ImpersonationLogsView />
        </TabsContent>

        <TabsContent value="alerts">
          <div className="space-y-6">
            <AlertsViewer />
            <AlertRulesManager />
          </div>
        </TabsContent>

        <TabsContent value="archived">
          <ArchivedLogsViewer />
        </TabsContent>

        <TabsContent value="account-security">
          <AccountSecurityManager />
        </TabsContent>

        <TabsContent value="ip-banlist">
          <IPBanlistManager />
        </TabsContent>

        <TabsContent value="vault-activity">
          <PatientMedicalVaultActivityLog />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Security;
