import { useAuth } from "@/contexts/AuthContext";
import Dashboard from "@/pages/Dashboard";
import RepDashboard from "@/pages/RepDashboard";

export function DashboardRouter() {
  const { effectiveRole } = useAuth();
  
  if (effectiveRole === 'topline' || effectiveRole === 'downline') {
    return <RepDashboard />;
  }
  
  return <Dashboard />;
}
