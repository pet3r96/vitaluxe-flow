

# Link Patient to Practice Orders + Fix Remaining Suite Bug

## Overview

Add a "Link to Patient" dropdown on each order line when `ship_to = 'practice'`, using the existing patient CRM data. Also fix one remaining suite bug found during this audit.

---

## Remaining Suite Bug (Fix First)

### DeliveryConfirmation Edit Button Missing Suite
**File:** `src/pages/DeliveryConfirmation.tsx` (lines 586-594)

The "Edit" button passes `currentAddress` to the editor without `suite`:
```
currentAddress: {
  street: profile?.shipping_address_street || '',
  city: profile?.shipping_address_city || '',
  state: profile?.shipping_address_state || '',
  zip: profile?.shipping_address_zip || '',
  // MISSING: suite
}
```

**Impact:** When a user clicks "Edit" on the practice address, the suite field starts blank even though Suite 275 is stored. If they save without re-entering it, it gets wiped.

**Fix:** Add `suite: profile?.shipping_address_suite || ''` to the `currentAddress` object.

---

## Link Patient to Practice Orders

### What Changes

In `src/components/orders/OrderDetailsDialog.tsx`, for orders where `ship_to === 'practice'`, add a "Link to Patient" section on each order line. This lets practice staff assign a patient from their CRM after the order arrives at the practice.

### How It Works

1. When the order details dialog opens for a `ship_to = 'practice'` order, fetch the practice's patient list from `patient_accounts` (using the order's `doctor_id` as the practice ID, or the order's `practice_id` if available)
2. For each order line, show:
   - If no patient is linked: a Select dropdown with searchable patient names + a "Link to Patient" label
   - If a patient is already linked: the patient name with a "Change" button
3. On selection, update `order_lines` with `patient_id` and `patient_name` (first + last name)
4. Invalidate order query cache so the UI refreshes
5. Show success toast

### Technical Details

**No database changes needed** -- `order_lines.patient_id` (uuid, nullable) and `patient_name` (text) already exist.

**New query in OrderDetailsDialog:** Fetch patients only when `order.ship_to === 'practice'` and dialog is open:
```typescript
const { data: practicePatients } = useQuery({
  queryKey: ['practice-patients-for-linking', order.doctor_id],
  queryFn: async () => {
    const { data } = await supabase
      .from('patient_accounts')
      .select('id, first_name, last_name')
      .eq('practice_id', order.practice_id || order.doctor_id)
      .order('last_name');
    return data || [];
  },
  enabled: open && order.ship_to === 'practice',
});
```

**Update handler:** Simple inline function per order line:
```typescript
const handleLinkPatient = async (lineId: string, patient: { id: string, first_name: string, last_name: string }) => {
  const { error } = await supabase
    .from('order_lines')
    .update({
      patient_id: patient.id,
      patient_name: `${patient.first_name} ${patient.last_name}`
    })
    .eq('id', lineId);
  // invalidate + toast
};
```

**UI location:** Inside each order line card (lines 816-1008), add a new section after the grid but before the prescription section, only when `order.ship_to === 'practice'`:
```
Patient: Practice Order  [ Select Patient v ]
```

After linking:
```
Patient: John Smith  [x Clear]
```

**Access control:** Only `doctor`, `provider`, `staff`, and `admin` roles can link patients. Pharmacy role cannot.

**RLS:** Existing RLS on `order_lines` and `patient_accounts` already handles access. No new policies needed.

### Checkout/Shipping Flow -- No Changes

- The checkout flow (`Checkout.tsx`, `place-order` edge function) is unaffected. Practice orders continue to ship to the practice address from `profiles.shipping_address_*` fields.
- Patient linking happens post-order only, in the order details view. It does not change shipping destination, pricing, or any checkout logic.
- The `DeliveryConfirmation.tsx` page remains unchanged for this feature -- it already correctly shows practice shipping address with suite.

---

## Files Modified

| # | File | Change |
|---|------|--------|
| 1 | `src/pages/DeliveryConfirmation.tsx` | Add `suite` to edit button's `currentAddress` (1 line) |
| 2 | `src/components/orders/OrderDetailsDialog.tsx` | Add patient query, link handler, and Select UI for practice orders |

