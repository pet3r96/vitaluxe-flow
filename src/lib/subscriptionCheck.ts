import { supabase } from "@/integrations/supabase/client";

export interface SubscriptionStatus {
  isSubscribed: boolean;
  status: 'trial' | 'active' | 'cancelled' | 'expired' | 'suspended' | 'payment_failed' | null;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  trialDaysRemaining: number | null;
  gracePeriodEndsAt?: Date | null;
}

export const hasActiveSubscription = async (practiceId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('practice_subscriptions' as any)
    .select('status, trial_ends_at, current_period_end')
    .eq('practice_id', practiceId)
    .single();
    
  if (error || !data || typeof data !== 'object') return false;
  
  const subscription = data as any;
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
    .from('practice_subscriptions' as any)
    .select('status, trial_ends_at, current_period_end, grace_period_ends_at')
    .eq('practice_id', practiceId)
    .maybeSingle();
    
  if (error) {
    console.error('[SubscriptionCheck] Query error:', error);
  }
  
  if (error || !data || typeof data !== 'object') {
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
  
  console.log('[SubscriptionCheck] Found subscription:', {
    status: (data as any).status,
    trial_ends_at: (data as any).trial_ends_at,
    current_period_end: (data as any).current_period_end
  });
  
  const subscription = data as any;
  const now = new Date();
  let isSubscribed = false;
  let trialDaysRemaining = null;
  
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

  // Suspended subscriptions are in grace period - still "subscribed" until grace period ends
  if (subscription.status === 'suspended' && subscription.grace_period_ends_at) {
    isSubscribed = new Date(subscription.grace_period_ends_at) > now;
  }
  
  return {
    isSubscribed,
    status: subscription.status as any,
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
  if (!data || typeof data !== 'object') return true;
  
  const prompt = data as any;
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
    
  if (existing && typeof existing === 'object') {
    const prompt = existing as any;
    await supabase
      .from('subscription_upgrade_prompts' as any)
      .update({
        last_shown_at: new Date().toISOString(),
        show_count: (prompt.show_count || 0) + 1
      })
      .eq('id', prompt.id);
  } else {
    await supabase
      .from('subscription_upgrade_prompts' as any)
      .insert({
        practice_id: practiceId,
        last_shown_at: new Date().toISOString(),
        show_count: 1
      });
  }
};

export const dismissUpgradePromptPermanently = async (practiceId: string): Promise<void> => {
  const { data: existing } = await supabase
    .from('subscription_upgrade_prompts' as any)
    .select('id')
    .eq('practice_id', practiceId)
    .maybeSingle();
    
  if (existing && typeof existing === 'object') {
    const prompt = existing as any;
    await supabase
      .from('subscription_upgrade_prompts' as any)
      .update({ permanently_dismissed: true })
      .eq('id', prompt.id);
  } else {
    await supabase
      .from('subscription_upgrade_prompts' as any)
      .insert({
        practice_id: practiceId,
        permanently_dismissed: true
      });
  }
};
