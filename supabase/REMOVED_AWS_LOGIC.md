# Removed AWS SES/SNS Logic - 2025-01-22

## Summary
Removed AWS-specific code for email (SES) and notifications (SNS).
All AWS SDK dependencies for email and SMS have been deprecated.

## ✅ Deleted Files
- ~~`supabase/functions/send-verification-email/index.ts`~~ - **RESTORED with Postmark (2025-01-22)**
- `supabase/functions/send-temp-password-email/index.ts` - AWS SES temp password emails (deprecated)
- `supabase/functions/send-welcome-email/index.ts` - AWS SES welcome emails (deprecated)

## ✅ Refactored Files
- `supabase/functions/send-2fa-code/index.ts`
  - ❌ Removed AWS SNS SMS sending logic
  - ✅ Preserved 2FA code generation and database storage
  - ✅ Preserved rate limiting logic
  - 🔧 TODO: Replace with Supabase/Twilio/GoHighLevel integration

- `supabase/functions/send-notification/index.ts`
  - ❌ Removed AWS SES email sending logic
  - ✅ Preserved Twilio SMS functionality (still active)
  - ✅ Preserved notification template logic and variable replacement
  - 🔧 TODO: Replace email sending with Supabase/Resend/SendGrid

## 🔒 Preserved Files (Not SES/SNS)
- `supabase/functions/get-s3-signed-url/index.ts` - S3 storage (untouched)
- `supabase/functions/upload-to-s3/index.ts` - S3 storage (untouched)

## 🧪 Test Results
- ✅ Verified no remaining usage of `@aws-sdk/client-ses`
- ✅ Verified no remaining usage of `@aws-sdk/client-sns`
- ✅ All Edge Functions still compile and deploy successfully
- ✅ S3 functionality (file storage) remains intact

## ✅ Env Vars to Remove
The following environment variables are **REMOVED** as of 2025-10-22:
- ~~`SES_FROM_EMAIL`~~ (deprecated - removed)
- ~~`SES_SOURCE_EMAIL`~~ (deprecated - removed)
- ~~`SNS_TOPIC_ARN`~~ (deprecated - removed)
- ~~Any `AWS_SES_*` variables~~ (deprecated - removed)
- ~~Any `AWS_SNS_*` variables~~ (deprecated - removed)

**Active AWS Secrets (S3 Storage Only)**:
- `AWS_REGION` (keep - used for S3)
- `AWS_ACCESS_KEY_ID` (keep - used for S3)
- `AWS_SECRET_ACCESS_KEY` (keep - used for S3)
- `S3_BUCKET_NAME` (keep - used for S3)

**Active Postmark Secrets (Email)**:
- `POSTMARK_API_KEY` (keep - used for all email sending)
- `POSTMARK_FROM_EMAIL` (keep - used for all email sending)

**Active Twilio Secrets (SMS Notifications)**:
- `TWILIO_ACCOUNT_SID` (keep - used for notification SMS)
- `TWILIO_AUTH_TOKEN` (keep - used for notification SMS)
- `TWILIO_PHONE_NUMBER` (keep - used for notification SMS)

## 📊 Impact Analysis

### What Still Works
- ✅ Twilio SMS notifications (in `send-notification`)
- ✅ S3 file storage and signed URL generation
- ✅ 2FA code generation and database storage
- ✅ Email verification token generation
- ✅ Notification template system and variable replacement

### What Needs Replacement
- ✅ **Email verification emails** - **REPLACED with Postmark (2025-01-22)**
- ✅ **Temp password emails** - **REPLACED with Postmark (2025-01-22)**
- ✅ **Password reset emails** - **REPLACED with Postmark (2025-01-22)**
- ✅ **Notification emails** - **REPLACED with Postmark (2025-10-22)**
- ⏸️ **2FA SMS delivery** - **DEFERRED** (codes stored in DB, no SMS sent)
- ~~Welcome emails~~ (deprecated, not needed)

## 🚀 Recommended Replacements

### For Email (SES Replacement)
- **Supabase Auth Emails** - Built-in email templates for verification
- **Resend** - Developer-friendly email API
- **SendGrid** - Enterprise email service

