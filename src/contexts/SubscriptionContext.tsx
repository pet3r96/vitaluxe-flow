import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getSubscriptionStatus, SubscriptionStatus } from "@/lib/subscriptionCheck";
import { supabase } from "@/integrations/supabase/client";
import { realtimeManager } from "@/lib/realtimeManager";

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
    // Patients always have access (grandfathered in once created)
    if (effectiveRole === 'patient') {
      setSubscriptionStatus({
        isSubscribed: true,
        status: 'active',
        trialEndsAt: null,
        currentPeriodEnd: null,
        trialDaysRemaining: null
      });
      setLoading(false);
      return;
    }

    // Allow doctor, provider, and staff roles (staff inherit practice subscription via effectivePracticeId)
    if (!user?.id || !effectivePracticeId) {
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
      // If impersonating (effectivePracticeId differs from user.id), use edge function
      // to bypass RLS issues during impersonation
      if (effectivePracticeId && effectivePracticeId !== user.id) {
        console.log('[SubscriptionContext] Using edge function for impersonation', { effectivePracticeId });
        const { data, error } = await supabase.functions.invoke('get-practice-subscription-status', {
          body: { practiceId: effectivePracticeId }
        });
        
        if (error) {
          console.error('[SubscriptionContext] Edge function error:', error);
          throw error;
        }
        
        if (data) {
          setSubscriptionStatus({
            isSubscribed: data.isSubscribed,
            status: data.status,
            trialEndsAt: data.trialEndsAt,
            currentPeriodEnd: data.currentPeriodEnd,
            trialDaysRemaining: data.trialDaysRemaining
          });
        }
      } else {
        // Direct query for non-impersonation cases
        const status = await getSubscriptionStatus(practiceIdToCheck);
        setSubscriptionStatus(status);
      }
    } catch (error) {
      console.error('Error fetching subscription status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSubscription();
  }, [user?.id, effectiveRole, effectivePracticeId]);

  // Listen for subscription changes via realtime
  useEffect(() => {
    const practiceIdToWatch = effectivePracticeId || user?.id;
    if (!practiceIdToWatch) return;

    realtimeManager.subscribe('practice_subscriptions', (payload) => {
      console.log('[SubscriptionContext] Subscription changed:', payload);
      refreshSubscription();
    });

    return () => {
      // Manager handles cleanup
    };
  }, [effectivePracticeId, user?.id]);

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
