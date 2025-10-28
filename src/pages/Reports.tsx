import { ImpersonationLogsView } from "@/components/admin/ImpersonationLogsView";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminProfitReports from "./AdminProfitReports";
import RepProfitReports from "./RepProfitReports";
import PracticeProfitReports from "./PracticeProfitReports";
import ToplinePaymentManager from "@/components/admin/ToplinePaymentManager";
import PracticeDevelopmentFeeManager from "@/components/admin/PracticeDevelopmentFeeManager";

const Reports = () => {
  const { userRole, effectiveRole, isImpersonating, isProviderAccount, isStaffAccount } = useAuth();

  // Restrict access for provider/staff accounts
  if ((effectiveRole === 'doctor' || effectiveRole === 'provider') && (isProviderAccount || isStaffAccount)) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">You do not have access to this page.</p>
      </div>
    );
  }

  // Admin (not impersonating) → Admin Profit Report with Tabs
  const showAdminReport = userRole === 'admin' && !isImpersonating;
  
  // Rep or Admin impersonating as rep → Rep Profit Report
  const showRepReport = effectiveRole === 'topline' || effectiveRole === 'downline';
  
  // Practice (doctor role) → Practice Order/Expense Report
  const showPracticeReport = effectiveRole === 'doctor';

  if (showAdminReport) {
    return (
      <Tabs defaultValue="profit-reports" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="profit-reports">Profit Reports</TabsTrigger>
          <TabsTrigger value="rep-payments">Rep Payments</TabsTrigger>
          <TabsTrigger value="development-fees">Practice Development Fees</TabsTrigger>
        </TabsList>
        
        <TabsContent value="profit-reports">
          <AdminProfitReports />
        </TabsContent>
        
        <TabsContent value="rep-payments">
          <ToplinePaymentManager />
        </TabsContent>
        
        <TabsContent value="development-fees">
          <PracticeDevelopmentFeeManager />
        </TabsContent>
      </Tabs>
    );
  }

  if (showRepReport) {
    return <RepProfitReports />;
  }

  if (showPracticeReport) {
    return <PracticeProfitReports />;
  }

  // Fallback: Impersonation logs
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold gold-text-gradient">Reports</h1>
        <p className="text-muted-foreground mt-2">
          View your account access history
        </p>
      </div>

      <ImpersonationLogsView />
    </div>
  );
};

export default Reports;
