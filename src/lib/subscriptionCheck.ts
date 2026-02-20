import { supabase } from "@/integrations/supabase/client";
import { UpgradePrompts } from '@/integrations/supabase/table-helpers';
import type { PracticeSubscription, SubscriptionStatus as SubscriptionStatusType } from "@/types/subscriptions";
import type { SubscriptionUpgradePrompt, SubscriptionUpgradePromptInsert, SubscriptionUpgradePromptUpdate } from "@/types/manual-schema";
import { logger } from "@/lib/logger";

/**
 * Auto-extend subscription period for active subscriptions
 * This ensures users with active status don't lose access due to billing period expiration
 */
const extendSubscriptionPeriod = async (practiceId: string): Promise<void> => {
  const now = new Date();
  const oneMonthFromNow = new Date(now);
  oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
  
  const { error } = await supabase
    .from('practice_subscriptions')
    .update({
      current_period_start: now.toISOString(),
      current_period_end: oneMonthFromNow.toISOString(),
      updated_at: now.toISOString()
    })
    .eq('practice_id', practiceId)
    .eq('status', 'active'); // Only extend if still active
    
  if (error) {
    logger.error("Failed to extend subscription period", error, { practiceId });
    throw error;
  }
  
  logger.info("Auto-extended subscription period", { 
    practiceId, 
    newPeriodEnd: oneMonthFromNow.toISOString() 
  });
};

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
  
  if (subscription.status === 'active') {
    return true;
  }
  
  return false;
};

export const getSubscriptionStatus = async (practiceId: string): Promise<SubscriptionStatus> => {
  logger.info("Checking subscription", { practiceId });
  
  const { data, error } = await supabase
    .from('practice_subscriptions')
    .select('status, trial_ends_at, current_period_end, grace_period_ends_at')
    .eq('practice_id', practiceId)
    .maybeSingle();
    
  if (error) {
    logger.error("Subscription query error", error, { practiceId });
  }
  
  if (error || !data) {
    logger.info("No subscription found", { practiceId });
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
  
  logger.info("Found subscription", {
    practiceId,
    status: subscription.status,
    trialEndsAt: subscription.trial_ends_at
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
  
  if (subscription.status === 'active') {
    // Active subscriptions always have access - the status itself indicates they're subscribed
    // Period end is for billing purposes, not access control
    // If payment fails, the status should change to 'past_due' or 'suspended'
    isSubscribed = true;
    
    // Auto-extend period if it's expired but status is still active (no payment failure recorded)
    if (subscription.current_period_end && new Date(subscription.current_period_end) < now) {
      // Trigger background period extension for active subscriptions
      extendSubscriptionPeriod(practiceId).catch(err => 
        logger.warn("Failed to auto-extend subscription period", { practiceId, error: err })
      );
    }
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
  
  const { data, error } = await UpgradePrompts()
    .select('last_shown_at, permanently_dismissed')
    .eq('practice_id', practiceId)
    .maybeSingle();
    
  if (error) return true;
  if (!data) return true;
  
  if (data.permanently_dismissed) return false;
  
  if (data.last_shown_at) {
    const now = Date.now();
    const daysSinceLastShown = Math.floor(
      (now - new Date(data.last_shown_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceLastShown >= 30;
  }
  
  return true;
};

export const updateUpgradePromptShown = async (practiceId: string): Promise<void> => {
  const { data: existing } = await UpgradePrompts()
    .select('id, show_count')
    .eq('practice_id', practiceId)
    .maybeSingle();
    
  if (existing) {
    await UpgradePrompts()
      .update({
        last_shown_at: new Date().toISOString(),
        show_count: (existing.show_count || 0) + 1
      })
      .eq('id', existing.id);
  } else {
    await UpgradePrompts()
      .insert({
        practice_id: practiceId,
        last_shown_at: new Date().toISOString(),
        show_count: 1
      });
  }
};

export const dismissUpgradePromptPermanently = async (practiceId: string): Promise<void> => {
  const { data: existing } = await UpgradePrompts()
    .select('id')
    .eq('practice_id', practiceId)
    .maybeSingle();
    
  if (existing) {
    await UpgradePrompts()
      .update({ permanently_dismissed: true })
      .eq('id', existing.id);
  } else {
    await UpgradePrompts()
      .insert({
        practice_id: practiceId,
        permanently_dismissed: true
      });
  }
};
