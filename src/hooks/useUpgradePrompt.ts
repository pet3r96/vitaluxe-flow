import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import {
  shouldShowUpgradePrompt,
  updateUpgradePromptShown,
  dismissUpgradePromptPermanently
} from "@/lib/subscriptionCheck";

interface UseUpgradePromptReturn {
  shouldShow: boolean;
  dismiss: () => Promise<void>;
  dismissPermanently: () => Promise<void>;
}

export const useUpgradePrompt = (): UseUpgradePromptReturn => {
  const { user, effectiveRole, effectivePracticeId } = useAuth();
  const { isSubscribed } = useSubscription();
  const [shouldShow, setShouldShow] = useState(false);
  const [loginCount, setLoginCount] = useState(0);
  const [hasCheckedThisSession, setHasCheckedThisSession] = useState(false);

  useEffect(() => {
    if (effectiveRole !== 'doctor') {
      setShouldShow(false);
      return;
    }

    if (isSubscribed) {
      setShouldShow(false);
      return;
    }

    // Only check once per React session to prevent duplicate prompts
    if (hasCheckedThisSession) return;

    const storedCount = parseInt(sessionStorage.getItem('loginCount') || '0', 10);
    const newCount = storedCount + 1;
    sessionStorage.setItem('loginCount', newCount.toString());
    setLoginCount(newCount);

    if (newCount === 2 && user?.id) {
      setHasCheckedThisSession(true);
      checkShouldShow();
    }
  }, [user?.id, effectiveRole, isSubscribed, effectivePracticeId, hasCheckedThisSession]);

  const checkShouldShow = async () => {
    if (!user?.id) return;
    
    // Use proper practice ID context (same logic as SubscriptionContext)
    const practiceIdToCheck = effectivePracticeId || user.id;
    console.log('[useUpgradePrompt] Checking for practice:', practiceIdToCheck);
    
    const should = await shouldShowUpgradePrompt(practiceIdToCheck);
    if (should) {
      setShouldShow(true);
      await updateUpgradePromptShown(practiceIdToCheck);
    }
  };

  const dismiss = async () => {
    setShouldShow(false);
  };

  const dismissPermanently = async () => {
    if (!user?.id) return;
    const practiceIdToCheck = effectivePracticeId || user.id;
    await dismissUpgradePromptPermanently(practiceIdToCheck);
    setShouldShow(false);
  };

  return {
    shouldShow,
    dismiss,
    dismissPermanently
  };
};
