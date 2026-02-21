

# Pre-Set SIG (Directions) Per Product Variant

## Overview

Add a `default_sig` column to each product variant so that when a prescriber writes a script, the SIG field auto-fills with variant-specific directions. The prescriber can still edit it. A liability disclaimer will be added to the SIG header.

## Steps

### Step 1: Database Migration -- Add `default_sig` column

Add a nullable `default_sig` text column to the `product_variants` table.

```sql
ALTER TABLE product_variants ADD COLUMN default_sig text;
```

### Step 2: Populate SIG Data for All ~297 Variants

Using the product_code (VIOS Med ID) as the matching key, run UPDATE statements to set the `default_sig` for every variant. The SIG values from the spreadsheet group into these categories:

- **Capsules (swallow with water):** Clomiphene, Enclomiphene, Estradiol IR, Naltrexone, Tadalafil Cap, Methylene Blue, Pregnenolone IR, Liothyronine IR, Levothyroxine Dye-Free, T4/T3 IR, etc.
- **Capsules SR (do not crush/chew):** DHEA SR, Progesterone IR/SR, Liothyronine SR, Levothyroxine SR, T4/T3 SR, etc.
- **Creams (topical):** All Biest Cream, DHEA Cream, Estradiol Cream, Estriol Cream, GHK-CU, Hydroquinone, Progesterone Cream, Testosterone Cream, etc.
- **Injectables (subcutaneous):** Sermorelin, Semaglutide combos, Tirzepatide combos
- **Injectables (intramuscular):** Testosterone Cypionate Oil, Nandrolone, Glutathione, NAD+, Methylcobalamin
- **RDTs (rapid dissolve tablets):** Biest RDT, Progesterone RDT, Testosterone RDT, Tadalafil Raspberry, Sildenafil Raspberry, Semaglutide ODT, Tirzepatide ODT
- **Troches (sublingual):** Biest Troche, Progesterone Troche, Testosterone Troche, Tadalafil Troche, Sildenafil Troche, NAD+ Troche, Oxytocin Troche
- **Nasal Spray:** Oxytocin
- **Solutions (scalp):** Finasteride/Minoxidil, Minoxidil
- **Tablets:** Finasteride

Each variant will be matched by its `product_code` and updated with the exact SIG text from the spreadsheet. Where multiple variants share the same product_code (different quantities), they all get the same SIG.

### Step 3: Update Type Definitions

**File:** `src/types/domain/productVariant.ts`

- Add `default_sig?: string | null` to the `ProductVariant` interface
- Add `default_sig: string` to `ProductVariantFormData`
- Update `createEmptyVariant()` to include `default_sig: ''`

### Step 4: Update SIG Initialization Logic

**File:** `src/components/products/PatientSelectionDialog.tsx` (lines 363-366)

Change from using product-level SIG to variant-level:

```
Before: if (product?.sig && !customSig) { setCustomSig(product.sig); }
After:  const variantSig = selectedVariant?.default_sig || product?.sig;
        if (variantSig && !customSig) { setCustomSig(variantSig); }
```

Also update the helper text (line 885) from "Default from product: ..." to "Default from variant: ..." showing the variant's specific SIG.

### Step 5: Add Liability Disclaimer to SIG Labels

**Files:** `PatientSelectionDialog.tsx` (line 876) and `PrescriptionWriterDialog.tsx` (line 431)

Update the SIG label to include a disclaimer subtitle:

```
SIG - Directions for Use *
Please confirm and adjust directions as per your clinical judgment.
```

This will appear as a small helper text line directly below the label to protect against liability.

### Step 6: Admin Editing Support

**File:** `src/components/products/ProductVariantsEditor.tsx`

Add a "Default SIG" textarea field within each variant card so admins can view and edit the pre-set directions per variant. This allows future SIG changes without needing database updates.

### Step 7: Update Variant Hook

**File:** `src/hooks/useProductVariants.ts`

Ensure `default_sig` is included in the upsert data when syncing variants (in `useSyncProductVariants`).

---

## Files to Modify

| File | Change |
|------|--------|
| Database | Add `default_sig text` column |
| Database | ~297 UPDATE statements to populate SIG values |
| `src/types/domain/productVariant.ts` | Add `default_sig` to interfaces |
| `src/components/products/PatientSelectionDialog.tsx` | Use variant `default_sig` for SIG init + disclaimer |
| `src/components/products/PrescriptionWriterDialog.tsx` | Add disclaimer to SIG label |
| `src/components/products/ProductVariantsEditor.tsx` | Add default_sig textarea for admin editing |
| `src/hooks/useProductVariants.ts` | Include default_sig in variant sync |

## Expected Result
- When a prescriber selects a variant (e.g., "DHEA SR 40 MG - 30ct"), the SIG field auto-fills with "Take 1 capsule by mouth once daily as directed by your provider; swallow whole--do not crush or chew; take at the same time each day unless otherwise directed."
- Different product types get different SIG text (creams get topical instructions, injectables get injection instructions, etc.)
- Prescribers see a disclaimer: "Please confirm and adjust directions as per your clinical judgment"
- Admins can edit default SIGs per variant through the product management UI

