
-- Add Testosterone Injectable Products (Lines 311-316)

-- STEP 1: Upsert VIOS catalog entries FIRST (trigger validates against this)
INSERT INTO vios_product_catalog (med_id, product_name, form, strength, units)
VALUES
  ('302409115', 'TESTOSTERONE', 'Injectable', '200 MG/ML', '10mL'),
  ('302384076', 'TESTOSTERONE CYPIONATE', 'Injectable', '100 MG/ML', '5mL'),
  ('302384074', 'TESTOSTERONE CYPIONATE', 'Injectable', '200 MG/ML', '5mL'),
  ('305511458', 'TESTOSTERONE CYPIONATE GSO', 'Injectable', '200 MG/ML', '4mL'),
  ('305511457', 'TESTOSTERONE CYPIONATE GSO', 'Injectable', '200 MG/ML', '6mL'),
  ('305518452', 'TESTOSTERONE CYPIONATE MCT', 'Injectable', '200 MG/ML', '10mL')
ON CONFLICT (med_id) DO UPDATE SET
  product_name = EXCLUDED.product_name,
  form = EXCLUDED.form,
  strength = EXCLUDED.strength,
  units = EXCLUDED.units;

-- STEP 2: Add 2 new variants to existing "Testosterone Cypionate GSO"
INSERT INTO product_variants (product_id, dosage_label, base_price, retail_price, product_code, active, sort_order)
VALUES
  ('e736eb74-c787-461f-85eb-4c6575da2641', '200mg/mL - 4mL', 24.64, 34.50, '305511458', true, 4),
  ('e736eb74-c787-461f-85eb-4c6575da2641', '200mg/mL - 6mL', 30.80, 43.12, '305511457', true, 5);

-- STEP 3: Create 3 new products
INSERT INTO products (id, name, dosage_form, base_price, product_type_id, active, requires_prescription, is_glp1, vios_lf_product_id)
VALUES
  ('a1b2c3d4-1111-4000-a000-000000000001', 'TESTOSTERONE (Injectable)', 'Injectable', 30.80, 'c5aee9fc-012f-4155-b356-8e26ffb22ea5', true, false, false, '302409115'),
  ('a1b2c3d4-2222-4000-a000-000000000002', 'TESTOSTERONE CYPIONATE (Injectable)', 'Injectable', 24.64, 'c5aee9fc-012f-4155-b356-8e26ffb22ea5', true, false, false, '302384076'),
  ('a1b2c3d4-3333-4000-a000-000000000003', 'TESTOSTERONE CYPIONATE MCT (Injectable)', 'Injectable', 30.80, 'c5aee9fc-012f-4155-b356-8e26ffb22ea5', true, false, false, '305518452');

-- STEP 4: Create variants for new products
INSERT INTO product_variants (product_id, dosage_label, base_price, retail_price, product_code, active, sort_order)
VALUES
  ('a1b2c3d4-1111-4000-a000-000000000001', '200mg/mL - 10mL', 30.80, 43.12, '302409115', true, 1),
  ('a1b2c3d4-2222-4000-a000-000000000002', '100mg/mL - 5mL', 24.64, 34.50, '302384076', true, 1),
  ('a1b2c3d4-2222-4000-a000-000000000002', '200mg/mL - 5mL', 24.64, 34.50, '302384074', true, 2),
  ('a1b2c3d4-3333-4000-a000-000000000003', '200mg/mL - 10mL', 30.80, 43.12, '305518452', true, 1);

-- STEP 5: Assign new products to VIOS pharmacy
INSERT INTO product_pharmacies (product_id, pharmacy_id)
VALUES
  ('a1b2c3d4-1111-4000-a000-000000000001', 'd5e75179-e66c-450f-8cae-1f4df93b097c'),
  ('a1b2c3d4-2222-4000-a000-000000000002', 'd5e75179-e66c-450f-8cae-1f4df93b097c'),
  ('a1b2c3d4-3333-4000-a000-000000000003', 'd5e75179-e66c-450f-8cae-1f4df93b097c');
