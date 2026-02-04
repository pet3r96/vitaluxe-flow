

# Audit Results: Pharmacy Staff Multi-User Implementation

## Summary

The implementation has been reviewed and several critical issues have been identified that will prevent the pharmacy staff feature from working correctly.

---

## Issues Found

### CRITICAL: Missing RLS Policies for Pharmacy Staff

**Problem**: The RLS policies on multiple tables only check for `pharmacies.user_id = auth.uid()` - they do NOT include the `pharmacy_staff` table. This means pharmacy staff members will be BLOCKED from accessing data at the database level.

**Affected Tables and Policies:**

| Table | Policy Name | Current Check |
|-------|-------------|---------------|
| `orders` | `pharmacy_view_orders` | `pharmacies.user_id = auth.uid()` |
| `orders` | `pharmacy_update_orders` | `pharmacies.user_id = auth.uid()` |
| `order_lines` | `pharmacy_view_lines` | `pharmacies.user_id = auth.uid()` |
| `order_lines` | `pharmacy_update_lines` | `pharmacies.user_id = auth.uid()` |
| `order_status_history` | `Pharmacies can view assigned order status history` | `pharmacies.user_id = auth.uid()` |
| `pharmacy_order_jobs` | `pharmacy_jobs_select_assigned` | `pharmacies.user_id = auth.uid()` |
| `pharmacy_order_jobs` | `pharmacy_jobs_update_assigned` | `pharmacies.user_id = auth.uid()` |
| `pharmacy_order_transmissions` | `Pharmacies can view their own transmissions` | `pharmacies.user_id = auth.uid()` |
| `pharmacy_shipping_rates` | `Pharmacies manage their shipping rates` | `pharmacies.user_id = auth.uid()` |
| `pharmacy_tracking_updates` | `Pharmacies can view their own tracking updates` | `pharmacies.user_id = auth.uid()` |
| `support_tickets` | `Pharmacies can view/update their support tickets` | `pharmacies.user_id = auth.uid()` |
| `support_ticket_replies` | `Users can view replies to accessible tickets` | `pharmacies.user_id = auth.uid()` |
| `pharmacy_idempotency_keys` | `Admins can view idempotency keys` | `pharmacies.user_id = auth.uid()` |

**Required Fix**: Each policy needs to be updated to also check the `pharmacy_staff` table:

```sql
-- Pattern for updated policy check:
(
  -- Original owner check
  pharmacies.user_id = auth.uid() 
  OR 
  -- New: Staff check
  pharmacies.id IN (
    SELECT pharmacy_id FROM pharmacy_staff 
    WHERE user_id = auth.uid() AND active = true
  )
)
```

---

### CRITICAL: PharmacyProfileForm Only Shows for Owner

**Problem**: The `PharmacyProfileForm` component queries pharmacy data using:
```typescript
.eq("user_id", effectiveUserId)
```

This will return no results for pharmacy staff members.

**File**: `src/components/profile/PharmacyProfileForm.tsx` (lines 82-86)

**Required Fix**: Update to also check `pharmacy_staff`:
```typescript
// First check if user is pharmacy owner
const { data: owned } = await supabase
  .from("pharmacies")
  .select("*")
  .eq("user_id", effectiveUserId)
  .maybeSingle();

if (owned) return owned;

// Check if user is pharmacy staff
const { data: staffRecord } = await supabase
  .from("pharmacy_staff")
  .select("pharmacy_id")
  .eq("user_id", effectiveUserId)
  .eq("active", true)
  .maybeSingle();

if (staffRecord?.pharmacy_id) {
  const { data: pharmacy } = await supabase
    .from("pharmacies")
    .select("*")
    .eq("id", staffRecord.pharmacy_id)
    .single();
  return pharmacy;
}
```

---

### MODERATE: `pharmacy_staff` Table Has User-Level Unique Constraint

