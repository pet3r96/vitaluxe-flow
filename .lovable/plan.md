

# Fix: Transmission Logging Fails Due to NULL pharmacy_id

## Root Cause
The `pharmacy_order_transmissions.pharmacy_id` column is `NOT NULL`, but the edge function passes `orderLineData.assigned_pharmacy_id` which is `null` when no pharmacy is explicitly assigned. The insert silently fails with a constraint violation.

## Fix

### 1. `supabase/functions/send-vios-order/index.ts` (line 181 & 204)

Look up the VIOS pharmacy ID from the `pharmacies` table as a fallback when `assigned_pharmacy_id` is null:

```typescript
// Line 180-181: resolve pharmacy ID
let pharmacyId = orderLineData.assigned_pharmacy_id || null;
if (!pharmacyId) {
  const { data: viosPharmacy } = await supabaseAdmin
    .from("pharmacies")
    .select("id")
    .ilike("name", "%vios%")
    .limit(1)
    .maybeSingle();
  pharmacyId = viosPharmacy?.id || null;
}
```

If still null after lookup, skip the insert or use a placeholder — but the VIOS pharmacy should exist in the table.

### 2. Verify VIOS pharmacy exists

Query `pharmacies` table to confirm there's a VIOS entry and get its ID, so we use the correct UUID.

## Scope
- 1 file, ~5 lines changed
- No migration needed

