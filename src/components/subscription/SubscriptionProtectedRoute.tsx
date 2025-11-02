import { ReactNode, useEffect } from "react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface SubscriptionProtectedRouteProps {
  children: ReactNode;
}

export const SubscriptionProtectedRoute = ({ children }: SubscriptionProtectedRouteProps) => {
  const { isSubscribed, loading } = useSubscription();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Only redirect once, when loading is complete and subscription is false
    if (!loading && !isSubscribed) {
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
