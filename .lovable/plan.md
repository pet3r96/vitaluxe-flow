

# Add Attestation as Page 2 of Prescription PDF

## Summary
Add a second page to every prescription PDF that renders the medical attestation form, including the attestation points, a timestamp of when the order was placed, and the provider's signature. Backfill for Renee Rodriguez's order after deploy.

## Changes

### 1. `supabase/functions/generate-prescription-pdf/index.ts`

After the existing page 1 rendering (before the PDF output at ~line 693), add a new page:

- `doc.addPage('letter')` 
- Render a professional header: "MEDICAL ATTESTATION" centered, with VitaLuxe branding
- Fetch the attestation content from `checkout_attestation` table (there's only one row)
- Render each attestation bullet point as a formatted list item
- Add a checkbox visual (filled) next to the checkbox text ("I agree to all of the above")
- Add timestamp: use the order's `created_at` date/time (already available as `date` variable for page 1, but we need the full datetime — pull from `orderLine.orders.created_at` or `prescriptionData.date`)
- Add provider signature (reuse the same cursive rendering from page 1) and prescriber name
- Add a "Date & Time of Attestation" field showing the order creation timestamp with time

**Data needed**: Fetch `checkout_attestation` content inside the edge function. For the `order_line_id` path, the order `created_at` is already fetched via `orderLine.orders.created_at`. For the direct-call path, pass the current timestamp.

**Attestation page layout** (letter size, inches):
```text
+------------------------------------------+
|        MEDICAL ATTESTATION               |
|        VitaLuxe Services                 |
|------------------------------------------|
|                                          |
|  Title: Medical Attestation Required     |
|  Subtitle: Please read and confirm...    |
|                                          |
|  By checking the box below, you attest:  |
|                                          |
|  • Point 1                               |
|  • Point 2                               |
|  • Point 3                               |
|  • Point 4                               |
|  • Point 5 (long clinical attestation)   |
|                                          |
|  [X] I agree to all of the above        |
|                                          |
|  Date & Time: Apr 8, 2026, 2:14 PM      |
|                                          |
|  _____Provider Signature_____            |
|  Prescriber: Mary McMillin               |
+------------------------------------------+
```

### 2. Backfill Renee Rodriguez

After deploying, call the edge function with `order_line_id: 95d9e316-3cf2-4a6c-8cd9-f54b348b80dd` to regenerate with the attestation page.

## Scope
- 1 file changed: `generate-prescription-pdf/index.ts`
- 1 regeneration call after deploy
- No database/migration changes (attestation content is read from existing `checkout_attestation` table)

