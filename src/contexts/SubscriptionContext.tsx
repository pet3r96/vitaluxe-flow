import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getSubscriptionStatus, SubscriptionStatus } from "@/lib/subscriptionCheck";

interface SubscriptionContextType extends SubscriptionStatus {
  refreshSubscription: () => Promise<void>;
  loading: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { user, effectiveRole, effectivePracticeId } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({
    isSubscribed: false,
    status: null,
    trialEndsAt: null,
    currentPeriodEnd: null,
    trialDaysRemaining: null
  });
  const [loading, setLoading] = useState(true);

  const refreshSubscription = async () => {
    if (!user?.id || (effectiveRole !== 'doctor' && effectiveRole !== 'provider')) {
      setSubscriptionStatus({
        isSubscribed: false,
        status: null,
        trialEndsAt: null,
        currentPeriodEnd: null,
        trialDaysRemaining: null
      });
      setLoading(false);
      return;
    }

    // For providers, check their parent practice's subscription
    // For doctors, check their own subscription (user.id === practice_id)
    const practiceIdToCheck = effectivePracticeId || user.id;
    
    if (!practiceIdToCheck) {
      setSubscriptionStatus({
        isSubscribed: false,
        status: null,
        trialEndsAt: null,
        currentPeriodEnd: null,
        trialDaysRemaining: null
      });
      setLoading(false);
      return;
    }

    try {
      const status = await getSubscriptionStatus(practiceIdToCheck);
      setSubscriptionStatus(status);
    } catch (error) {
      console.error('Error fetching subscription status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSubscription();
  }, [user?.id, effectiveRole, effectivePracticeId]);

  return (
    <SubscriptionContext.Provider
      value={{
        ...subscriptionStatus,
        refreshSubscription,
        loading
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
};
