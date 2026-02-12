

# Print-Ready Product Catalog PDF -- Complete Redesign

## Problem
The current PDF looks basic and unpolished -- inconsistent card sizes, small images, grey color scheme, and a linear list layout instead of a professional grid. It needs to look like something you would print and hand to a practice.

## New Design: Black / White / Gold Theme

### Cover Page (Page 1)
- **Solid black** background (not dark grey)
- Large Vitaluxe logo centered
- Gold horizontal rules above and below title
- "PRODUCT CATALOG" in large gold lettering
- Company details in clean white text:
  - Vitaluxe Services
  - 16192 Coastal Highway, Lewes, Delaware 19958
  - (844) 252-5233
  - https://vitaluxeservices.com
- Date generated at bottom in muted text
- "Confidential" footer

### Table of Contents (Page 2)
- Black header bar with gold "TABLE OF CONTENTS" text
- Clean listing with dotted leaders and page numbers
- Gold accent line under each category

### Product Pages -- Grid Layout (2 products per row)
This is the biggest change. Instead of a vertical list, products will be rendered in a **2-column grid** with uniform card sizes:

- Each card is exactly **85mm wide x 95mm tall**
- **Top half**: Product image centered in a light grey box (consistent 40x40mm)
- **Product name** in bold black, 10pt
- **Dosage form** in smaller grey text underneath
- **Gold divider line**
- **"Practice Price"** label in gold
- If single variant: price displayed prominently (e.g., "$68.99")
- If multiple variants: each variant listed line-by-line as "dosage_label .... $price" in a compact format
- Thin black border around each card for a clean, print-ready look

### Category Section Headers
- Full-width black bar with category name in gold, uppercase
- Spans both columns

### Footer (every page except cover)
- Thin gold line at bottom
- "Vitaluxe Services" centered
- Page X of Y right-aligned
- "Confidential -- For Authorized Partners Only" left-aligned

## Technical Changes

### File: `src/lib/productCatalogPdfGenerator.ts` (full rewrite)

Key changes:
1. **Color palette**: Replace `DARK_GREY [55,65,81]` with `BLACK [0,0,0]`; keep gold and white
2. **Grid layout engine**: Calculate 2 columns per page with fixed card dimensions. Track column position (left/right) and advance row when both filled
3. **Uniform card rendering**: Every card gets the same height regardless of content. Variants with many options use smaller font (7pt) to fit within the fixed card height. If a product has too many variants (8+), the card will overflow to use additional vertical space and be treated as a full-width card
4. **Image rendering**: Product images rendered inside a consistent light-grey square placeholder area at the top of each card
5. **Price display**: Show only "Practice Price" (retail_price) -- no base/topline/downline. For single-variant products, show the price large. For multi-variant, list each variant as a row
6. **Page breaks**: When 2-column grid fills the page, auto-break and re-render category header
7. **Print margins**: Use 12mm margins on all sides for proper print bleed

### No other files change
The download button component and AdminSettings integration remain the same.

