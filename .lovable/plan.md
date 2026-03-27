

# Professional Use Products — Full System Audit

## Verdict: 2 Critical Bugs, 2 Minor Issues

---

## CRITICAL BUG 1: Email with PDF Attachment Will Silently Fail

The `send-pro-order` edge function calls `unified-email-sender` with this payload shape:
```json
{ "to": "...", "subject": "...", "html": "...", "attachments": [...] }
```

But `unified-email-sender` expects:
- `htmlBody` (not `html`)
- `textBody` (required, not sent at all)
- **No attachments support** — the Postmark call in `sendViaPostmark()` never passes attachments through

**Result**: The email body will be empty (undefined `htmlBody`) and the PDF attachment will be silently dropped. The order notification email to operations is broken.

**Fix**: Rewrite `send-pro-order` to call the Postmark API directly (like the existing working email functions do) instead of going through `unified-email-sender`. This gives it full control over the `Attachments` field in the Postmark payload.

---

## CRITICAL BUG 2: `toLocaleString()` in Edge Function (Deno)

In `send-pro-order` line 44:
```ts
$${orderTotal?.toLocaleString() || "0"}
```

`toLocaleString()` behavior in Deno server runtime is unpredictable — it may not format with commas, or may produce unexpected locale-specific output. This should use a fixed formatter or just pass the raw number. Minor compared to Bug 1, but worth fixing in the same pass.

---

## MINOR ISSUE 1: Cart Minus Button Can Delete Item Without Confirmation

In `ProCartSheet`, clicking minus when quantity is 1 calls `updateItem.mutate({ id, quantity: 0 })`, which triggers a DELETE in `useUpdateProCartItem`. This works correctly but there's no "are you sure?" — the item just disappears. This is acceptable UX (matches standard cart patterns) but worth noting.

---

## MINOR ISSUE 2: No `effectivePracticeId` Fallback for Contact Info

In `ProProducts.tsx` line 42, if `effectivePracticeId` is null (e.g., a user not associated with a practice), the order gets submitted with empty contact info and empty shipping address. The PDF will generate with blank fields. This is an edge case but could be confusing.

**Fix**: Add a guard that prevents order submission if no practice is associated, with a toast message like "You must be associated with a practice to submit pro orders."

---

## Isolation Verification: PASS

- Pro hooks (`useProCart`, `useProOrders`, `useProProductsAdmin`) query ONLY `pro_*` tables — zero references to `carts`, `cart_lines`, `orders`, `order_lines`, or Authorize.Net
- RLS policies are correct: users CRUD own cart/orders, admins manage products
- Routes (`/pro-products`, `/pro-products-admin`) are separate from existing product routes
- Cart state uses separate React Query keys (`pro-cart`, `pro-cart-count`)
- The two carts (RX and Pro) are completely independent at every layer

## PDF Generation: PASS

- `proOrderPdfGenerator.ts` correctly formats the order form with product names + "(Pack of 10)"
- Layout matches the uploaded template structure
- Auto-download works via `pdf.save()` on submit

## Database Schema: PASS

- All 3 tables have RLS enabled with correct policies
- FK cascade on `pro_cart_items → pro_products` (delete product removes from carts)
- `updated_at` trigger exists on `pro_products`

---

## Fix Plan

### 1. Rewrite `send-pro-order` edge function
Replace `supabase.functions.invoke("unified-email-sender")` with a direct Postmark API call that properly includes the PDF as a base64 attachment. Use the same `POSTMARK_API_KEY` and `POSTMARK_FROM_EMAIL` env vars already available. Add proper `textBody` fallback.

### 2. Add practice guard on order submission
In `ProProducts.tsx`, before `handleSubmitOrder` proceeds, check that `effectivePracticeId` exists. If not, show a toast error and return early.

### 3. Redeploy `send-pro-order`
After the fix, the function auto-deploys.

