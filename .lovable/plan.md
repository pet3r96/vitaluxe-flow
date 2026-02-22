
# Add "Link to Patient" Dropdown on Ship-to-Practice Orders (At Cart Time)

## What This Does
When a user selects "Ship to My Practice" in the Add Product to Cart dialog, a new optional "Link to Patient" dropdown appears below the practice shipping info. This lets users associate a patient from their CRM with the order line at the time of adding to cart, instead of having to do it later from the Orders page.

## Current Behavior
- Selecting "Ship to My Practice" shows only: "This product will be shipped to your practice address on file."
- `patientId` is passed as `null` and `patientName` is hardcoded to `"Practice Order"`

## Changes

### 1. PatientSelectionDialog.tsx -- Add Optional Patient Dropdown for Practice Orders
**File:** `src/components/products/PatientSelectionDialog.tsx`

In the `shipTo === 'practice'` section (lines 814-821), add a patient combobox dropdown below the existing info alert. This reuses the same patient data already fetched (the `patients` query on line 157).

Add a new state variable:
```typescript
const [practiceLinkedPatientId, setPracticeLinkedPatientId] = useState("");
```

Replace the practice-only Alert block (lines 814-821) with:
- The existing info alert (kept)
- A new "Link to Patient (Optional)" combobox using the same patient list and same style as the existing patient combobox above it
- A "Clear" button if a patient is selected

Reset `practiceLinkedPatientId` to `""` in the `useEffect` that runs when `open` changes (line 288-310).

### 2. PatientSelectionDialog.tsx -- Pass Linked Patient Through onAddToCart
**File:** `src/components/products/PatientSelectionDialog.tsx` (line 473)

Change the `onAddToCart` call to pass the linked patient when shipping to practice:
```typescript
// Before:
isPracticeOrder ? null : selectedPatientId

// After:
isPracticeOrder ? (practiceLinkedPatientId || null) : selectedPatientId
```

### 3. ProductsGrid.tsx -- Use Linked Patient Info for Practice Orders
**File:** `src/components/products/ProductsGrid.tsx` (lines 645-668)

When `shipToPractice` is true AND `patientId` is not null (meaning a patient was linked):
- Fetch the patient record from `patient_accounts` (same as the patient order path)
- Use their name as `patientName` instead of "Practice Order"
- Pass their `patientId` to the cart
- Keep everything else the same (practice shipping address, practice destination state -- shipping still goes to the practice)

```typescript
// In the shipToPractice block, before the manage-cart call:
let practicePatientName = "Practice Order";
let practicePatientId = null;

if (patientId) {
  const { data: linkedPatient } = await supabase
    .from("patient_accounts")
    .select("id, name, first_name, last_name")
    .eq("id", patientId)
    .single();
  if (linkedPatient) {
    practicePatientName = linkedPatient.name || `${linkedPatient.first_name} ${linkedPatient.last_name}`;
    practicePatientId = linkedPatient.id;
  }
}

// Then in manage-cart body:
patientId: practicePatientId,
patientName: practicePatientName,
```

This does NOT change the shipping destination -- the order still ships to the practice address. It only links the patient record for tracking purposes.

## Files Modified

| # | File | Change |
|---|------|--------|
| 1 | `src/components/products/PatientSelectionDialog.tsx` | Add optional patient dropdown in practice shipping section, pass linked patient ID |
| 2 | `src/components/products/ProductsGrid.tsx` | Use linked patient name/ID when provided for practice orders |
