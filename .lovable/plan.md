

## Fix: Days Supply Not Sent to VIOS Pharmacy API

### Root Cause
The `days_supply` field is missing from the `OrderLineData` TypeScript interface in `supabase/functions/_shared/vios/viosValidation.ts`. While the database column exists and contains the correct value (verified: `14` on the most recent order), and the VIOS payload builder references `orderLine.days_supply`, the TypeScript type doesn't declare the field. This means the property access may be silently dropped during compilation.

The mapping code in `viosOrders.ts` line 213 is correct:
```
...(orderLine.days_supply && { daysSupply: Number(orderLine.days_supply) })
```

But the type it reads from doesn't include `days_supply`.

### Fix

**File: `supabase/functions/_shared/vios/viosValidation.ts`**

Add `days_supply?: number | null;` to the `OrderLineData` interface (around line 30, alongside the other order line fields like `quantity`, `custom_sig`, etc.).

That's it -- one line. Everything else (database column, cart flow, place-order flow, VIOS payload builder) is already correctly wired.

### Verification
After the fix, the VIOS order payload will include:
```json
{
  "rxs": [{
    "daysSupply": 14,
    ...
  }]
}
```

