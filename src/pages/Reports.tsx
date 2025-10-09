import { ImpersonationLogsView } from "@/components/admin/ImpersonationLogsView";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield } from "lucide-react";

const Reports = () => {
  const { actualRole, canImpersonate } = useAuth();

  // Only admins can view the Reports page
  if (actualRole !== 'admin') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold gold-text-gradient">Reports</h1>
          <p className="text-muted-foreground mt-2">
            View analytics and export data
          </p>
        </div>
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Access denied. This page is restricted to administrators only.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold gold-text-gradient">Reports</h1>
        <p className="text-muted-foreground mt-2">
          View analytics and export data
        </p>
      </div>

      {canImpersonate && <ImpersonationLogsView />}
    </div>
  );
};

export default Reports;