**Observation**: The `pharmacy_staff` table has a unique constraint on `(user_id, pharmacy_id)`, but the upsert in `assign-user-role/index.ts` uses:
```typescript
{ onConflict: 'user_id,pharmacy_id' }
```

This is correct, but the issue is that if a user is already staff at one pharmacy and gets added to another, it will work. However, a single user can only be staff at one pharmacy at a time based on how the system is designed (edge functions only return the first match with `.maybeSingle()`).

**Status**: This is acceptable behavior but should be documented.

---

### LOW: Missing Role Check for Staff in Profile Routes

**Observation**: The AuthContext correctly tracks `isStaffAccount` for practice staff, but there's no equivalent `isPharmacyStaffAccount` flag for pharmacy staff.

**Impact**: Not critical since the `pharmacy` role is assigned, but may cause confusion in UI/logic that differentiates owners from staff.

---

## What's Working Correctly

| Component | Status |
|-----------|--------|
| Database Migration | Table created with correct schema and indexes |
| `pharmacy_staff` RLS Policies | Admin, owner, and self-view policies are correct |
| `pharmacies` RLS Policy | Updated to include staff access |
| `idValidator.ts` | `getUserPharmacyId()` correctly checks both owner and staff |
| `get-orders-page/index.ts` | Correctly checks both pharmacy owner and staff |
| `pharmacy-order-action/index.ts` | Correctly checks both pharmacy owner and staff |
| `assign-user-role/index.ts` | Creates `pharmacy_staff` record with correct permissions |
| `AddPharmacyStaffDialog` | Correctly sends `pharmacy_staff` role with permissions |
| `PharmacyStaffTable` | Correctly displays staff with permissions |
| `PharmacyTeamSection` | Correctly identifies owner vs staff for UI |

---

## Required Migration to Fix RLS Policies

A new database migration is needed to update all affected RLS policies:

```sql
-- Create helper function for pharmacy staff access check
CREATE OR REPLACE FUNCTION public.pharmacy_staff_access(pharmacy_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM pharmacy_staff
    WHERE pharmacy_id = pharmacy_uuid
      AND user_id = auth.uid()
      AND active = true
  )
$$;

-- Update orders policies
DROP POLICY IF EXISTS "pharmacy_view_orders" ON orders;
CREATE POLICY "pharmacy_view_orders" ON orders FOR SELECT
USING (
  has_role(auth.uid(), 'pharmacy'::app_role) AND (
    EXISTS (
      SELECT 1 FROM order_lines ol
      JOIN pharmacies ph ON ph.id = ol.assigned_pharmacy_id
      WHERE ol.order_id = orders.id 
      AND (ph.user_id = auth.uid() OR pharmacy_staff_access(ph.id))
    )
  )
);

-- Similar updates needed for all other affected policies...
```

---

## Implementation Plan

### Phase 1: Database Migration (Critical)
1. Create `pharmacy_staff_access()` helper function
2. Update all 13+ affected RLS policies to use the helper function
3. Test that pharmacy staff can view/update orders

### Phase 2: Frontend Fixes
1. Update `PharmacyProfileForm` to handle staff users
2. Consider adding `isPharmacyStaffAccount` flag to AuthContext

### Phase 3: Testing
1. Create test pharmacy staff member
2. Verify staff can:
   - View pharmacy profile page
   - View orders assigned to their pharmacy
   - Update order statuses (hold/decline)
   - Access team management section (read-only)
3. Verify staff CANNOT:
   - Add other staff members
   - Delete staff members
   - Modify pharmacy settings

---

## Files Requiring Changes

| File | Change Type | Priority |
|------|-------------|----------|
| New SQL Migration | Create helper function + update 13 policies | CRITICAL |
| `src/components/profile/PharmacyProfileForm.tsx` | Update query logic for staff | HIGH |
| `src/contexts/AuthContext.tsx` (optional) | Add `isPharmacyStaffAccount` flag | LOW |

