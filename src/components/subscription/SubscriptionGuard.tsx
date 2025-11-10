import { ReactNode } from "react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

interface SubscriptionGuardProps {
  children: ReactNode;
  feature?: string;
  upgradeMessage?: string;
}

export const SubscriptionGuard = ({ 
  children, 
  feature = "This feature",
  upgradeMessage = "Upgrade to VitaLuxePro to access this feature"
}: SubscriptionGuardProps) => {
  const { isSubscribed, loading } = useSubscription();
  const { effectiveRole } = useAuth();
  const navigate = useNavigate();

  console.log('[SubscriptionGuard] Guard check', { effectiveRole, isSubscribed, loading });

  if (loading) {
    return <Skeleton className="h-32 w-full" />;
  }

  // Only show upgrade prompt for doctors (practice owners)
  if (!isSubscribed && effectiveRole === 'doctor') {
    return (
      <Card className="p-6 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-primary/10 p-3">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                {feature} <Sparkles className="h-4 w-4 text-primary" />
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {upgradeMessage}
              </p>
            </div>
            <Button 
              onClick={() => navigate("/subscribe-to-vitaluxepro")}
              className="bg-primary hover:bg-primary/90"
            >
              Upgrade to VitaLuxePro
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return <>{children}</>;
};
