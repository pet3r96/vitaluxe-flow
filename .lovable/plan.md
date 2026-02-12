

# Request Medication Feature -- Full Plan

## Overview

Practice, provider, and staff users get a "Don't see a product?" floating button on the Products page. Clicking it opens a dialog to request a medication (name, dosage, ingredients). The request is stored in `pending_product_requests` and shown to admins with the requesting practice name.

---

## Database Migration

Add three new columns to `pending_product_requests`:

```sql
ALTER TABLE pending_product_requests
  ADD COLUMN IF NOT EXISTS ingredients text,
  ADD COLUMN IF NOT EXISTS request_source text NOT NULL DEFAULT 'pharmacy',
  ADD COLUMN IF NOT EXISTS practice_id uuid REFERENCES profiles(id);
```

- `ingredients` -- free-text field for requested ingredients
- `request_source` -- `'pharmacy'` or `'practice'` to distinguish origin
- `practice_id` -- links to the practice that submitted the request (null for pharmacy requests)

No new RLS policies are needed. The existing policies already handle:
- Any authenticated user can INSERT where `created_by_user_id = auth.uid()`
- Admins can view/update all rows
- Users can view their own rows

---

## New File: `src/components/products/RequestMedicationDialog.tsx`

A dialog with:
- **Medication Name** (required, text input)
- **Dosage** (required, text input)
- **Ingredients Requested** (required, textarea)
- **Additional Notes** (optional, textarea -- maps to `description` column)

On submit, inserts into `pending_product_requests`:
- `created_by_user_id` = current user's `effectiveUserId`
- `practice_id` = current user's `effectivePracticeId`
- `pharmacy_id` = null
- `request_source` = `'practice'`
- `ingredients` = form value
- `vitaluxe_price` = null (not relevant for practice requests)
- `status` = `'pending'`

The practice ID is available from `AuthContext.effectivePracticeId` (already resolved for provider and staff roles).

---

## Modified File: `src/components/products/ProductsGrid.tsx`

Add a floating action button in the bottom-right area, visible when `isProvider || (isStaffAccount && staffCanOrder)`:

- Icon: `HelpCircle` or `Pill` from lucide-react
- Label: "Don't see a product?"
- Positioned as a fixed/sticky button at the bottom-right of the products area
- Opens `RequestMedicationDialog`

Changes:
1. Import `RequestMedicationDialog` and add state for dialog open/close
2. Add the FAB button near the cart button area (line ~911-949) or as a fixed-position element
3. Wire up the dialog

---

## Modified File: `src/components/admin/PendingProductsApproval.tsx`

Add two new columns to the admin table:

1. **Source** column -- shows badge "Practice" or "Pharmacy"
2. **Practice** column -- shows the practice name for practice-sourced requests

Update the data enrichment query to also fetch practice name:
```typescript
// For practice-sourced requests, fetch practice name
if (request.practice_id) {
  const { data: practice } = await supabase
    .from("practices")
    .select("name")
    .eq("id", request.practice_id)
    .single();
  return { ...request, practice_name: practice?.name || "Unknown" };
}
```

Also show the `ingredients` field in the table or review dialog.

---

## Modified File: `src/components/admin/PendingProductEditDialog.tsx`

Add a read-only "Ingredients Requested" field to the review dialog, displayed when `request.ingredients` exists. Also show "Source" and "Practice" info in the header section alongside the existing Pharmacy/Requested By fields.

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| Database migration | Create | Add `ingredients`, `request_source`, `practice_id` columns |
| `src/components/products/RequestMedicationDialog.tsx` | Create | Dialog for practice users to request medications |
| `src/components/products/ProductsGrid.tsx` | Modify | Add floating "Don't see a product?" button for providers/staff |
| `src/components/admin/PendingProductsApproval.tsx` | Modify | Add Source, Practice columns and ingredients display |
| `src/components/admin/PendingProductEditDialog.tsx` | Modify | Show ingredients, source, practice in review dialog |

---

## Technical Details

### Permissions
- **Who sees the button**: `provider`, `doctor`, and `staff` (with ordering privileges)
- **Who does NOT see it**: `admin`, `pharmacy`, `topline`, `downline`, `patient`
- **RLS**: Already covered -- `created_by_user_id = auth.uid()` for INSERT, admin policies for SELECT/UPDATE

### Practice Resolution
- `effectivePracticeId` from AuthContext is already resolved for both provider and staff users
- For staff users, it comes from `practice_staff.practice_id`
- For provider users, it comes from `providers.practice_id`
- This is stored in `pending_product_requests.practice_id` so admins can see which practice made the request

### Admin Review Flow
- Admin sees all requests in the existing Pending Products panel
- New "Source" badge distinguishes pharmacy vs practice requests
- Practice name is displayed for practice-sourced requests
- Ingredients field is shown in the review dialog
- Approval/rejection workflow remains unchanged

