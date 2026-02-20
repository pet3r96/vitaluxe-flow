

# Fix: Move Bob Fasano from Erroneous Pharmacy to VIOS Staff

## Problem
Bob Fasano (`bob@completemedicareplan.com`) was added as a **new pharmacy** instead of being added as **staff at VIOS Compounding**. This created a phantom pharmacy record that shows up in the Pharmacy Management table.

## Current State (incorrect)
- `pharmacies` table has a record for "Bob Fasano" (id: `bf041787-8b58-470b-8375-e3b03c647fb9`)
- `user_roles` has `role: pharmacy` for his user ID -- this is actually correct for pharmacy staff
- No `pharmacy_staff` record links him to VIOS

## Fix (data-only, no code changes needed)

### Step 1: Add Bob Fasano as VIOS pharmacy staff
Insert into `pharmacy_staff`:
- `user_id`: `96791095-086b-4d9b-b040-92420fb8cdcb` (Bob Fasano)
- `pharmacy_id`: `d5e75179-e66c-450f-8cae-1f4df93b097c` (VIOS Compounding)
- `role_type`: `staff`
- `active`: true
- Default permissions: can_manage_orders=true, can_manage_shipping=true, can_view_api_config=false

### Step 2: Delete the erroneous pharmacy record
Delete from `pharmacies` where `id = 'bf041787-8b58-470b-8375-e3b03c647fb9'`

### Step 3: Keep user_roles as-is
His role stays `pharmacy` -- this is correct. The `pharmacy_staff_access()` function and RLS policies use this role combined with the `pharmacy_staff` table to grant access to VIOS data.

## Result
- Bob Fasano will no longer appear as a separate pharmacy
- He will have staff-level access to the VIOS Compounding dashboard
- Only VIOS Compounding will show in the Pharmacy Management table

## No code changes required
This is purely a data correction. The existing pharmacy staff system already handles multi-user access correctly.
