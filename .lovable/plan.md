

# Fix: "Send to Pharmacy API" Shows "Unknown Error" Instead of Actual Validation Errors

## Root Cause

Two layers of issues on order `#ae8f1f44`:

### 1. Data Issue (this specific order)
The order line has `provider_id = null` and `custom_sig = null`. VIOS validation correctly rejects it with:
- "Prescriber name is required"
- "Directions (sig) are required for VIOS orders"

### 2. Error Message Not Surfaced (code bug)
When VIOS routing fails, `send-order-to-pharmacy` returns:
```json
{ "success": false, "handler": "vios", "results": [{ "success": false, "error": "Validation failed..." }], "summary": "0/1..." }
```

But in `OrderDetailsDialog.tsx` (line 214-215), the client reads:
```js
f.error?.message || f.data?.error || 'Unknown error'
```

`f.data?.error` is undefined because the actual errors are in `f.data?.results[0]?.error` or `f.data?.summary`. Hence → **"Unknown error"**.

## Fixes

### 1. `src/components/orders/OrderDetailsDialog.tsx`
Update the error extraction logic (around line 214) to also check `f.data?.results` array and `f.data?.summary` for VIOS-style error responses:

```typescript
const errorMessages = failures.map(f => {
  if (f.error?.message) return f.error.message;
  if (f.data?.error) return f.data.error;
  // VIOS returns errors in results array
  if (f.data?.results) {
    const viosErrors = f.data.results
      .filter(r => !r.success && r.error)
      .map(r => r.error);
    if (viosErrors.length > 0) return viosErrors.join('; ');
  }
  if (f.data?.summary) return f.data.summary;
  return 'Unknown error';
}).join(', ');
```

### 2. `supabase/functions/send-order-to-pharmacy/index.ts`
Add a top-level `error` field to the VIOS routing response when `allSuccess` is false (around line 142), so the client can also find it at `data.error`:

```typescript
return new Response(
  JSON.stringify({ 
    success: allSuccess,
    handler: "vios",
    error: allSuccess ? undefined : results.filter(r => !r.success).map(r => r.error).join('; '),
    results,
    summary: `${successCount}/${results.length} order lines submitted successfully`
  }),
  ...
);
```

## About the Data Issue
The missing `provider_id` and `custom_sig` on this order are legitimate validation failures — the order was placed without a prescriber or directions. The fix above ensures the admin sees the real reason ("Prescriber name is required", "Directions required") instead of "Unknown error", so they can address the data before retrying.

