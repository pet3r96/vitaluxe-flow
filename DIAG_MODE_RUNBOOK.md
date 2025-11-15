# Diagnostic Mode Runbook

## Quick Start

Enable diagnostic mode to troubleshoot loops, slow loads, and broken actions:

```bash
VITE_DIAG=1 npm run dev
```

## What It Does

Diagnostic mode adds detailed logging for:
- **Render counts**: How many times each component renders
- **Effect runs**: When effects execute and what triggers them
- **Subscription lifecycle**: Realtime channel creation/cleanup
- **Performance timings**: How long operations take
- **Edge function execution**: Start/end timestamps, row counts, role branches

## Reading the Logs

### Frontend Logs

```
[DIAG] Cart:render (3)
[DIAG] Cart:state { cartOwnerId: "abc-123", role: "doctor" }
[DIAG] Cart:normalization-skip { reason: "same version", version: "line1:5:standard|line2:3:express" }
[DIAG] Cart:realtime-subscribe { cartId: "cart-456" }
```

**What to look for:**
- `Cart:render` count > 10 in 5 seconds → **Infinite loop**
- `Cart:realtime-subscribe` appears multiple times → **Subscription leak**
- `normalization-skip` not appearing → **Normalization running on every update**

### Edge Function Logs

```
[get-orders-page] 🔍 Request: { page: 1, pageSize: 50, role: "doctor", scopeId: "abc-123" }
[get-orders-page] ⏱️ Query start
[get-orders-page] ✅ Found 36 orders for doctor
[get-orders-page] ⏱️ Query end: 1234ms
[get-orders-page] ✅ SUCCESS: 36 orders fetched in 1234ms (total: 36)
```

**What to look for:**
- Query time > 2000ms → **Slow query, check indexes**
- `⚠️ SLOW QUERY` warning → **Needs optimization**
- Row count = 0 but user expects data → **RLS policy issue**

## Common Issues & Quick Fixes

### Issue: Cart loads forever

**Symptoms:**
```
[DIAG] Cart:render (50)
[DIAG] Cart:render (51)
[DIAG] Cart:render (52)
```

**Check:**
1. Is `normalization-skip` appearing? If not, normalization is looping.
2. Look for `queryClient.invalidateQueries()` in mutation `onSuccess` callbacks.

**Fix:**
- Guard normalization with version hash
- Remove invalidations from mutations (rely on realtime)

---

### Issue: Orders page stuck loading

**Symptoms:**
```
[get-orders-page] 🔍 Request: { role: "provider" }
[get-orders-page] ⚠️ SLOW QUERY: 13462ms
```

**Check:**
1. Role-specific query path (doctor/provider/staff/pharmacy)
2. Missing indexes on filtered columns
3. Date range too broad (default is 90 days)

**Fix:**
- Add AbortController in `OrdersDataTable.tsx`
- Verify indexes exist (see Bug Ledger)
- Narrow date range filter

---

### Issue: Receipt download fails

**Symptoms:**
```
[generate-order-receipt] ❌ Storage timeout after 3 attempts
[ReceiptDownloadButton] Error: Failed to generate receipt
```

**Check:**
1. Is base64 fallback present in response?
2. Is admin client used for storage operations?
3. Are retries being attempted?

**Fix:**
- Verify `data.base64` exists in response
- Use `downloadPdfFromBase64()` as fallback
- Check storage bucket exists and is accessible

---

### Issue: "Script" button not showing

**Symptoms:**
```
[OrdersDataTable] hasAnyScript: false for order with prescription
```

**Check:**
1. Is `prescription_url_indicator` or `prescription_url_encrypted` set?
2. Does product have `requires_prescription: true`?
3. Is user role in `['doctor','provider','pharmacy','admin']`?

**Fix:**
- Check all four prescription indicators in visibility logic
- Verify role is authorized to view prescriptions

---

## Performance Benchmarks

| Operation | Target | Red Flag |
|-----------|--------|----------|
| Cart first load | < 600ms | > 1000ms |
| Orders page load | < 2s | > 3s |
| Receipt generation | < 5s | > 10s |
| Add to cart | < 500ms | > 1000ms |

## Verification Checklist

After changes, verify in DIAG mode:

- [ ] Cart renders exactly once on mount
- [ ] Normalization executes once per cart version
- [ ] Realtime subscription created once
- [ ] Orders query completes < 2s
- [ ] Receipt downloads (URL or base64)
- [ ] Prescription button visible when applicable
- [ ] Cart cleared after checkout (count=0)

## Disabling Diagnostic Mode

```bash
npm run dev
```

(Omit `VITE_DIAG=1` to run normally)

---

**For urgent issues, check `BUG_LEDGER.md` for known problems and fixes.**
