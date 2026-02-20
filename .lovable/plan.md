

# Fix: Verification Email Failing -- Missing Database Table

## Problem
The new practice that signed up (user ID `4a6ca268-c18e-44bb-9213-80183fdd1726`) **did NOT receive a verification email**. The `send-verification-email` function failed 3 times because it tries to insert into a table called `email_verification_tokens` which does not exist in the database.

Log evidence:
```
[send-verification-email] Failed to insert token  error: [object Object]
```

## Fix (2 steps)

### Step 1: Create the missing `email_verification_tokens` table

Create the table with the same structure as the existing token tables (`temp_password_tokens`, `password_reset_tokens`):

```sql
CREATE TABLE public.email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast token lookups
CREATE INDEX idx_email_verification_tokens_token ON public.email_verification_tokens(token);
CREATE INDEX idx_email_verification_tokens_user_id ON public.email_verification_tokens(user_id);

-- Enable RLS
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role (edge functions) should access this table
-- No public policies needed since all access goes through admin client in edge functions
```

### Step 2: Re-send the verification email to the practice that just signed up

After the table is created, manually trigger the verification email for user `4a6ca268-c18e-44bb-9213-80183fdd1726` by calling the `send-verification-email` edge function directly, so the new practice gets their verification link without having to sign up again.

## Why this happened
The `send-verification-email` edge function was written to use an `email_verification_tokens` table, but the corresponding database migration to create that table was never run. The other token tables (`temp_password_tokens` for welcome emails, `password_reset_tokens` for password resets) exist and work fine -- this one was simply missed.

## No code changes needed
The edge function code is correct. Only the database table needs to be created, then the email re-sent.

