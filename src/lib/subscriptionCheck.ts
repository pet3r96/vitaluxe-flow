import { supabase } from "@/integrations/supabase/client";
import type { PracticeSubscription, SubscriptionUpgradePrompt, SubscriptionStatus as SubscriptionStatusType } from "@/types/subscriptions";

export interface SubscriptionStatus {
  isSubscribed: boolean;
  status: SubscriptionStatusType | null;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  trialDaysRemaining: number | null;
  gracePeriodEndsAt?: Date | null;
}

export const hasActiveSubscription = async (practiceId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('practice_subscriptions')
    .select('status, trial_ends_at, current_period_end')
    .eq('practice_id', practiceId)
    .single();
    
  if (error || !data) return false;
  
  const subscription = data as PracticeSubscription;
  const now = new Date();
  
  if (subscription.status === 'trial' && subscription.trial_ends_at) {
    return new Date(subscription.trial_ends_at) > now;
  }
  
  if (subscription.status === 'active' && subscription.current_period_end) {
    return new Date(subscription.current_period_end) > now;
  }
  
  return false;
};

export const getSubscriptionStatus = async (practiceId: string): Promise<SubscriptionStatus> => {
  console.log('[SubscriptionCheck] Checking subscription for practice:', practiceId);
  
  const { data, error } = await supabase
    .from('practice_subscriptions')
    .select('status, trial_ends_at, current_period_end, grace_period_ends_at')
    .eq('practice_id', practiceId)
    .maybeSingle();
    
  if (error) {
    console.error('[SubscriptionCheck] Query error:', error);
  }
  
  if (error || !data) {
    console.log('[SubscriptionCheck] No subscription found for practice:', practiceId);
    return {
      isSubscribed: false,
      status: null,
      trialEndsAt: null,
      currentPeriodEnd: null,
      trialDaysRemaining: null,
      gracePeriodEndsAt: null
    };
  }
  
  const subscription = data as PracticeSubscription;
  
  console.log('[SubscriptionCheck] Found subscription:', {
    status: subscription.status,
    trial_ends_at: subscription.trial_ends_at,
    current_period_end: subscription.current_period_end
  });
  
  const now = new Date();
  let isSubscribed = false;
  let trialDaysRemaining: number | null = null;
  
  if (subscription.status === 'trial' && subscription.trial_ends_at) {
    const trialEnd = new Date(subscription.trial_ends_at);
    isSubscribed = trialEnd > now;
    if (isSubscribed) {
      trialDaysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }
  }
  
  if (subscription.status === 'active' && subscription.current_period_end) {
    isSubscribed = new Date(subscription.current_period_end) > now;
  }

  // Suspended subscriptions are NOT subscribed - force upgrade decision
  if (subscription.status === 'suspended') {
    isSubscribed = false;
  }
  
  return {
    isSubscribed,
    status: subscription.status,
    trialEndsAt: subscription.trial_ends_at ? new Date(subscription.trial_ends_at) : null,
    currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end) : null,
    trialDaysRemaining,
    gracePeriodEndsAt: subscription.grace_period_ends_at ? new Date(subscription.grace_period_ends_at) : null
  };
};

export const shouldShowUpgradePrompt = async (practiceId: string): Promise<boolean> => {
  const hasSubscription = await hasActiveSubscription(practiceId);
  if (hasSubscription) return false;
  
  const { data, error } = await supabase
    .from('subscription_upgrade_prompts' as any)
    .select('last_shown_at, permanently_dismissed')
    .eq('practice_id', practiceId)
    .maybeSingle();
    
  if (error) return true;
  if (!data) return true;
  
  const prompt = data as unknown as SubscriptionUpgradePrompt;
  if (prompt.permanently_dismissed) return false;
  
  if (prompt.last_shown_at) {
    const daysSinceLastShown = Math.floor(
      (Date.now() - new Date(prompt.last_shown_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceLastShown >= 30;
  }
  
  return true;
};

export const updateUpgradePromptShown = async (practiceId: string): Promise<void> => {
  const { data: existing } = await supabase
    .from('subscription_upgrade_prompts' as any)
    .select('id, show_count')
    .eq('practice_id', practiceId)
    .maybeSingle();
    
  if (existing) {
    const prompt = existing as unknown as SubscriptionUpgradePrompt & { show_count?: number };
    await supabase
      .from('subscription_upgrade_prompts' as any)
      .update({
        last_shown_at: new Date().toISOString(),
        show_count: (prompt.show_count || 0) + 1
      } as any)
      .eq('id', prompt.id);
  } else {
    await supabase
      .from('subscription_upgrade_prompts' as any)
      .insert({
        practice_id: practiceId,
        last_shown_at: new Date().toISOString(),
        show_count: 1
      } as any);
  }
};

export const dismissUpgradePromptPermanently = async (practiceId: string): Promise<void> => {
  const { data: existing } = await supabase
    .from('subscription_upgrade_prompts' as any)
    .select('id')
    .eq('practice_id', practiceId)
    .maybeSingle();
    
  if (existing) {
    const prompt = existing as unknown as SubscriptionUpgradePrompt;
    await supabase
      .from('subscription_upgrade_prompts' as any)
      .update({ permanently_dismissed: true } as any)
      .eq('id', prompt.id);
  } else {
    await supabase
      .from('subscription_upgrade_prompts' as any)
      .insert({
        practice_id: practiceId,
        permanently_dismissed: true
      } as any);
  }
};
