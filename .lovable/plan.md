

# Professional Use Products PDF Catalog

## What

Create a separate downloadable PDF catalog for the Professional Use Products, styled similarly to the existing RX catalog but clearly branded **"PROFESSIONAL USE ONLY"** throughout. Pricing shown per product with "Pack of 10" noted. Completely separate from the RX catalog.

## Approach

Reuse the same design language (dark cover, gold accents, card grid) from the existing `productCatalogPdfGenerator.ts` but create a new dedicated generator that:
- Fetches from `pro_products` table instead of `products`
- Shows "PROFESSIONAL USE ONLY" on the cover and as a watermark/header on each page
- Each card shows product name, image, price, and "Pack of 10" label
- No variants/dosage forms (pro products are simple name + price)
- Simpler card layout since there's no category pill or variant pricing table

## Files

| Action | File |
|--------|------|
| Create | `src/lib/proProductCatalogPdfGenerator.ts` — new generator fetching from `pro_products`, cover titled "PROFESSIONAL USE PRODUCTS", each page header says "FOR PROFESSIONAL USE ONLY", cards show name + price + "Pack of 10" |
| Modify | `src/pages/ProProducts.tsx` — add a "Download Catalog" button in the header area next to the cart icon |

## Detail

### New generator (`proProductCatalogPdfGenerator.ts`)
- Same color scheme (dark cover, gold/white text, white cards with shadow)
- Cover: VitaLuxe logo, "PROFESSIONAL USE PRODUCTS" title, "FOR PROFESSIONAL USE ONLY" subtitle, company address/phone
- Cards: product image (or placeholder), product name, "Pack of 10" badge text, price in bold
- 6 cards per page (3x2 grid), same dimensions as RX catalog
- Footer on each page with "FOR PROFESSIONAL USE ONLY" and page numbers
- Products sorted alphabetically

### ProProducts.tsx update
- Add a "Product Catalog" download button with loading state next to the cart button
- Uses the new generator, triggers browser download as `Pro_Product_Catalog_{date}.pdf`

