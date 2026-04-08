
# Emergency fix: regenerate the correct patient PDF and stop stale scripts from being reused

## What I found

1. The Rx pad layout is still not being rendered from truly wrapped text.
   - In `supabase/functions/generate-prescription-pdf/index.ts`, the code calculates wrapped SIG lines with `splitTextToSize`, but it still draws the raw `sig` string with `doc.text(...)`.
   - The medication name is also drawn as one raw string inside the box.
   - Result: long medication names overflow, SIG text spills, and Quantity/Notes drift into the wrong place.

2. The wrong PDF can still be reused even after generation logic changes.
   - The `order_line_id` regeneration path returns a new `prescription_url`, but it does not persist that new URL back to `order_lines.prescription_url`.
   - The resend flow (`send-vios-order`) still reads the stored `orderLineData.prescription_url`.
   - The download UI also prefers the existing stored URL.
   - Result: the old office-dispensing PDF keeps getting downloaded/sent, which is why it looks like “it did not regenerate.”

3. The patient/practice labeling logic is now mostly correct for new generation.
   - `PrescriptionWriterDialog` passes `shipTo`
   - `generate-prescription-pdf` order-line mode uses `orderLine.orders.ship_to === 'practice'`
   - So the remaining issue is not just logic; it is that the stale PDF is still the one being used.

## Fix plan

### 1. Make the PDF layout deterministic in `generate-prescription-pdf`
Refactor the Rx body so it renders explicit wrapped line arrays instead of raw strings:
- create `medLines = doc.splitTextToSize(medText, availableWidth)`
- create `sigLines = doc.splitTextToSize(sigText, availableWidth)`
- render both line-by-line
- compute medication box height from `medLines.length`
- compute `quantityY` and `notesY` from the actual rendered SIG block height

This will fix:
- medication name overflow
- oversized-looking product text
- SIG overflow
- Quantity overlap
- spacing inconsistencies on future orders

### 2. Make regeneration replace the stale prescription on the order line
In the `order_line_id` branch of `generate-prescription-pdf`:
- after upload succeeds, update that `order_lines` row with the new `prescription_url`
- keep returning the new URL in the response

This is the core fix for the “did not regenerate” problem.

### 3. Make resend use a fresh PDF, not whatever old URL is stored
Harden the pharmacy submission backend so a resend does not rely on an outdated script:
- regenerate from `order_line_id` before sending, or
- otherwise guarantee the send path uses the just-updated `prescription_url`

I would do this in the backend send flow so it protects:
- Order Details resend
- pharmacy workflow resend
- future send paths using the same backend

### 4. Keep patient/practice labeling tied to `orders.ship_to`
Use the order record as the source of truth for regenerated/send-time PDFs.
That ensures:
- patient orders never show “DISPENSING IN OFFICE ONLY”
- practice orders still do
- future UI state issues cannot flip the label incorrectly

### 5. Backfill Renee Rodriguez immediately after the code fix
For order line `95d9e316-3cf2-4a6c-8cd9-f54b348b80dd`:
- regenerate through the corrected `order_line_id` path
- verify the PDF shows patient info instead of office-only
- confirm the order line now stores the corrected `prescription_url`
- resend that corrected PDF to the pharmacy API

## Files to change
- `supabase/functions/generate-prescription-pdf/index.ts`
- `supabase/functions/send-vios-order/index.ts` or `supabase/functions/send-order-to-pharmacy/index.ts`

## Expected result
- Renee’s PDF is actually replaced, not just theoretically regenerated
- the medication name, SIG, and Quantity all fit correctly
- the patient info box shows patient data for patient shipments
- future orders and resends use the corrected PDF path automatically
