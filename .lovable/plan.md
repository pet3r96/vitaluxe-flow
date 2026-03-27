

# Add 30 Pro Products + 5% Markup + "Pack of 10" Labeling

## What

1. **Insert 30 products** into the `pro_products` table via a database migration, each with the listed price + 5% markup, and a description noting "Pack of 10".
2. **Update the ProProductCard** to display a subtle "Pack of 10" indicator so users clearly understand the unit.

## Pricing (price × 1.05)

| Product | Listed | Final (×1.05) |
|---------|--------|---------------|
| BPC 157 10mg | $325 | $341.25 |
| CJC-1295 w/o DAC 10mg | $355 | $372.75 |
| CJC-1295 w/o DAC 5mg | $210 | $220.50 |
| Epithalon 10mg | $195 | $204.75 |
| GHK-Cu 100mg | $235 | $246.75 |
| GHK-Cu 50mg | $170 | $178.50 |
| GLOW Blend | $975 | $1023.75 |
| HCG 5,000iu | $195 | $204.75 |
| HGH 12IU | $230 | $241.50 |
| Ipamorelin 10mg | $340 | $357.00 |
| Kisspeptin-10 5mg | $325 | $341.25 |
| KLOW | $1235 | $1296.75 |
| KPV 10mg | $235 | $246.75 |
| MOTS-C 10mg | $495 | $519.75 |
| NAD+ 500mg | $235 | $246.75 |
| PT-141 10mg | $455 | $477.75 |
| Selank 5mg | $235 | $246.75 |
| Semax 10mg | $260 | $273.00 |
| Sermorelin 5mg | $380 | $399.00 |
| SS-31 10mg | $495 | $519.75 |
| TB-500 10mg | $510 | $535.50 |
| TB-500 5mg | $295 | $309.75 |
| Tesamorelin 10mg | $795 | $834.75 |
| Thymosin alpha 1 | $495 | $519.75 |
| Retatrutide 10mg | $725 | $761.25 |
| Retatrutide 20mg | $1115 | $1170.75 |
| Semaglutide 10mg | $565 | $593.25 |
| Tirzepatide 10mg | $535 | $561.75 |
| Tirzepatide 30mg | $1190 | $1249.50 |
| Tirzepatide 60mg | $1990 | $2089.50 |

## Changes

### 1. Database migration
Insert all 30 products into `pro_products` with the 5%-marked-up prices, description "Pack of 10", `active = true`, and sequential `sort_order`.

### 2. `src/components/pro-products/ProProductCard.tsx`
Add a small badge/tag showing **"Pack of 10"** beneath or beside the product name so users understand the pricing unit. Simple visual — e.g., a muted text line or small badge.

### 3. `src/lib/proOrderPdfGenerator.ts`
Ensure the PDF order form also shows "Pack of 10" context in the product listing (e.g., append to product name or add a column note).

No existing products, billing, or checkout logic is touched.

