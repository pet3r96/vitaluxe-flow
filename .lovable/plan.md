

## Fix: Terms Agreement Blocking User Login

### Problem
User "bob" (and potentially all non-admin users) cannot proceed past the terms agreement screen because of database column mismatches causing the edge function to fail.

### Root Causes

**1. Edge function `generate-terms-pdf` inserts non-existent columns (CRITICAL)**

At line 555-576, the upsert into `user_terms_acceptances` includes `signature_name` and `status` -- neither column exists in the table. The actual columns are: `id, user_id, terms_id, role, version, accepted_at, ip_address, user_agent, pdf_url, created_at`.

**2. Frontend `SignedAgreementSection` queries wrong column name**

The component queries `terms_version` (lines 30 and 39) but the actual column is `version`. This causes the profile page signed agreement section to error.

### Fix

**File 1: `supabase/functions/generate-terms-pdf/index.ts` (lines 555-576)**

Remove `signature_name` and `status` from the upsert object:

```typescript
const { data: acceptance, error: acceptanceError } = await supabase
  .from('user_terms_acceptances')
  .upsert(
    {
      user_id: targetUserId,
      terms_id: terms.id,
      role: userRole,
      version: terms.version,
      pdf_url: fileName,
      ip_address: ipAddress,
      user_agent: userAgent,
      accepted_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id,terms_id',
      ignoreDuplicates: false,
    },
  )
  .select()
  .single();
```

**File 2: `src/components/profile/SignedAgreementSection.tsx`**

Change `terms_version` to `version` in both queries (lines 30 and 39), and update the reference at line 128 from `termsData.terms_version` to `termsData.version`.

**Deployment:** Redeploy `generate-terms-pdf` edge function.

### Impact
- Fixes all users being blocked at terms acceptance (not just "bob")
- Fixes the Signed Agreement section on every user's profile page
- No database migration needed -- the table schema is correct, only the code references are wrong

