
# Fix Batch Image Generation - Process 10 at a Time with Proper Pacing

## Problem
The current setup sends batches of 5 to the edge function, but calls the next batch immediately after the previous one finishes. This can cause:
- Edge function timeouts (each image takes 3-5 seconds to generate via AI)
- Rate limiting from the AI gateway
- The function failing silently after ~10 images

## Solution

### 1. Reduce batch size to 3 per edge function call
Each edge function invocation will process only **3 images** (with 2-second delays between each = ~10 seconds per call). This keeps well within the edge function timeout limit.

### 2. Add a 5-second pause between batch calls on the frontend
After each batch completes, wait 5 seconds before calling the next batch. This prevents rate limiting and gives the AI gateway breathing room.

### 3. Better error handling - continue on failure
If one batch fails, log it and continue to the next batch instead of stopping everything.

## Changes

### `src/components/admin/ProductImageGenerator.tsx`
- Change `batchSize` from 5 to 3
- Add a 5-second delay (`await new Promise(resolve => setTimeout(resolve, 5000))`) between each batch call
- Wrap individual batch calls in try/catch so one failure doesn't stop the whole process
- Show clearer progress messaging ("Generating batch X of Y...")

### `supabase/functions/batch-generate-product-images/index.ts`
- Increase the delay between individual images from 2 seconds to 3 seconds for safety
- Add better timeout handling

## Expected Behavior
- ~58 products missing images
- 3 per batch = ~20 batches
- Each batch takes ~12 seconds (3 images x 3s delay + generation time)
- 5-second pause between batches
- Total time: ~6-8 minutes for all products
- Progress bar updates after each batch of 3
