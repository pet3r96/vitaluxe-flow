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
  const { user, effectiveRole } = useAuth();
  const { isSubscribed } = useSubscription();
  const [shouldShow, setShouldShow] = useState(false);
  const [loginCount, setLoginCount] = useState(0);

  useEffect(() => {
    if (effectiveRole !== 'doctor') {
      setShouldShow(false);
      return;
    }

    if (isSubscribed) {
      setShouldShow(false);
      return;
    }

    const storedCount = parseInt(sessionStorage.getItem('loginCount') || '0', 10);
    const newCount = storedCount + 1;
    sessionStorage.setItem('loginCount', newCount.toString());
    setLoginCount(newCount);

    if (newCount === 2 && user?.id) {
      checkShouldShow();
    }
  }, [user?.id, effectiveRole, isSubscribed]);

  const checkShouldShow = async () => {
    if (!user?.id) return;
    
    const should = await shouldShowUpgradePrompt(user.id);
    if (should) {
      setShouldShow(true);
      await updateUpgradePromptShown(user.id);
    }
  };

  const dismiss = async () => {
    setShouldShow(false);
  };

  const dismissPermanently = async () => {
    if (!user?.id) return;
    await dismissUpgradePromptPermanently(user.id);
    setShouldShow(false);
  };

  return {
    shouldShow,
    dismiss,
    dismissPermanently
  };
};
