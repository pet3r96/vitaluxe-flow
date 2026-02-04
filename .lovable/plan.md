
# Add Multiple Users to a Pharmacy Account

## Overview

Currently, each pharmacy has a single master user (`user_id` column in the `pharmacies` table). The request is to allow the main pharmacy user to add additional users who have **full access** to everything the main user can do.

This follows the same pattern already implemented for **practices with staff** (`practice_staff` table).

---

## Current Architecture

| Entity | Single User | Multi-User Support |
|--------|-------------|-------------------|
| Practice (doctor) | `profiles.id` | ✅ Via `practice_staff` table |
| Pharmacy | `pharmacies.user_id` | ❌ Single user only |

**Key Files:**
- `practice_staff` table - links multiple users to a practice
- `AddStaffDialog.tsx` - UI for adding staff to practices
- `assign-user-role` edge function - handles user creation for all roles

---

## Proposed Solution

Create a **`pharmacy_staff`** table that mirrors the `practice_staff` pattern:

1. **New Database Table**: `pharmacy_staff`
2. **New Role**: Re-use existing `pharmacy` role OR add `pharmacy_staff` to enum
3. **Updated RLS Policies**: Allow pharmacy staff same access as pharmacy owner
4. **Updated Edge Functions**: Modify access checks to include pharmacy staff
5. **New UI Component**: `AddPharmacyStaffDialog.tsx`

---

## Database Changes

### 1. Create `pharmacy_staff` Table

```sql
CREATE TABLE public.pharmacy_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pharmacy_id uuid NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  role_type text NOT NULL DEFAULT 'staff',
  active boolean NOT NULL DEFAULT true,
  can_manage_orders boolean NOT NULL DEFAULT true,
  can_manage_shipping boolean NOT NULL DEFAULT true,
  can_view_api_config boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, pharmacy_id)
);

-- Enable RLS
ALTER TABLE pharmacy_staff ENABLE ROW LEVEL SECURITY;

-- Indexes for fast lookups
CREATE INDEX idx_pharmacy_staff_user_id ON pharmacy_staff(user_id);
CREATE INDEX idx_pharmacy_staff_pharmacy_id ON pharmacy_staff(pharmacy_id);
```

### 2. RLS Policies for `pharmacy_staff`

```sql
-- Admin full access
CREATE POLICY "admin_all_pharmacy_staff"
  ON pharmacy_staff FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Pharmacy owner can manage their staff
CREATE POLICY "pharmacy_owner_manage_staff"
  ON pharmacy_staff FOR ALL
  USING (
    pharmacy_id IN (
      SELECT id FROM pharmacies WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    pharmacy_id IN (
      SELECT id FROM pharmacies WHERE user_id = auth.uid()
    )
  );

-- Staff can view their own record
CREATE POLICY "pharmacy_staff_view_own"
  ON pharmacy_staff FOR SELECT
  USING (user_id = auth.uid());
```

### 3. Update `pharmacies` RLS to Include Staff

```sql
-- Drop and recreate pharmacy_manage_own_record to include staff
DROP POLICY IF EXISTS "pharmacy_manage_own_record" ON pharmacies;

CREATE POLICY "pharmacy_manage_own_record"
  ON pharmacies FOR ALL
  USING (
    user_id = auth.uid() 
    OR id IN (
      SELECT pharmacy_id FROM pharmacy_staff 
      WHERE user_id = auth.uid() AND active = true
    )
  )
  WITH CHECK (
    user_id = auth.uid() 
    OR id IN (
      SELECT pharmacy_id FROM pharmacy_staff 
      WHERE user_id = auth.uid() AND active = true
    )
  );
```

---

## Edge Function Updates

### 1. Update `idValidator.ts`

Add pharmacy staff lookup in `getUserPracticeId` pattern:

```typescript
// New helper function
async function getUserPharmacyId(supabase: any, userId: string): Promise<string | null> {
  // Check if user is pharmacy owner
  const { data: pharmacyOwner } = await supabase
    .from('pharmacies')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  
  if (pharmacyOwner) return pharmacyOwner.id;
  
  // Check if user is pharmacy staff
  const { data: staffRecord } = await supabase
    .from('pharmacy_staff')
    .select('pharmacy_id')
    .eq('user_id', userId)
    .eq('active', true)
    .maybeSingle();
  
  return staffRecord?.pharmacy_id || null;
}
```

### 2. Update `get-orders-page/index.ts`

Modify the pharmacy section to check both owner and staff:

```typescript
// Current code checks: .eq('user_id', practiceId)
// New code should also check pharmacy_staff table
```

### 3. Update `assign-user-role/index.ts`

Add handling for `pharmacy_staff` role creation similar to `staff` role.

---

## Frontend Changes

### 1. Create `AddPharmacyStaffDialog.tsx`

New component similar to `AddStaffDialog.tsx`:
- Email input
- Name input  
- Phone input
- Permission toggles (orders, shipping, API config)
- Creates user via `assign-user-role` edge function

### 2. Create `PharmacyStaffTable.tsx`

Display pharmacy staff members with:
- Name, email, status
- Active/inactive toggle
- Delete functionality

### 3. Update Pharmacy Profile/Dashboard

Add a "Team" section for pharmacy users to manage their staff.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/pharmacies/AddPharmacyStaffDialog.tsx` | Dialog for adding staff |
| `src/components/pharmacies/PharmacyStaffTable.tsx` | Table listing staff |
| `src/types/pharmacyStaff.ts` | TypeScript types |

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/_shared/idValidator.ts` | Add `getUserPharmacyId()` helper |
| `supabase/functions/get-orders-page/index.ts` | Include pharmacy staff in access check |
| `supabase/functions/pharmacy-order-action/index.ts` | Include pharmacy staff |
| `supabase/functions/assign-user-role/index.ts` | Handle `pharmacy_staff` role |
| `src/pages/Profile.tsx` | Add staff management section for pharmacy role |
| All edge functions that check `pharmacies.user_id` | Also check `pharmacy_staff` |

---

## Security Considerations

1. **Pharmacy staff get the `pharmacy` role** - This ensures existing RLS policies work
2. **Granular permissions via `pharmacy_staff` columns** - Control what each staff member can do
3. **Only pharmacy owner can add/remove staff** - Enforced via RLS policies
4. **Staff cannot elevate their own permissions** - Can only update non-permission fields

---

## Technical Notes

### Option A: Reuse `pharmacy` Role (Recommended)
- Pharmacy staff get `pharmacy` role in `user_roles`
- `pharmacy_staff` table tracks which pharmacy they belong to
- Simpler - no enum changes needed

### Option B: Add `pharmacy_staff` to Enum
- Requires database migration to add to `app_role` enum
- More complex - all role checks need updating
- Not recommended due to scope

---

## Implementation Order

1. Database migration (create table, policies)
2. Update `idValidator.ts` 
3. Update `get-orders-page` and other edge functions
4. Update `assign-user-role` edge function
5. Create frontend components
6. Add to pharmacy profile page
7. Testing

---

## Estimated Scope

- **Database**: 1 migration with table + policies
- **Edge Functions**: 4-5 functions to update
- **Frontend**: 3 new components + 1 page update
- **Testing**: End-to-end flow verification

This approach mirrors the proven `practice_staff` pattern, ensuring consistency and reliability.
