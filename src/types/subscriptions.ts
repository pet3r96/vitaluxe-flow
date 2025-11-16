export interface PracticeSubscription {
  id: string;
  practice_id: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionUpgradePrompt {
  id: string;
  user_id: string;
  feature_name: string;
  prompt_count: number;
  last_prompted_at: string;
  created_at: string;
}
