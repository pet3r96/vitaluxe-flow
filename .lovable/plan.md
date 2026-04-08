

# Fix: Practice Address & Signature on Regenerated Prescription

## Problems Found

1. **"Address on file"**: The `order_line_id` branch fetches the provider's personal profile for practice address, but the provider (Mary McMillin) has no address fields. The practice address is on the **practice owner's profile** (`3200 Hayden Road, Scottsdale, AZ 85251`, `Body Preserve Med Spa`). The code never queries the practice profile.

2. **Missing signature**: Line 249 sets `signature: ''` (empty string). The rendering code (line 598) only draws a signature when `signature` is truthy. For the backfill and all future `order_line_id` regenerations, we need to set the signature to the prescriber's name as a generic cursive signature.

## Data Confirmed

- Practice profile: `Body Preserve Med Spa`, `3200 Hayden Road, Scottsdale, AZ 85251`
- Provider profile (Mary McMillin): no address fields set
- Practice ID from providers table links to the practice owner's profile

## Changes

### File: `supabase/functions/generate-prescription-pdf/index.ts`

**Fix 1 — Fetch practice profile for address** (after line 186, in the `order_line_id` branch):
- Query the practice owner's profile using `providers.practice_id` to get `address_street`, `address_city`, `address_state`, `address_zip`, `name` (practice name), and `company`
- Use these to build `practice_name` and `practice_address` in the prescriptionData object (lines 242-245)
- Fallback chain: provider profile address → practice profile address → "Address on file"

**Fix 2 — Set generic signature** (line 249):
- Change `signature: ''` to `signature: providerProfile.name || 'Authorized Prescriber'`
- This renders the prescriber's name in italic/cursive above the signature line

### After deploy: Regenerate Renee Rodriguez PDF
- Call the edge function with `order_line_id: 95d9e316-3cf2-4a6c-8cd9-f54b348b80dd`
- Verify the PDF shows `Body Preserve Med Spa` with `3200 Hayden Road, Scottsdale, AZ 85251` and the signature `Mary McMillin`

## Scope
- 1 file changed: `generate-prescription-pdf/index.ts`
- 1 regeneration call after deploy
- Fixes both this backfill and all future `order_line_id` regenerations

