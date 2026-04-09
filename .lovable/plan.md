

# Fix: Display "Qty: 2mL x 3" for Injectable Orders

## Problem

When a patient orders 3 vials of a 2mL injectable, the system currently shows Rx Qty as just `2` (the mL per vial). The user wants **both** values shown — e.g., `Qty: 2mL x 3` — on both the prescription PDF and the order summary UI.

## Changes

### 1. `supabase/functions/generate-prescription-pdf/index.ts` (~line 276)

Update the quantity logic to combine per-vial volume with order quantity when both exist:

```typescript
quantity: (() => {
  const mlMatch = variantDosageLabel?.match(/[\-–]\s*(\d+)\s*mL/i);
  const orderQty = orderLine.quantity || 1;
  if (mlMatch) {
    const mlVol = parseInt(mlMatch[1]);
    // Show "2mL x 3" when ordering multiple vials
    return orderQty > 1 ? `${mlVol}mL x ${orderQty}` : mlVol;
  }
  return orderQty;
})(),
```

Then in the PDF rendering section where quantity is drawn, ensure it renders as a string (it may already since `doc.text()` accepts strings).

### 2. `src/components/orders/OrderDetailsDialog.tsx`

Add a **Volume** column next to the existing Qty column in the order lines table:

- **Qty**: The order quantity (number of vials, e.g., `3`)
- **Volume**: The per-unit mL extracted from `dosage_label` (e.g., `2mL`)

This gives two clear columns instead of one ambiguous number.

### 3. `src/components/products/PrescriptionWriterDialog.tsx`

Apply the same combined display logic when creating new prescriptions — if the cart quantity > 1 and the variant has an mL volume, format as `"2mL x 3"`.

## Scope
- 3 files changed
- No database/migration changes

