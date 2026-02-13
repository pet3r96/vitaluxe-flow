

## Add "Days Supply" Field to Prescription Flow

### What's Changing
Adding a required "Days Supply" field next to the SIG field in the prescription step. The doctor will manually enter how many days the medication will last (e.g., 30, 60, 90). This value gets sent to the pharmacy (VIOS) with the order.

### Why Manual Entry (Not Auto-Calculated)
Auto-calculating days supply from quantity and SIG instructions is unreliable because:
- Injections, creams, and liquids don't follow simple "tablets per day" math
- SIG text is free-form and hard to parse programmatically
- Pharmacies require accurate days supply for compliance -- a wrong number causes rejections

A simple numeric input that the prescriber fills in is the safest, most accurate approach.

### Changes

**1. Database Migration** -- Add `days_supply` column to both tables

- Add `days_supply INTEGER` (nullable) to `cart_lines`
- Add `days_supply INTEGER` (nullable) to `order_lines`

**2. PatientSelectionDialog.tsx** -- Add Days Supply input field

- Add `daysSupply` state variable (string, for input handling)
- Add a numeric input field labeled "Days Supply *" right after the SIG field
- Make it mandatory: validate that it's a positive number before allowing "Add to Cart"
- Pass the value through the `onAddToCart` callback
- Reset it on dialog close

**3. Cart/Order Flow** -- Carry the value through

- Update `CartLine` type in `src/types/domain/cart.ts` to include `days_supply`
- Update the `manage-cart` edge function to accept and store `days_supply`
- Update `place-order` edge function to copy `days_supply` from cart line to order line

**4. VIOS Order Payload** -- Send `daysSupply` to pharmacy

- In `supabase/functions/_shared/vios/viosOrders.ts`, add `daysSupply` to the `rxs` block in `buildViosOrderPayload`:
  ```
  daysSupply: orderLine.days_supply || undefined
  ```

**5. PrescriptionWriterDialog.tsx** -- Add Days Supply field there too

- Add Days Supply input to the prescription writer form so it's captured when writing a full prescription
- Pass it back through the `onPrescriptionGenerated` callback

### Technical Details

- Database columns: `days_supply INTEGER` on both `cart_lines` and `order_lines` (nullable for backward compatibility)
- Validation: must be a positive integer between 1 and 365
- VIOS payload location: `rxs[0].daysSupply` (number type per VIOS API spec)
- The field will appear as a small numeric input (width ~100px) with placeholder "e.g., 30"

