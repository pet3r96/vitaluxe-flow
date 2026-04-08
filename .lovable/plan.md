

# Fix: "No Patient Address on File" — Address Never Reaches Order Details

## Root Cause

Two layers of failure prevent the patient address from displaying:

### Bug 1: `place-order` never stores patient address on order lines
The `place-order` edge function creates order lines but never encrypts or saves the patient's address into `patient_address_encrypted`. It also never writes `formatted_shipping_address` on the order. So the primary data source for the "Ship to Patient" display is always null.

### Bug 2: Fallback query reads wrong column
The `OrderDetailsDialog` fallback (line 366) queries `patient_accounts.address` — but this column is **empty** for this patient. The actual address lives in split fields: `address_street`, `address_suite`, `address_city`, `address_state`, `address_zip`.

**Patient Renee Rodriguez has a full address**: 8750 East McDowell Road, Suite 113, Scottsdale, AZ 85257 — it's just never being read.

## Fixes

### 1. `src/components/orders/OrderDetailsDialog.tsx` — Fix fallback query (immediate fix)

Update the patient_accounts SELECT on line 366 to include the split address fields:

```
.select('id, user_id, first_name, last_name, email, phone, address_street, address_suite, address_city, address_state, address_zip, allergies')
```

Then in the fallback contact builder (lines 442-449), construct the full address from the split fields:

```typescript
const parts = [plainData.address_street, plainData.address_suite, plainData.address_city, plainData.address_state, plainData.address_zip].filter(Boolean);
patient_address: parts.join(', ') || null
```

### 2. `supabase/functions/place-order/index.ts` — Store patient address on order lines (prevents recurrence)

After resolving the patient for each order line, fetch the patient's address from `patient_accounts` and encrypt it into `patient_address_encrypted` using the same encryption pattern already used for `patient_email_encrypted` and `patient_phone_encrypted`. Also write `formatted_shipping_address` on the order record.

### 3. Backfill order ae8f1f44 — Write `formatted_shipping_address`

Run a one-time UPDATE on the orders table to set `formatted_shipping_address` for this order from the patient's known address.

## Summary
- Fix 1 is the immediate visual fix — the dialog will show the address from patient_accounts
- Fix 2 prevents this from happening on future orders by properly storing the address at order-creation time
- Fix 3 backfills the specific order so it works even before the dialog fix loads

