

## Add Testosterone Injectable Products (Lines 311-316)

Lines 306-310 (T4/T3 BIOTHYROID SR) are already in the database -- all those variants and product codes are present. No action needed for those.

Lines 311-316 are 6 new injectable items that need to be added:

---

### What Will Be Added

**1. Two new variants on EXISTING product "Testosterone Cypionate GSO" (lines 314-315)**
| Variant | Strength | Size | VIOS ID | Base Price | Practice Price |
|---------|----------|------|---------|------------|----------------|
| 200mg/mL - 4mL | 200 MG/ML | 4mL | 305511458 | $24.64 | $34.50 |
| 200mg/mL - 6mL | 200 MG/ML | 6mL | 305511457 | $30.80 | $43.12 |

**2. NEW product: "TESTOSTERONE CYPIONATE MCT (Injectable)" (line 316)**
| Variant | Strength | Size | VIOS ID | Base Price | Practice Price |
|---------|----------|------|---------|------------|----------------|
| 200mg/mL - 10mL | 200 MG/ML | 10mL | 305518452 | $30.80 | $43.12 |

**3. NEW product: "TESTOSTERONE CYPIONATE (Injectable)" (lines 312-313)**
| Variant | Strength | Size | VIOS ID | Base Price | Practice Price |
|---------|----------|------|---------|------------|----------------|
| 100mg/mL - 5mL | 100 MG/ML | 5mL | 302384076 | $24.64 | $34.50 |
| 200mg/mL - 5mL | 200 MG/ML | 5mL | 302384074 | $24.64 | $34.50 |

**4. NEW product: "TESTOSTERONE (Injectable)" (line 311)**
| Variant | Strength | Size | VIOS ID | Base Price | Practice Price |
|---------|----------|------|---------|------------|----------------|
| 200mg/mL - 10mL | 200 MG/ML | 10mL | 302409115 | $30.80 | $43.12 |

---

### Technical Details

A single SQL migration will:

1. Insert 2 new variants into the existing "Testosterone Cypionate GSO" product (ID: `e736eb74-c787-461f-85eb-4c6575da2641`), with sort_order continuing after existing 3 variants
2. Insert 3 new products into `products` table (Hormone Therapy type `c5aee9fc-012f-4155-b356-8e26ffb22ea5`, dosage_form "Injectable", active, not GLP-1, not controlled)
3. Insert variants for each new product with correct `product_code` (VIOS Med ID), `base_price`, and `retail_price`
4. Assign all 3 new products to the VIOS pharmacy (`d5e75179-e66c-450f-8cae-1f4df93b097c`) in `product_pharmacies`
5. Upsert all 6 VIOS Med IDs into `vios_product_catalog`

All fields will match the existing catalog pattern (name with form appended, variant labels as "strength - size", product_code for VIOS routing).

