
# Beautiful Product Catalog PDF

## Overview

Build a downloadable product catalog PDF featuring the Vitaluxe branding, company info, product images, and complete variant pricing -- organized by category for a polished, professional look.

## PDF Layout

### Cover Page
- Large Vitaluxe logo (centered, fetched from `branding-assets` storage bucket)
- "PRODUCT CATALOG" title in gold
- Company info block:
  - Vitaluxe Services
  - 16192 Coastal Highway, Lewes, Delaware 19958
  - Phone: (844) 252-5233
  - Website: https://vitaluxeservices.com
- Date generated

### Table of Contents (Page 2)
- Lists all 8 categories with page numbers:
  - Anti-Aging (6 products)
  - GLP-1 (6 products)
  - Hair Care (3 products)
  - Hormone Therapy (25 products)
  - Peptides (1 product)
  - Sexual Health (8 products)
  - Thyroid (4 products)
  - Vitamins (5 products)

### Product Pages (grouped by category)
Each category gets a section header, then each product is displayed as a card-style block:
- **Product image** (loaded from public URL) on the left
- **Product name** and dosage form on the right
- **Variants table** below with columns: Dosage/Size, Practice Price
- Alternating row shading for readability
- Page breaks between categories

### Footer (every page)
- "Vitaluxe Services" centered
- Page number
- "Confidential - For Authorized Partners Only"

## Implementation

### New Files
1. **`src/lib/productCatalogPdfGenerator.ts`** - Core PDF generation logic using jsPDF + autoTable (same libraries already in use)
2. **`src/components/admin/ProductCatalogDownload.tsx`** - Button component to trigger generation and download

### Changes
- **`src/pages/AdminSettings.tsx`** - Add a "Download Product Catalog" button (in the existing Products/AI Images area or a new spot)

### How It Works
1. Fetches all active products with variants from the database
2. Fetches all product images as base64 (from their public URLs)
3. Fetches the Vitaluxe logo from the `branding-assets` storage bucket
4. Groups products by category (product_type)
5. Renders each product with its image and variant pricing table
6. Outputs as a downloadable PDF blob

### Pricing Display
- Shows **Practice Price** (retail_price) only -- this is the price practices pay
- Base price is internal and will NOT be shown in the catalog
- Formatted as currency with 2 decimal places

### Image Handling
- Product images fetched from their public storage URLs and converted to base64 for PDF embedding
- Logo fetched from `branding-assets` bucket (same pattern as order receipt)
- Fallback placeholder if any image fails to load

### Color Scheme
- Dark grey header bars (#374151) matching existing PDF branding
- Gold accents (#DAA520) for titles and dividers
- Clean white background with light grey alternating rows
