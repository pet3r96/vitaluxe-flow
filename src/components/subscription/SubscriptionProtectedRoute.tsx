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
    if (!loading && !isSubscribed) {
      toast.error("This feature requires VitaLuxePro subscription", {
        description: "Start your 7-day free trial to access all premium features"
      });
      navigate("/subscribe-to-vitaluxepro", { 
        state: { returnUrl: location.pathname } 
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
