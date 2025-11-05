import { useState, useEffect } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Security = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Save last active tab to localStorage
  useEffect(() => {
    localStorage.setItem('security-last-tab', activeTab);
  }, [activeTab]);

  // Load last active tab on mount
  useEffect(() => {
    const lastTab = localStorage.getItem('security-last-tab');
    if (lastTab) setActiveTab(lastTab);
  }, []);

  const tabOptions = [
    { value: "overview", label: "Overview", icon: Shield, group: "Overview" },
    { value: "security-events", label: "Security Events", icon: FileText, group: "Overview" },
    { value: "errors", label: "Errors", icon: AlertTriangle, group: "Overview" },
    { value: "phi-access", label: "PHI Access", icon: Eye, group: "Compliance" },
    { value: "banking", label: "Banking", icon: CreditCard, group: "Compliance" },
    { value: "vault-activity", label: "Vault Activity", icon: History, group: "Compliance" },
    { value: "audit", label: "Audit Logs", icon: Activity, group: "Compliance" },
    { value: "encryption", label: "Encryption", icon: Key, group: "Controls" },
    { value: "account-security", label: "Account Lockouts", icon: Lock, group: "Controls" },
    { value: "ip-banlist", label: "IP Ban List", icon: ShieldBan, group: "Controls" },
    { value: "cart", label: "Cart Security", icon: ShoppingCart, group: "Controls" },
    { value: "alerts", label: "Alerts & Rules", icon: Bell, group: "Alerts" },
    { value: "impersonation", label: "Impersonation", icon: UserCheck, group: "Alerts" },
    { value: "archived", label: "Archived Logs", icon: Archive, group: "Alerts" },
  ];

  const activeTabData = tabOptions.find(tab => tab.value === activeTab);

  return (
    <div className="space-y-6">
      <div className="glass-card p-4 sm:p-6 rounded-lg border border-border/50">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">
          Security & Monitoring
        </h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base">
          Comprehensive security monitoring, audit logs, and HIPAA compliance management
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        {/* Mobile Dropdown */}
        {isMobile ? (
          <div className="w-full">
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger className="w-full h-12 glass-card">
                <div className="flex items-center gap-2">
                  {activeTabData && <activeTabData.icon className="h-4 w-4" />}
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent className="max-h-[400px]">
                {["Overview", "Compliance", "Controls", "Alerts"].map((group) => (
                  <div key={group}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      {group}
                    </div>
                    {tabOptions
                      .filter((tab) => tab.group === group)
                      .map((tab) => (
                        <SelectItem key={tab.value} value={tab.value}>
                          <div className="flex items-center gap-2">
                            <tab.icon className="h-4 w-4" />
                            {tab.label}
                          </div>
                        </SelectItem>
                      ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          /* Desktop Tabs with Groups */
          <TabsList className="flex flex-wrap w-full justify-start">
            {/* Overview & Monitoring Group */}
            <div className="flex items-center gap-1">
              <TabsTrigger value="overview" className="gap-2 relative">
                <Shield className="h-4 w-4" />
                <span>Overview</span>
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary animate-pulse" />
              </TabsTrigger>
              <TabsTrigger value="security-events" className="gap-2">
                <FileText className="h-4 w-4" />
                <span>Events</span>
              </TabsTrigger>
              <TabsTrigger value="errors" className="gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span>Errors</span>
              </TabsTrigger>
            </div>

            <Separator orientation="vertical" className="h-8 mx-1" />

            {/* Compliance & Audit Group */}
            <div className="flex items-center gap-1">
              <TabsTrigger value="phi-access" className="gap-2">
                <Eye className="h-4 w-4" />
                <span>PHI Access</span>
              </TabsTrigger>
              <TabsTrigger value="banking" className="gap-2">
                <CreditCard className="h-4 w-4" />
                <span>Banking</span>
              </TabsTrigger>
              <TabsTrigger value="vault-activity" className="gap-2">
                <History className="h-4 w-4" />
                <span>Vault</span>
              </TabsTrigger>
              <TabsTrigger value="audit" className="gap-2">
                <Activity className="h-4 w-4" />
                <span>Audit</span>
              </TabsTrigger>
            </div>

            <Separator orientation="vertical" className="h-8 mx-1" />

            {/* Security Controls Group */}
            <div className="flex items-center gap-1">
              <TabsTrigger value="encryption" className="gap-2">
                <Key className="h-4 w-4" />
                <span>Encryption</span>
              </TabsTrigger>
              <TabsTrigger value="account-security" className="gap-2">
                <Lock className="h-4 w-4" />
                <span>Lockouts</span>
              </TabsTrigger>
              <TabsTrigger value="ip-banlist" className="gap-2">
                <ShieldBan className="h-4 w-4" />
                <span>IP Bans</span>
              </TabsTrigger>
              <TabsTrigger value="cart" className="gap-2">
                <ShoppingCart className="h-4 w-4" />
                <span>Cart</span>
              </TabsTrigger>
            </div>

            <Separator orientation="vertical" className="h-8 mx-1" />

            {/* Alerts & Archives Group */}
            <div className="flex items-center gap-1">
              <TabsTrigger value="alerts" className="gap-2">
                <Bell className="h-4 w-4" />
                <span>Alerts</span>
              </TabsTrigger>
              <TabsTrigger value="impersonation" className="gap-2">
                <UserCheck className="h-4 w-4" />
                <span>Impersonation</span>
              </TabsTrigger>
              <TabsTrigger value="archived" className="gap-2">
                <Archive className="h-4 w-4" />
                <span>Archived</span>
              </TabsTrigger>
            </div>
          </TabsList>
        )}

        <TabsContent value="overview">
          <SecurityOverview onViewAllErrors={() => setActiveTab("errors")} />
        </TabsContent>

        <TabsContent value="phi-access">
          <PHIAccessMonitor />
        </TabsContent>

        <TabsContent value="encryption">
          <EncryptionStatusManager />
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
