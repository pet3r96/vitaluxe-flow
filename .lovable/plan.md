

# Bigger Cards, Bigger Images, 6 Per Page + More Visual Polish

## What Changes

### Layout: 6 products per page (3 rows x 2 columns)
Currently the cards are 85x95mm which only fits 2 rows (4 per page). The new layout adjusts dimensions to fit 3 rows while making images noticeably larger:

- Card width: 85mm -> **90mm** (wider, uses more page width)
- Card height: 95mm -> **82mm** (slightly shorter to fit 3 rows)
- Image size: 38mm -> **48mm** (significantly larger product photos)
- Column gap: 6mm -> **6mm** (stays the same)
- Row gap: 4mm -> **3mm** (tighter spacing)

### Visual "Wow" Enhancements
- Add a subtle **gold border** on hover-style effect (double-line border: thin black outer + gold inner accent line)
- Add a **soft gold gradient bar** behind the "Practice Price" label instead of just text
- Use a **rounded rectangle** for the image placeholder area instead of a sharp box
- Add a thin **gold corner accent** marks on each card (small L-shaped lines in corners)
- Make the category header bar taller with a subtle gold underline accent
- Increase product name font size from 9pt to **10pt**
- Make single-variant prices larger: 12pt -> **14pt** for more impact

### File Changed
Only `src/lib/productCatalogPdfGenerator.ts` -- layout constants and the `drawCard` function get updated.

## Technical Details

### Updated Constants
```
CARD_W = 90      (was 85)
CARD_H = 82      (was 95)
IMG_SIZE = 48     (was 38)
ROW_GAP = 3      (was 4)
```

### drawCard enhancements
1. Gold accent lines in card corners (4mm L-shapes)
2. Gold-filled rectangle behind "Practice Price" text
3. Larger image rendering area
4. Bigger product name (10pt bold)
5. Bigger single-variant price (14pt bold)
6. Variant text bumped to 7pt from 6.5pt
7. Max variant lines reduced from 7 to 5 (shorter card)

### Page break math
- Usable height: 297mm - 26mm (header) - 14mm (footer) = 257mm
- 3 rows x 82mm + 2 gaps x 3mm = 252mm -- fits perfectly

