import { ImpersonationLogsView } from "@/components/admin/ImpersonationLogsView";
import { useAuth } from "@/contexts/AuthContext";
import AdminProfitReports from "./AdminProfitReports";
import RepProfitReports from "./RepProfitReports";

const Reports = () => {
  const { userRole, effectiveRole, isImpersonating } = useAuth();

  // Admin (not impersonating) → Admin Profit Report
  const showAdminReport = userRole === 'admin' && !isImpersonating;
  
  // Rep or Admin impersonating as rep → Rep Profit Report
  const showRepReport = effectiveRole === 'topline' || effectiveRole === 'downline';

  if (showAdminReport) {
    return <AdminProfitReports />;
  }

  if (showRepReport) {
    return <RepProfitReports />;
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
