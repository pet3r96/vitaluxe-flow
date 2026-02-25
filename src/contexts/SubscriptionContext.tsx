import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getSubscriptionStatus, SubscriptionStatus } from "@/lib/subscriptionCheck";
import { supabase } from "@/integrations/supabase/client";
import { realtimeManager } from "@/lib/realtimeManager";
import { logger } from "@/lib/logger";

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
    trialDaysRemaining: null,
    gracePeriodEndsAt: null
  });
  const [loading, setLoading] = useState(true);

  const refreshSubscription = async () => {
    // === FREE MODE TOGGLE ===
    // All Pro features are currently free. To re-enable subscription gating,
    // remove this block down to the "END FREE MODE" comment.
    setSubscriptionStatus({
      isSubscribed: true,
      status: 'active',
      trialEndsAt: null,
      currentPeriodEnd: null,
      trialDaysRemaining: null,
      gracePeriodEndsAt: null,
    });
    setLoading(false);
    return;
    // === END FREE MODE ===

    logger.info('[SubscriptionContext] refreshSubscription called', { effectiveRole, effectivePracticeId });
    
    // Patients, Pharmacies, and Providers always have access (operational accounts, not subscription customers)
    // Providers inherit their parent practice's subscription
    if (effectiveRole === 'patient' || effectiveRole === 'pharmacy' || effectiveRole === 'provider') {
      logger.info('[SubscriptionContext] Auto-granting access for', { effectiveRole });
      setSubscriptionStatus({
        isSubscribed: true,
        status: 'active',
        trialEndsAt: null,
        currentPeriodEnd: null,
        trialDaysRemaining: null,
        gracePeriodEndsAt: null
      });
      setLoading(false);
      return;
    }

    // Allow doctor and staff roles (staff inherit practice subscription via effectivePracticeId)
    if (!user?.id || !effectivePracticeId) {
      logger.info('[SubscriptionContext] No user or practice ID', { userId: user?.id, effectivePracticeId });
      setSubscriptionStatus({
        isSubscribed: false,
        status: null,
        trialEndsAt: null,
        currentPeriodEnd: null,
        trialDaysRemaining: null,
        gracePeriodEndsAt: null
      });
      setLoading(false);
      return;
    }

    // For doctors, check their own subscription (user.id === practice_id)
    const practiceIdToCheck = effectivePracticeId || user.id;
    
    if (!practiceIdToCheck) {
      logger.info('[SubscriptionContext] No practice ID to check');
      setSubscriptionStatus({
        isSubscribed: false,
        status: null,
        trialEndsAt: null,
        currentPeriodEnd: null,
        trialDaysRemaining: null,
        gracePeriodEndsAt: null
      });
      setLoading(false);
      return;
    }

    try {
      // If impersonating (effectivePracticeId differs from user.id), use edge function
      // to bypass RLS issues during impersonation
      if (effectivePracticeId && effectivePracticeId !== user.id) {
        logger.info('[SubscriptionContext] Using edge function for impersonation', { effectivePracticeId });
        const { data, error } = await supabase.functions.invoke('get-practice-subscription-status', {
          body: { practiceId: effectivePracticeId }
        });
        
        if (error) {
          logger.error('[SubscriptionContext] Edge function error', error);
          
          // ✅ Set a safe fallback instead of throwing
          setSubscriptionStatus({
            isSubscribed: false,
            status: null,
            trialEndsAt: null,
            currentPeriodEnd: null,
            trialDaysRemaining: null,
            gracePeriodEndsAt: null,
          });
          
          setLoading(false);
          return;
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
      logger.error('Error fetching subscription status', error);
      
      // ✅ Fallback subscription state on unexpected error
      setSubscriptionStatus({
        isSubscribed: false,
        status: null,
        trialEndsAt: null,
        currentPeriodEnd: null,
        trialDaysRemaining: null,
        gracePeriodEndsAt: null,
      });
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
      logger.info('[SubscriptionContext] Subscription changed', { payload });
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
