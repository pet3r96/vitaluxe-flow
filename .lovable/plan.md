

## Make SIG (Directions for Use) Mandatory and Fix Dosage Display

### Problem
1. The "Dosage Instructions" field shows "Not specified" because it pulls from `product.dosage` (which is often empty) instead of the **selected variant's dosage_label** (e.g., "1 MG - 30ct").
2. The "SIG - Directions for Use" field is not enforced as mandatory in the patient selection flow -- the prescriber/signer must fill this in (e.g., "Take 1 tablet 1x a day at night with food").

### Changes

**1. PatientSelectionDialog.tsx** -- Fix dosage display and make SIG required

- When transitioning to the prescription step, populate `customDosage` from the **selected variant's `dosage_label`** instead of the product-level `dosage` field.
- Add a computed `selectedVariant` derived from `selectedVariantId` and `variants`.
- Update the dosage display to show: `{product.name} - {selectedVariant.dosage_label}` (e.g., "BIEST (50:50) (RDT) - 1 MG - 30ct").
- Change the helper text from "This value is from the product configuration" to "Selected dosage variant".
- Make the SIG field **mandatory**: add validation that blocks the "Add to Cart" / "Continue" action if SIG is empty, with an error toast.
- Add a red asterisk (*) to the SIG label to indicate it's required.

**2. PrescriptionWriterDialog.tsx** -- Keep dosage read-only, ensure SIG validation

- The dosage field already shows correctly from `initialDosage` (which will now be the variant label).
- SIG is already marked with * and `required` -- no changes needed here.

### Technical Details

- Derive `selectedVariant` with: `const selectedVariant = variants?.find(v => v.id === selectedVariantId);`
- In the `handleProceedToPrescription` function (~line 360-366), change the dosage initialization:
  ```
  // Before: setCustomDosage(product.dosage)
  // After: use variant dosage_label
  const variantLabel = selectedVariant?.dosage_label;
  setCustomDosage(variantLabel || product?.dosage || '');
  ```
- In `handleAddToCart` validation (~line 371+), add:
  ```
  if (!customSig?.trim()) {
    toast.error("SIG - Directions for Use is required");
    return;
  }
  ```
- Update the SIG label from `"SIG - Directions for Use"` to `"SIG - Directions for Use *"` to match PrescriptionWriterDialog.

