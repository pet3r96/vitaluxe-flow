

# Fix: DB Updates Silently Failing After VIOS Submission

## Confirmed: Quantity Was Correct
The dosage label `5mg/1mg/10mg/ml - 2mL` → regex extracts `2` → VIOS received `quantity: "2"`. VIOS accepted the order (ID: `122455182`). The quantity fix is working.

## Problem: Silent DB Failures
After VIOS accepts the order, the edge function updates the `order_lines` table and inserts into `pharmacy_order_transmissions` — but neither operation checks for errors. The Supabase client returns `{data, error}` instead of throwing, so errors go unnoticed. Current DB state: `pharmacy_order_id: null`, `status: pending`, and zero transmission records.

## Fix

### 1. `supabase/functions/send-vios-order/index.ts`
- Add error checking on the transmission insert (line 201) — log the actual error
- Add error checking on the order line update (line 221) — log the actual error and return a warning in the response
- This will surface the root cause so we can fix it

### 2. Immediate data fix
- Use the insert tool to update the order line with the correct pharmacy_order_id (`122455182`) and status (`sent_to_pharmacy`) since VIOS already accepted the order

## Scope
- 1 file changed: `send-vios-order/index.ts` (add error checking)
- 1 data update to fix the current order line

