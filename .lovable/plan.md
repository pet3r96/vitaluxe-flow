

# Fix: Create VIOS Pharmacy and Assign All Products

## Problem

The `pharmacies` table is completely empty. The VIOS Compounding pharmacy record that the entire system references (ID: `d5e75179-e66c-450f-8cae-1f4df93b097c`) does not exist in the database. This causes two issues:

1. **No pharmacy options in the dropdown** -- When editing a product, the "Assigned Pharmacies" section shows nothing to select because there are no pharmacy records.
2. **No products assigned** -- The `product_pharmacies` junction table has 0 rows, so no product is linked to any pharmacy.

## Fix (Single Database Migration)

Run a SQL migration that:

1. **Inserts the VIOS Compounding pharmacy** with the exact UUID the system already references everywhere (`d5e75179-e66c-450f-8cae-1f4df93b097c`), with all US states serviced and API configuration pointing to VIOS.

2. **Assigns all 61 active products** to that pharmacy by inserting rows into `product_pharmacies`.

No code changes are needed -- the ProductDialog already fetches from the `pharmacies` table and renders checkboxes. Once the pharmacy record exists, it will appear in the dropdown automatically.

## Technical Details

### SQL Migration

```sql
-- 1. Insert VIOS Compounding pharmacy with the canonical UUID
INSERT INTO pharmacies (
  id, name, contact_email, active,
  api_enabled, api_handler_type,
  api_endpoint_url, api_environment,
  states_serviced
) VALUES (
  'd5e75179-e66c-450f-8cae-1f4df93b097c',
  'VIOS Compounding',
  'support@vioscompounding.com',
  true,
  true,
  'vios',
  'https://integrations.vioscompounding.com',
  'production',
  ARRAY['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
        'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
        'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
        'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
        'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Assign ALL active products to VIOS
INSERT INTO product_pharmacies (product_id, pharmacy_id)
SELECT id, 'd5e75179-e66c-450f-8cae-1f4df93b097c'
FROM products
WHERE active = true
ON CONFLICT DO NOTHING;
```

### Expected Result

- The "Assigned Pharmacies" dropdown in the Product Dialog will show "VIOS Compounding" with a checkbox
- All 61 active products will already be checked/assigned to VIOS
- Opening any product will show "Selected: 1 pharmacy(s)"
- The VIOS catalog linkage section will appear for products assigned to VIOS
- No code changes required