### For SMS (SNS Replacement)
- **Twilio** - Already integrated in `send-notification`
- **GoHighLevel (GHL)** - If already in use elsewhere
- **Supabase OTP** - Native SMS/WhatsApp 2FA

## 📝 Notes
- All abstraction layers remain intact
- Function signatures preserved where possible
- Email/SMS formatting logic remains for easy replacement
- No breaking changes to database schema or RLS policies
- Supabase and GHL integrations remain untouched
- Future replacements can be slotted into the same abstraction layers

## 🔗 Related Documentation
- See `supabase/functions/send-notification/index.ts` for Twilio SMS implementation (still active)
- See `supabase/functions/send-verification-email/index.ts` for Postmark email verification (active as of 2025-01-22)

---

## ✅ Postmark Integration (2025-01-22)

### Implemented
- **Function**: `supabase/functions/send-verification-email/index.ts`
- **Purpose**: Send account verification emails after user signup
- **Email Service**: Postmark (via `email/withTemplate` API)
- **Template Alias**: `verify-account`
- **Required Secrets**:
  - `POSTMARK_API_KEY` - Postmark Server API Token
  - `POSTMARK_FROM_EMAIL` - Verified sender address (`info@vitaluxeservices.com`)

### Flow
1. User signs up via `/auth` page
2. `assign-user-role` creates user with `status='pending_verification'`
3. `send-verification-email` generates UUID token (24-hour expiration)
4. Token stored in `email_verification_tokens` table
5. Postmark sends branded email with verification link
6. User clicks link → `verify-email` validates token → activates account

### Template Variables
- `{{product_name}}` - "Vitaluxe"
- `{{name}}` - User's name or "there"
- `{{action_link}}` - `https://app.vitaluxeservices.com/verify-email?token={uuid}`

### Audit Logging
All verification email sends are logged to `audit_logs` with:
- `action_type: 'verification_email_sent'`
- `entity_type: 'email_verification_tokens'`
- Postmark MessageID for tracking

---

## ✅ Notification Email Integration (2025-10-22)

### Implemented
- **Function**: `supabase/functions/send-notification/index.ts`
- **Purpose**: Send notification emails for system events, alerts, and user actions
- **Email Service**: Postmark (via `email/withTemplate` API)
- **Template Alias**: `notification-email`
- **Required Secrets**:
  - `POSTMARK_API_KEY` - Postmark Server API Token
  - `POSTMARK_FROM_EMAIL` - Verified sender address (`info@vitaluxeservices.com`)

### Flow
1. User triggers notification event (e.g., order status change, system alert)
2. Notification record created in `notifications` table
3. `send-notification` edge function called with `notification_id`
4. Function checks user's `notification_preferences` for email consent
5. Retrieves notification template from `notification_templates` if available
6. Replaces variables in email subject, body, and action URL
7. Postmark sends branded email with dynamic content
8. Function returns success status with email/SMS delivery results

### Template Variables
- `{{title}}` - Email subject/heading (from `emailSubject`)
- `{{message}}` - Main notification message (from `notification.message`)
- `{{html_body}}` - Pre-formatted HTML body with styling (from `emailBody`)
- `{{action_url}}` - Optional button link (from `notification.action_url`)
- `{{action_text}}` - Button text ("View Details")
- Additional custom variables from `notification.metadata` (spread operator)

### Variable Replacement System
The function uses a `replaceVariables()` helper to replace `{{key}}` placeholders:
- Fetches template from `notification_templates` by `template_key`
- Applies variables from `notification.metadata` to all text fields
- Supports dynamic content based on notification context (e.g., order ID, patient name)
- Falls back to default formatting if no template is found

### Audit Logging
All notification email sends are logged with:
- `action_type: 'notification_email_sent'` (via existing audit system)
- Postmark MessageID for delivery tracking
- Error messages if email fails (stored in `results.errors`)

### Example Template Structure
Create Postmark template with alias `notification-email`:
```mustache
{{title}}
{{{html_body}}}
{{#action_url}}<a href="{{action_url}}">{{action_text}}</a>{{/action_url}}
```

### SMS Integration (Twilio)
- SMS functionality remains active via Twilio API
- Controlled by `send_sms` parameter and `notification_preferences.sms_notifications`
- Uses same template system for SMS text content
- Independent from email delivery (both can be sent simultaneously)
