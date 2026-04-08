

# Fix: Reduce Medication Name Font Size on Rx Pad

## Change

### `supabase/functions/generate-prescription-pdf/index.ts` (line 492)
Change `doc.setFontSize(22)` → `doc.setFontSize(12)` for the medication name in the Rx pad box.

Single line change. Edge function auto-deploys.

