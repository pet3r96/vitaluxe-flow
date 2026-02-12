

# Sleek Modern Product Catalog -- No Index, Type Inside Cards

## Overview
Remove the Table of Contents page entirely. Embed the product category/type as a subtle tag inside each card. Redesign cards with a cleaner, more modern aesthetic -- less "computer-generated" borders, more whitespace and typography-driven design. 6 products per page (3 rows x 2 columns), sorted alphabetically by product name across the entire catalog.

## Layout Math
- A4 page: 210 x 297mm
- Margins: 12mm all sides
- No category header bars -- type lives inside the card now
- Usable area: 186mm wide x 271mm tall (after footer)
- Card dimensions: **90mm wide x 88mm tall**
- Column gap: 6mm, Row gap: 3mm
- 3 rows x 88 + 2 gaps x 3 = 270mm -- fits perfectly
- Image size: **46mm** (large, prominent)

## Design Changes

### Remove
- Table of Contents page (page 2) -- gone entirely
- Category header bars on product pages -- no longer needed
- Heavy double borders (black outer + gold inner)
- Gold corner accent L-shapes
- Gold "Practice Price" bar

### Add / Replace
- **Category pill**: Small rounded pill at top-left of card with category name in gold text on a dark background
- **Shadow effect**: Subtle light-grey offset rectangle behind each card for depth
- **Clean single border**: Thin 0.3pt grey border instead of heavy double borders
- **Modern pricing layout**: Price in bold black below a thin gold hairline, no colored bar
- **Larger image**: 46mm in a borderless/clean container (no grey box, just the image)
- **Better typography hierarchy**: Product name 11pt, category 6pt, dosage form 7pt, price 13pt

### Product Sorting
- All products sorted alphabetically by name across the entire catalog (no category grouping on pages)
- Category is shown per-card via the pill tag, so no information is lost

### Cover Page
- Stays the same (black/gold/white branded cover)

### Card Layout (top to bottom within 88mm)
1. Category pill (top-left corner, 2mm from edges) -- 5mm
2. Product image centered -- 46mm
3. Product name (11pt bold) -- 5mm
4. Dosage form (7pt grey) -- 3mm
5. Thin gold line -- 2mm
6. Price/variants area -- remaining ~20mm (plenty of room)

## Technical Details

### File: `src/lib/productCatalogPdfGenerator.ts`
- Remove `drawCategoryHeader` function
- Remove `drawCornerAccents` function
- Remove TOC page generation block
- Remove TOC update block at end
- Update constants: `CARD_H = 88`, `IMG_SIZE = 46`
- Rewrite `drawCard` for modern minimal style with category pill
- Change product loop: flatten all products, sort by name, render 6 per page with simple pagination
- Keep cover page and footer as-is

