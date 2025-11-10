import { ReactNode, useEffect } from "react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface SubscriptionProtectedRouteProps {
  children: ReactNode;
}

export const SubscriptionProtectedRoute = ({ children }: SubscriptionProtectedRouteProps) => {
  const { isSubscribed, loading } = useSubscription();
  const { effectiveRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    console.log('[SubscriptionProtectedRoute] Check', { effectiveRole, isSubscribed, loading, path: location.pathname });
    
    // Only redirect PRACTICE OWNERS (doctors) who are not subscribed
    // Staff, providers, patients, pharmacy should never hit this route due to menu visibility
    if (!loading && !isSubscribed && effectiveRole === 'doctor') {
      // Use a ref or local storage to prevent repeated toasts
      const toastKey = `subscription-redirect-${location.pathname}`;
      const lastToast = sessionStorage.getItem(toastKey);
      const now = Date.now();
      
      // Only show toast if we haven't shown it in the last 5 seconds for this route
      if (!lastToast || now - parseInt(lastToast) > 5000) {
        toast.error("This feature requires VitaLuxePro subscription", {
          description: "Start your 14-day free trial to access all premium features"
        });
        sessionStorage.setItem(toastKey, now.toString());
      }
      
      navigate("/subscribe-to-vitaluxepro", { 
        state: { returnUrl: location.pathname },
        replace: true  // Use replace to avoid back button issues
      });
    }
  }, [isSubscribed, loading, navigate, location.pathname]);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isSubscribed) {
    return null;
  }

  return <>{children}</>;
};
