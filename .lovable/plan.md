

# Fix: Prescription PDF Wrong for Patient Order (Renee Rodriguez)

## Problems

1. **PDF shows "DISPENSING IN OFFICE ONLY"** for an order that is `ship_to = 'patient'`. The stored prescription filename is `prescription_OFFICE_DISPENSING_*`, confirming it was generated incorrectly at the time of ordering. The order record says `ship_to: patient` but the prescription was created as if it were a practice/office order.

2. **Medication name overflows the box** — no `maxWidth` constraint on the medication text (line 500), so "Semaglutide/Methylcobalamin/Glycine 5mg/1mg/10mg" bleeds past the box border.

3. **Sig text overlaps with Quantity** — long SIG directions wrap but Quantity is placed at a fixed Y offset, causing text collision.

## Root Cause of Bug #1

In `PatientSelectionDialog.tsx` line 1140:
```
patient={shipTo === 'practice' ? null : selectedPatient}
```

If `selectedPatient` was null/undefined when the prescription was written, OR if `shipTo` defaulted to `'practice'`, the PrescriptionWriterDialog sets `is_office_dispensing: !patient` (line 254) = `true`, producing the wrong PDF.

Additionally, when the `PharmacyShippingWorkflow` regenerates a prescription via `order_line_id`, line 209 correctly reads `ship_to` from the orders table — but the **original** prescription stored on this order was generated via the dialog path, not the order_line_id path, and it got it wrong.

## Fixes

### 1. `supabase/functions/generate-prescription-pdf/index.ts` — Medication box overflow
- Add `maxWidth: 4.3` to the medication name `doc.text()` call at line 500 so text wraps inside the box
- Increase the medication box height from `0.6` to `0.9` to accommodate wrapped text
- Adjust the Sig/Quantity Y positions to be relative to the taller box

### 2. `supabase/functions/generate-prescription-pdf/index.ts` — Dynamic Sig/Quantity positioning
- After rendering the SIG text, calculate how many lines it occupied using `doc.getTextDimensions()` or estimate based on text length
- Position "Quantity:" dynamically below the SIG instead of at a fixed offset

### 3. Regenerate Renee Rodriguez's prescription
- Use the `PharmacyShippingWorkflow` path (order_line_id mode) which correctly reads `ship_to` from the `orders` table
- This will produce a PDF with patient info (name, DOB, address) instead of "DISPENSING IN OFFICE ONLY"
- Update the `prescription_url` on the order line to point to the new PDF

### 4. `src/components/products/PrescriptionWriterDialog.tsx` — Prevent recurrence
- Pass `shipTo` as an explicit prop instead of inferring `is_office_dispensing` from `!patient`
- Change line 254 from `is_office_dispensing: !patient` to use the explicit `shipTo` value passed from the parent
- This ensures even if `patient` object is temporarily null during loading, the dispensing type is determined by the user's explicit ship-to selection

### 5. `src/components/products/PatientSelectionDialog.tsx` — Pass shipTo
- Add `shipTo` prop to PrescriptionWriterDialog invocation at line 1140
- Still pass `patient={shipTo === 'practice' ? null : selectedPatient}` for the patient data, but dispensing type is now controlled by `shipTo` directly

## Files Changed
- `supabase/functions/generate-prescription-pdf/index.ts` (medication box sizing, dynamic positioning)
- `src/components/products/PrescriptionWriterDialog.tsx` (use explicit shipTo prop)
- `src/components/products/PatientSelectionDialog.tsx` (pass shipTo prop)
- Database: regenerate and update prescription for order line `95d9e316`

