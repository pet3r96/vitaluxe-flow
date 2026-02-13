

# PDF Cover Page Logo + Auth Page Dark Background

## Two Changes

### 1. PDF Cover Page -- Bigger Logo on Top
In `src/lib/productCatalogPdfGenerator.ts`, update the cover page section (lines 281-286):

- Move logo to the very top of the page at Y=25mm
- Enlarge logo from 90x34mm to **130x50mm** so it dominates the cover
- Push all content below (gold line, "PRODUCT CATALOG" title, company info, date) further down by increasing `coverY` after the logo to account for the larger size

### 2. Auth Page -- Black Background (Like Screenshot)
In `src/pages/Auth.tsx`, update the login page styling (line 372-378):

- Change the outer `div` background from `bg-gradient-to-b from-background via-background to-muted/20` to a solid near-black: `bg-[#1a1a1a]`
- Remove the Card's conditional light-mode gradient -- use a dark card background consistently: `bg-[#222222]` with subtle border
- This matches the dark, luxurious aesthetic shown in the screenshot with gold accents on a black background
- The dark-bg logo (`logoDark`) is already available and used in dark mode -- ensure it's always used on this page regardless of theme setting
- Update label/text colors to be light (white/gold) to contrast against the dark background

## Technical Details

### File: `src/lib/productCatalogPdfGenerator.ts`
- Line 281: Change `coverY = 45` to `coverY = 25`
- Line 284: Change logo size from `90, 34` to `130, 50` and center with `(pageWidth - 130) / 2`
- Line 285: Change `coverY += 48` to `coverY += 60` for proper spacing after bigger logo

### File: `src/pages/Auth.tsx`
- Line 372: Change outer div to use `bg-[#1a1a1a]` instead of gradient
- Lines 373-378: Update Card className to always use dark styling -- `bg-[#222222] border-gold1/20`
- Line 380: Always use `logoDark` for the logo regardless of theme
- Line 523: Keep the gold button styling as-is (already matches)
- Update form labels and text to use light colors (`text-white`, `text-gray-300`) so they're readable on the dark card
