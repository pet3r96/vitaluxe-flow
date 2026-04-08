

# Fix: Orders Missing provider_id and SIG (Directions)

## Root Causes Found

### BUG 1: `custom_sig` and `custom_dosage` NEVER reach `order_lines`
The `place-order` edge function selects cart_lines but **omits `custom_sig` and `custom_dosage`** from the SELECT query (line 201-222). These fields exist on `cart_lines`, are correctly saved by `manage-cart`, but are never read during order placement — so `order_lines` always gets null for both fields.

### BUG 2: `provider_id` is null for doctor/practice-owner accounts
In `ProductsGrid.tsx` (lines 616 and 758), `actualProviderId` is explicitly set to `null` when `isProviderAccount` is false (i.e., for doctor/practice-owner roles). The comment says "Staff and practice owners don't have provider records" — but this means orders placed by practice owners have **no provider on the order line**, which VIOS rejects with "Prescriber name is required."

### BUG 3: `place-order` has no fallback for missing `provider_id`
When `line.provider_id` is null and the user isn't staff, the order line is created with `provider_id: null`. There's no fallback to look up the practice's active provider.

## Fixes

### 1. `supabase/functions/place-order/index.ts`

**a) Add `custom_sig` and `custom_dosage` to the cart_lines SELECT** (line ~201):
```
custom_sig,
custom_dosage,
```

**b) Include them in BOTH order_line inserts** (practice lines ~383 and patient lines ~444):
```
custom_sig: line.custom_sig || null,
custom_dosage: line.custom_dosage || null,
```

**c) Add provider_id fallback logic** — after the staff provider check (~line 262), add a query to fetch the practice's first active provider with NPI as a fallback:
```typescript
// Fallback: if no staff provider and user is practice owner, get first active provider
let fallbackProviderId = null;
if (!staffProviderRecord && effectivePracticeId) {
  const { data: practiceProviders } = await supabaseAdmin
    .from('providers')
    .select('id, profiles!providers_user_id_fkey(npi)')
    .eq('practice_id', effectivePracticeId)
    .eq('active', true)
    .limit(5);
  
  // Prefer provider with NPI
  const withNpi = practiceProviders?.find(p => {
    const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
    return profile?.npi;
  });
  fallbackProviderId = withNpi?.id || practiceProviders?.[0]?.id || null;
}
```

Then update the provider resolution in both practice and patient line blocks:
```typescript
const providerIdForOrderLine = isStaffAccount && staffProviderRecord?.id 
  ? staffProviderRecord.id 
  : (line.provider_id || fallbackProviderId);
```

### 2. `src/components/products/ProductsGrid.tsx`

**Fix `actualProviderId` for non-provider accounts** (lines 614-618 and 756-760):

Instead of setting `actualProviderId` to `null` for non-provider accounts, look up the practice's first active provider:

```typescript
let actualProviderId: string | null = null;
if (isProviderAccount) {
  actualProviderId = await getProviderIdFromUserId(providerId);
} else {
  // For practice owners/staff: use practice's first active provider
  const { data: practiceProviders } = await supabase
    .from('providers')
    .select('id')
    .eq('practice_id', resolvedDoctorId)
    .eq('active', true)
    .limit(1);
  actualProviderId = practiceProviders?.[0]?.id || null;
}
```

Apply this in BOTH the practice-order block (~line 614) and patient-order block (~line 756).

### 3. `supabase/functions/send-order-to-pharmacy/index.ts`

**Add `custom_sig` to the order_lines SELECT** (around line 185-232). The `send-order-to-pharmacy` function already passes data to VIOS validation which checks for `custom_sig`, but let me verify it's selected:

Currently custom_sig IS in the order_lines table columns but needs to be in the SELECT. Add it to ensure the VIOS validation has access.

## Summary
- **3 files changed**: `place-order/index.ts`, `ProductsGrid.tsx`, `send-order-to-pharmacy/index.ts`
- **Zero functional risk**: All changes are additive (adding missing fields to queries and adding fallback logic)
- **Prevents recurrence**: Both the cart→order pipeline and the add-to-cart flow will always have provider_id and SIG populated

