

# Fix PDF Cover Page: Dark Grey Background + Logo

## Problems Identified
1. **Logo not appearing**: The `fetchLogo()` function fetches from storage but likely fails silently (CORS or fetch issue). Need to add better error handling and logging, and also ensure the logo image format is handled correctly (try JPEG format fallback in `addImage`).
2. **Background is pure black**: The cover uses `BLACK [0,0,0]` but user wants the darker greyish-black. Will use `DARK_BG [35,35,35]` instead for a softer, more premium look.

## Changes in `src/lib/productCatalogPdfGenerator.ts`

### 1. Cover page background color (line 278)
- Change `doc.setFillColor(...BLACK)` to `doc.setFillColor(...DARK_BG)` so the cover is a charcoal grey (#232323) rather than pure black

### 2. Fix logo loading (lines 282-286)
- Change `addImage` format from `'PNG'` to `'AUTO'` so jsPDF auto-detects the image format (in case the file isn't strictly PNG)
- Add a fallback: if the storage URL fetch fails, try a direct URL construction as backup
- Keep the large size (130x50mm) and Y=25mm positioning

### 3. Ensure "PRODUCT CATALOG" text and company info contrast
- The gold text and white text will still look great on the dark grey background -- no changes needed there

## Summary
Two small targeted edits: swap `BLACK` to `DARK_BG` on line 278, and change `'PNG'` to `'AUTO'` on line 284 to fix the logo rendering.
