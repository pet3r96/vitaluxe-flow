

## Add Disable/Enable Account for Pharmacy Staff

### Problem
The pharmacy staff table has a toggle switch that only updates the `pharmacy_staff.active` field (controlling data access via RLS). It does NOT disable the user's actual login account (`profiles.active`), so a "disabled" staff member can still log in. There is no way for a pharmacy owner to fully disable or enable a staff account.

### Solution

Add a `pharmacy-staff-status` action to the existing `manage-entity-status` backend function, and update the frontend toggle to call it. This will update both:
- `pharmacy_staff.active` (controls data access)
- `profiles.active` (controls login ability)

### Changes

**1. Backend: `supabase/functions/manage-entity-status/index.ts`**

Add a new `pharmacy-staff-status` case that:
- Verifies the caller is the pharmacy owner (checks `pharmacies.user_id` matches caller)
- Validates the target staff member belongs to that pharmacy
- Updates `pharmacy_staff.active` using admin client
- Updates `profiles.active` using admin client
- Skips the admin IP check (pharmacy owners aren't admins)

**2. Frontend: `src/components/pharmacies/PharmacyStaffTable.tsx`**

Update `toggleActiveMutation` to call the edge function instead of directly updating the database:
- Call `supabase.functions.invoke('manage-entity-status', { body: { action: 'pharmacy-staff-status', staffId, active } })`
- This ensures both the staff record and the user account are toggled together
- Add a clearer label next to the switch showing "Active" / "Disabled"

### What This Enables
- Pharmacy owners can fully disable a staff member's account (prevents login)
- Pharmacy owners can re-enable a disabled staff member
- The toggle in the Team Management table will now control actual account access, not just data visibility
