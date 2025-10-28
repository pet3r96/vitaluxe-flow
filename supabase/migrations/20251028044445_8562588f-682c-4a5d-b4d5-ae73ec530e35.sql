-- Insert subscription terms (enum value now exists)
INSERT INTO public.terms_and_conditions (role, title, content, version, created_at, updated_at)
VALUES (
  'subscription'::app_role, 
  'VitaLuxePro Practice Development Terms',
  '# VITALUXEPRO SUBSCRIPTION AGREEMENT

## 1. SERVICE DESCRIPTION
VitaLuxePro provides a comprehensive virtual front desk and EMR-lite system including:
- Patient portal with secure messaging
- Appointment scheduling and calendar management
- Digital EMR and medical charting
- Practice analytics dashboard
- Automated SMS reminders
- AI-assisted patient triage

## 2. SUBSCRIPTION TERMS
- Monthly subscription fee: $250/month
- 7-day free trial period with full feature access
- No credit card required for trial
- Automatic billing begins after trial period ends
- Cancel anytime with no penalties

## 3. PAYMENT TERMS
- Payment processed monthly on subscription anniversary
- Accepted payment methods: Credit card or ACH bank account
- Failed payments result in service suspension after 3 days
- Automatic retry of failed payments

## 4. TRIAL PERIOD
- 7 days of full access to all VitaLuxePro features
- No charges during trial period
- Cancel before trial ends to avoid charges
- Automatic conversion to paid subscription after trial

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

By subscribing, you agree to these terms and conditions.',
  1,
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;