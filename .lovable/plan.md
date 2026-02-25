

# Add "Product Catalog" Download Button to Products Page

## What we're doing

Adding a "Product Catalog" download button next to the existing "Don't see a product?" button in the Products page toolbar. This will let providers, staff, and other users download the professionally branded PDF catalog directly from the products page.

## Where it goes

The button will appear in the top toolbar of the Products page, right next to the "Don't see a product?" button -- visible to the same roles that can see products (providers, staff with ordering privileges, and admins).

## Technical steps

**File: `src/components/products/ProductsGrid.tsx`**

1. Import `FileDown` icon from lucide-react and `generateProductCatalogPDF` from the existing PDF generator
2. Add a `catalogGenerating` state variable
3. Add a "Product Catalog" button in the toolbar area (around line 967-978), placed just before or after the "Don't see a product?" button
4. The button triggers the existing `generateProductCatalogPDF()` function (already fully built and working in `src/lib/productCatalogPdfGenerator.ts`)
5. Show a loading spinner while generating, then auto-download the PDF
6. The button will be visible to all authenticated roles viewing the products page (not restricted to admin)

**No new files or dependencies needed** -- the PDF generator and all supporting code already exist. This is purely a UI wiring change in one file.

