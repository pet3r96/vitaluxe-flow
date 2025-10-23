import { useAuth } from "@/contexts/AuthContext";
import { lazy, Suspense } from "react";

// Lazy load dashboards with retry mechanism
const lazyWithRetry = (componentImport: () => Promise<any>) =>
  lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem('page-has-been-force-refreshed', 'false');
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {
        window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
        console.warn('Chunk load failed, forcing reload...', error);
        window.location.reload();
        return new Promise(() => {});
      }
      throw error;
    }
  });

const Dashboard = lazyWithRetry(() => import("@/pages/Dashboard"));
const RepDashboard = lazyWithRetry(() => import("@/pages/RepDashboard"));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

export function DashboardRouter() {
  const { effectiveRole } = useAuth();
  
  return (
    <Suspense fallback={<PageLoader />}>
      {effectiveRole === 'topline' || effectiveRole === 'downline' ? (
        <RepDashboard />
      ) : (
        <Dashboard />
      )}
    </Suspense>
  );
}
