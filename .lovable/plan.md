
# Restore AI Product Image Generator in Admin Settings

## What Happened

The backend functions for AI image generation are still deployed and functional:
- `generate-product-image` - generates a single product image using Gemini 3 Pro
- `batch-generate-product-images` - generates images for all products missing them

However, the **UI component** that let you trigger these from Admin Settings was removed. There is no button or panel anywhere in the app to generate images.

## What Will Be Built

A new **"AI Images"** tab in Admin Settings with:

1. **Batch Generate Missing Images** button - scans all products, finds ones without images, and generates AI images for each using the existing edge function
2. **Progress tracker** - shows how many images have been generated, how many remain, and any failures
3. **Single Product Regenerate** - ability to pick a specific product and regenerate its image
4. **Preview grid** - shows products with/without images so you can see what needs generation

## UI Layout

The tab will show:
- A summary card: "X products missing images out of Y total"
- A "Generate All Missing Images" button with progress bar
- A grid of product cards showing current image (or placeholder), with individual "Regenerate" buttons
- Status indicators (generating, success, failed) per product

## Technical Details

### New File
- `src/components/admin/ProductImageGenerator.tsx` - the main component

### Changes
- `src/pages/AdminSettings.tsx` - add new "AI Images" tab with ImageIcon

### How It Works
- Calls `batch-generate-product-images` edge function for bulk generation
- Calls `generate-product-image` for individual regeneration
- Both functions already handle: AI prompt generation, image creation via Gemini 3 Pro, upload to storage bucket, and returning the public URL
- The component will poll/track progress and update the UI in real-time
- 2-second delay between images is already built into the batch function to respect rate limits
