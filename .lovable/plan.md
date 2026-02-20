

# Fix: User Deletion Blocked by Foreign Key Constraints

## Root Cause

When deleting user "Demo Pharmacy 1", the cascade chain hits a wall:

```text
auth.users (DELETE)
  -> profiles (CASCADE - deleted)
    -> pharmacies (CASCADE - tries to delete)
      -> order_lines (NO ACTION - 66 rows BLOCK deletion!)
```

There are also 16 other `NO ACTION` foreign keys on `auth.users` that will block future deletions for any user who has records in those tables. And the cleanup function references a non-existent `active_sessions` table.

## Fix (2 changes)

### 1. Database Migration: Change all blocking FK constraints to SET NULL

These are "reference" columns (like `cancelled_by`, `uploaded_by`, `assigned_pharmacy_id`) -- historical audit data that should be preserved but should not block deletion. Changing them to `SET NULL` means the column becomes NULL when the referenced row is deleted, but the record itself is kept.

**auth.users references (16 constraints):**

| Table | Column | Current | New |
|-------|--------|---------|-----|
| orders | cancelled_by | NO ACTION | SET NULL |
| patient_documents | uploaded_by | NO ACTION | SET NULL |
| provider_documents | uploaded_by | NO ACTION | SET NULL |
| provider_document_assignments | created_by | NO ACTION | SET NULL |
| terms_and_conditions | created_by | NO ACTION | SET NULL |
| terms_and_conditions | updated_by | NO ACTION | SET NULL |
| prescription_refills | refilled_by | NO ACTION | SET NULL |
| user_2fa_settings | reset_requested_by | NO ACTION | SET NULL |
| system_settings | updated_by | NO ACTION | SET NULL |
| video_session_guest_links | created_by | NO ACTION | SET NULL |
| checkout_attestation | updated_by | NO ACTION | SET NULL |
| patient_portal_terms | updated_by | NO ACTION | SET NULL |
| provider_document_patients | assigned_by | NO ACTION | SET NULL |
| video_usage_pricing | created_by | NO ACTION | SET NULL |
| pharmacy_order_transmissions | retried_by | NO ACTION | SET NULL |
| video_sessions | created_by_user_id | NO ACTION | SET NULL |

**pharmacies references (5 constraints):**

| Table | Column | Current | New |
|-------|--------|---------|-----|
| order_lines | assigned_pharmacy_id | NO ACTION | SET NULL |
| cart_lines | assigned_pharmacy_id | NO ACTION | SET NULL |
| pharmacy_webhook_events | pharmacy_id | NO ACTION | SET NULL |
| pharmacy_shipping_rates | pharmacy_id | NO ACTION | CASCADE |
| pharmacy_order_jobs | pharmacy_id | NO ACTION | CASCADE |

### 2. Edge Function: Fix cleanup-test-data/index.ts

- Remove the reference to non-existent `active_sessions` table (line 317)
- Add `notification_preferences` cleanup before auth deletion
- Add `user_2fa_settings` cleanup before auth deletion

## Why SET NULL is Safe

These columns are all audit/reference fields ("who cancelled this order?", "who uploaded this document?"). The actual data (order, document, etc.) should be preserved even if the user is deleted. Setting the reference to NULL simply means "deleted user" while keeping the historical record intact.

## Files Changed

| File | Change |
|------|--------|
| New database migration | Change 21 FK constraints from NO ACTION to SET NULL/CASCADE |
| `supabase/functions/cleanup-test-data/index.ts` | Remove `active_sessions`, add `notification_preferences` and `user_2fa_settings` cleanup |

