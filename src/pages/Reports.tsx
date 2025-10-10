import { ImpersonationLogsView } from "@/components/admin/ImpersonationLogsView";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield } from "lucide-react";

const Reports = () => {
  const { canImpersonate } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold gold-text-gradient">Reports</h1>
        <p className="text-muted-foreground mt-2">
          {canImpersonate 
            ? "View analytics and export data"
            : "View your account access history"}
        </p>
      </div>

      <ImpersonationLogsView />
    </div>
  );
};

export default Reports;
