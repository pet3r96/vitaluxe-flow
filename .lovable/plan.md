

# AI-Generated Images for Professional Use Products

## Current State
- The `pro_products` table has **no `image_url` column** — needs to be added via migration.
- The existing `generate-product-image` edge function generates images for pharmaceutical products and uploads to the `product-images` storage bucket. It works well but its prompts don't include "Professional Use Only" text.
- The `ProProductCard` component currently shows no image.

## Plan

### 1. Database Migration
Add `image_url text` column to `pro_products`.

### 2. New Edge Function: `generate-pro-product-image`
A dedicated edge function (separate from the existing one to maintain isolation) that:
- Takes `productName` from the `pro_products` table
- Uses the same Gemini 3 Pro Image Preview model via AI Gateway
- Generates prompts that **always include "PROFESSIONAL USE ONLY" prominently on the vial/label/packaging** — this is the key differentiator from the existing pharmaceutical images
- All products are peptide injection vials, so prompts will focus on clear glass vials with sterile medical labels showing both the product name and "Professional Use Only"
- Uploads to the same `product-images` storage bucket under a `pro/` prefix
- Updates the `pro_products.image_url` column with the public URL

### 3. Admin UI: Pro Product Image Generator
Add a new component `ProProductImageGenerator` (similar to the existing `ProductImageGenerator`) on the `ProProductsAdmin` page that:
- Shows which pro products have images and which don't
- "Generate All Missing" button for batch generation
- Individual "Regenerate" button per product
- Progress tracking during batch generation

### 4. Update `ProProductCard` to Display Images
Show the product image at the top of each card when `image_url` is present, with a placeholder/icon fallback when missing.

### 5. Update Types
The `ProProduct` interface in `useProProductsAdmin.ts` needs `image_url: string | null` added.

## Files

| Action | File |
|--------|------|
| Create | `supabase/functions/generate-pro-product-image/index.ts` |
| Create | `src/components/admin/ProProductImageGenerator.tsx` |
| Create | Migration: add `image_url` to `pro_products` |
| Modify | `src/hooks/useProProductsAdmin.ts` — add `image_url` to interface |
| Modify | `src/components/pro-products/ProProductCard.tsx` — show image |
| Modify | `src/pages/ProProductsAdmin.tsx` — add image generator section |

## Prompt Strategy
Every pro product image prompt will include:
> "Professional injection vial for '{productName}'. Clear glass vial with white medical label showing '{productName}' prominently AND the text 'PROFESSIONAL USE ONLY' clearly visible on the label. Sterile clinical setting. Ultra high resolution pharmaceutical product photography. Clean white/gray gradient background."

## Zero-Touch Guarantee
No changes to existing `generate-product-image`, `ProductImageGenerator`, `products` table, or any pharmaceutical/billing flows.

