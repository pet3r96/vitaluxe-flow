

# Fix Pro Products Page: Responsive Layout + Naming Consistency

## Issues

1. **Not responsive** — The header (title + buttons) doesn't wrap on smaller screens, causing overflow. The product grid breakpoints could be tighter.
2. **Naming inconsistency** — Page says "Professional Products", cart sheet says "Professional Products Cart". User wants consistent "Pro Products" naming throughout.

## Changes

### 1. `src/pages/ProProducts.tsx`
- Change the header layout to stack on mobile: title on top, buttons below (use `flex-col sm:flex-row` wrapper)
- Rename page title from "Professional Products" to **"Pro Products"**
- Update subtitle to "Pro-use peptides — ships to practice only"
- Move the "Product Catalog" button to admin-only (per earlier approved plan — remove it here, it stays on admin page)
- Adjust grid: `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4` for better breakpoint coverage

### 2. `src/components/pro-products/ProCartSheet.tsx`
- Rename cart title from "Professional Products Cart" to **"Pro Products Cart"**

### 3. `src/components/pro-products/ProProductCard.tsx`
- Tighten padding for smaller cards on mobile (`p-3` instead of `p-4`)
- Make price and button sizing slightly more compact on small screens

Zero functional changes — layout and naming only.

