
## VIOS Product Export & Import Tool

### What You Need
You want to export all 295 VIOS-assigned product variants to a CSV/Excel file, fill in the VIOS Med IDs from your VIOS Clinic_Product_List_Report, and then import them back to map each variant to its correct Med ID.

---

### Implementation Plan

#### Step 1: Create Edge Function for CSV Export

**File: `supabase/functions/export-vios-products/index.ts`**

This edge function will:
- Query all active products assigned to VIOS pharmacy with their variants
- Generate a CSV with columns matching the VIOS format:
  - `product_name`
  - `product_type`
  - `dosage_form`
  - `variant_dosage`
  - `base_price`
  - `variant_id` (your internal ID - needed for re-import)
  - `vios_med_id` (empty column for you to fill)
- Return the CSV as a downloadable file

#### Step 2: Create Edge Function for CSV Import

**File: `supabase/functions/import-vios-med-ids/index.ts`**

This edge function will:
- Accept a CSV file with `variant_id` and `vios_med_id` columns
- Validate that all variant_ids exist in the database
- Update `product_variants.product_code` with the corresponding Med ID
- Return a summary of successful/failed updates

#### Step 3: Add Admin UI Component

**File: `src/components/admin/ViosMedIdManager.tsx`**

A new admin component that provides:
- **Export button** - Downloads the CSV of all 295 variants
- **Import section** - File upload to import the filled-in CSV
- **Preview table** - Shows current mapping status (mapped vs unmapped)
- **Validation feedback** - Shows which rows were updated successfully

#### Step 4: Add to Admin Settings

**Modify: `src/pages/AdminSettings.tsx`**

Add a new section or tab called "VIOS Product Mapping" that includes the ViosMedIdManager component.

---

### Technical Details

#### Export CSV Format

```text
product_name,product_type,dosage_form,variant_dosage,base_price,variant_id,vios_med_id
Alpha Lipoic Acid Capsules,Vitamins,Capsule,300mg - 90ct,21.43,2b0908fa-12df-4f7d-ac07-729cf3fdb6a6,
Alpha Lipoic Acid Injection,Vitamins,Injection,25mg/mL - 30mL,42.86,427af58d-7fd8-4cd1-a9cb-e57705b6af3f,
AOD-9604,Peptides,Injection,5mg - 1 vial,120.00,f283af5e-1dbe-4976-8fe8-a383a3288a6f,
Bi-est 50/50 Cream,Hormone Therapy,Cream,1mg/mL - 30g,23.41,f357e4a9-faf9-4986-a9ce-c01bd216d2e9,
...
```

#### Import CSV Format (what you fill in)

```text
variant_id,vios_med_id
2b0908fa-12df-4f7d-ac07-729cf3fdb6a6,302376174
427af58d-7fd8-4cd1-a9cb-e57705b6af3f,302381527
f283af5e-1dbe-4976-8fe8-a383a3288a6f,302397371
...
```

---

### Database Update

The import function will run updates like:

```sql
UPDATE product_variants 
SET product_code = '302376174', updated_at = now()
WHERE id = '2b0908fa-12df-4f7d-ac07-729cf3fdb6a6';
```

---

### Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/export-vios-products/index.ts` | Edge function to generate CSV export |
| `supabase/functions/import-vios-med-ids/index.ts` | Edge function to process CSV import |
| `src/components/admin/ViosMedIdManager.tsx` | Admin UI for export/import workflow |

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/AdminSettings.tsx` | Add VIOS Product Mapping section |
| Database migration | Clear invalid `vios_product_catalog` entries |

---

### Workflow After Implementation

1. Go to Admin Settings → VIOS Product Mapping
2. Click "Export Products" → Downloads CSV with 295 rows
3. Open in Excel alongside your VIOS Clinic_Product_List_Report
4. Match products by name and copy Med IDs into the `vios_med_id` column
5. Save the CSV
6. Upload to the Import section
7. Review the preview and click "Apply Mapping"
8. All 295 variants now have their VIOS Med IDs set

---

### Summary

- **82 products** with **295 variants** need VIOS Med ID mapping
- Export provides a CSV you can fill in manually using your VIOS report
- Import updates `product_variants.product_code` for each variant
- Order routing will then use these Med IDs when submitting to VIOS
