

# Fix: VIOS API Quantity + Payload Audit Trail

## What Happened

The order for Renee Rodriguez was submitted to VIOS at 16:46 UTC today. The quantity fix code is present in `viosOrders.ts` (line 170-171), but the order was likely sent **before** the updated edge function was fully deployed — meaning VIOS received `quantity: "1"` instead of `quantity: "2"`.

Additionally, the `pharmacy_order_transmissions` table has zero records, so there's no audit trail of what payload was actually sent. This makes debugging impossible.

## Plan

### 1. Add payload logging to `send-vios-order/index.ts`

After building the payload (before calling `submitViosOrder`), log the built payload's quantity to the transmission table and to the edge function logs so we can verify what's being sent:

```typescript
// After result = await submitViosOrder(...)
// Log to pharmacy_order_transmissions
await supabaseAdmin.from("pharmacy_order_transmissions").insert({
  order_id,
  order_line_id,
  pharmacy_id: pharmacyId,
  transmission_type: 'order',
  api_endpoint: '/api/orders',
  request_payload: sanitizedPayload, // redact PHI
  response_status: result.success ? 200 : 400,
  response_body: result.response,
  success: result.success,
  error_message: result.error,
  transmitted_at: new Date().toISOString(),
  pharmacy_order_id: result.orderId
});
```

### 2. Allow re-submission for this specific order

The idempotency check at line 135 blocks resubmission because `pharmacy_order_id` is already set. To fix the quantity for this order, we need to either:
- Clear the `pharmacy_order_id` on the order line via a migration so it can be re-sent
- Or contact VIOS to update the quantity on their end

I recommend clearing it and re-sending, since the code now has the correct quantity logic.

### 3. Verify the regex works

The dosage label is `5mg/1mg/10mg/ml - 2mL`. The regex `/[\-–]\s*(\d+)\s*mL/i` matches `- 2mL` and extracts `2`. This is correct and confirmed by the data.

### 4. Deploy and re-send

- Deploy updated `send-vios-order` with transmission logging
- Clear `pharmacy_order_id` on order line `95d9e316-3cf2-4a6c-8cd9-f54b348b80dd`
- Re-trigger the order submission
- Verify in logs that `quantity: "2"` was sent

## Files Changed
- `supabase/functions/send-vios-order/index.ts` — add transmission logging
- Migration: clear `pharmacy_order_id` for this order line to allow re-send

