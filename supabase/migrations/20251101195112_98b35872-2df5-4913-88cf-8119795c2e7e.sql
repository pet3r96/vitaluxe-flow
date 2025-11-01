-- Update subscription pricing to $149.99/month and trial period to 14 days

-- 1. Update default monthly_price in practice_subscriptions table
ALTER TABLE public.practice_subscriptions 
ALTER COLUMN monthly_price SET DEFAULT 149.99;

-- 2. Update ALL existing subscriptions to new price (no grandfathering)
UPDATE public.practice_subscriptions 
SET monthly_price = 149.99 
WHERE monthly_price != 149.99;

-- 3. Update create_practice_subscription function to use 14-day trial period
CREATE OR REPLACE FUNCTION public.create_practice_subscription(practice_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_subscription_id uuid;
BEGIN
  INSERT INTO public.practice_subscriptions (
    practice_id,
    status,
    monthly_price,
    trial_ends_at,
    created_at,
    updated_at
  )
  VALUES (
    practice_user_id,
    'trial',
    149.99,
    now() + INTERVAL '14 days',
    now(),
    now()
  )
  RETURNING id INTO new_subscription_id;
  
  RETURN new_subscription_id;
END;
$$;

-- 4. Update subscription terms to reflect new pricing and auto-enrollment
UPDATE public.terms_and_conditions
SET 
  content = '# VITALUXEPRO SUBSCRIPTION AGREEMENT

## 1. SERVICE DESCRIPTION
VitaLuxePro provides a comprehensive virtual front desk and EMR-lite system including:
- Patient portal with secure messaging
- Appointment scheduling and calendar management
- Digital EMR and medical charting
- Practice analytics dashboard
- Automated SMS reminders
- AI-assisted patient triage

## 2. AUTOMATIC ENROLLMENT & SUBSCRIPTION TERMS
- **Automatic 14-day free trial** begins upon practice account creation
- Monthly subscription fee: $149.99/month plus processing fees
- Full feature access during trial period
- Billing automatically begins after 14-day trial period ends
- Add payment method before trial expires to continue service
- Cancel anytime with no penalties

## 3. PAYMENT TERMS
- Payment processed monthly on subscription anniversary
- Accepted payment methods: Credit card or ACH bank account
- Failed payments result in service suspension after 3-day grace period
- Automatic retry of failed payments

## 4. TRIAL PERIOD
- **14 days of full access** to all VitaLuxePro features
- No charges during trial period
- Payment method required before trial ends to avoid service interruption
- Automatic conversion to paid subscription after trial expires

## 5. CANCELLATION POLICY
- Cancel anytime through account settings
- No refunds for partial months
- Access continues until end of billing period
- Data export available for 30 days after cancellation

## 6. DATA AND PRIVACY
- All patient data remains HIPAA compliant
- Practice retains ownership of all data
- Data backup and security included
- Export capabilities available

## 7. SUPPORT AND UPDATES
- Email support included with subscription
- Regular feature updates at no additional cost
- System maintenance windows communicated in advance

## 8. ACCEPTABLE USE
- Practice must maintain appropriate licenses
- HIPAA compliance required
- No misuse of patient data
- Professional conduct standards apply

By creating a VitaLuxePro practice account, you agree to automatic enrollment in the 14-day free trial and these subscription terms.',
  version = version + 1,
  updated_at = NOW()
WHERE role = 'subscription'::app_role;