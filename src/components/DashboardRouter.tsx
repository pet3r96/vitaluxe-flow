import { useAuth } from "@/contexts/AuthContext";
import { lazy, Suspense } from "react";

// Lazy load individual dashboards to split chunks
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const RepDashboard = lazy(() => import("@/pages/RepDashboard"));
const LoadingFallback = () => <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>;
const PatientDashboard = lazy(() => import("@/pages/patient/PatientDashboard"));
export default function DashboardRouter() {
  const {
    effectiveRole,
    loading
  } = useAuth();

  // Wait for auth to load before determining which dashboard to show
  if (loading || !effectiveRole) {
    return <LoadingFallback />;
  }
  return <Suspense fallback={<LoadingFallback />}>
      {effectiveRole === 'patient' ? <PatientDashboard /> : effectiveRole === 'topline' || effectiveRole === 'downline' ? <RepDashboard /> : <Dashboard />}
    </Suspense>;
}