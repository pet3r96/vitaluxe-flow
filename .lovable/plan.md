

# Fix: Medication Name Stripped of Dosage on PDF

## Root Cause

Line 569 in `generate-prescription-pdf/index.ts`:
```javascript
const baseName = product_name.replace(/\s+\d+(\.\d+)?(mg|ml|g|mcg).*$/i, '').trim();
const medText = `${baseName} ${dosage || ''}`.trim();
```

This regex strips everything from the first strength pattern onward, so `"Semaglutide/Methylcobalamin/Glycine 5mg/1mg/10mg/ml - 2mL"` becomes just `"Semaglutide/Methylcobalamin/Glycine"`. The `dosage` field is empty, so nothing gets appended back.

## Fix

**File:** `supabase/functions/generate-prescription-pdf/index.ts` (lines 568-570)

Remove the regex stripping logic. Use `product_name` directly:
```javascript
const medText = dosage ? `${product_name} ${dosage}` : product_name;
```

This preserves the full name with strength: **"Semaglutide/Methylcobalamin/Glycine 5mg/1mg/10mg/ml - 2mL"**

## After Deploy
- Regenerate Renee Rodriguez's prescription (`order_line_id: 95d9e316-3cf2-4a6c-8cd9-f54b348b80dd`)
- Verify medication box shows full name with strength and form

## Scope
- 1 file, 2-line change
- 1 regeneration

