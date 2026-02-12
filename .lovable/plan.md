

# Fix: Variant Text Overflowing Card Boundaries

## Problem
The card is 82mm tall, the image is 48mm (starting 3mm from top = bottom at 51mm), leaving only 31mm for text content. With the recent spacing increases, multi-variant products overflow past the card border, getting cut off or bleeding into the next row.

## Solution
Reduce image size slightly and tighten the top-of-card spacing to reclaim vertical room for text content. The image will still be much larger than the original 38mm.

### Changes to `src/lib/productCatalogPdfGenerator.ts`

1. **Reduce IMG_SIZE from 48 to 42mm** -- still large and prominent, but frees up 6mm for text
2. **Reduce image top padding from 3mm to 2.5mm** -- small savings
3. **Reduce gap after image from 5mm to 4mm** -- tighter transition to text
4. **Reduce gap after product name from 5mm to 3.5mm**
5. **Reduce gap after dosage form from 4mm to 3mm**
6. **Reduce gold bar follow-up from 5.5mm to 4.5mm**
7. **Keep variant line height at 4mm** -- this was a good readability improvement

Net effect: ~10mm reclaimed for text area, preventing overflow while keeping images noticeably larger than the original 38mm and maintaining readable spacing between price lines.

