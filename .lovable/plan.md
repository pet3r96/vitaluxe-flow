

# Fix: Allow Patient Creation Without Email

## Problem

The "Add Patient" form correctly labels email as "Optional", but the `patient_accounts` database table has a `NOT NULL` constraint on the `email` column. When submitting without an email, the database rejects the insert with:

> null value in column "email" of relation "patient_accounts" violates not-null constraint

## Fix

**Database migration**: Alter the `patient_accounts` table to make the `email` column nullable.

```sql
ALTER TABLE public.patient_accounts ALTER COLUMN email DROP NOT NULL;
```

No code changes needed -- the form already handles email as optional and sends null when empty.

