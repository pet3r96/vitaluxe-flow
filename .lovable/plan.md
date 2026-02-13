

## Add Days Supply to Prescription Writer Dialog

### Problem
The "Days Supply" field was added to the patient selection step but is missing from the Prescription Writer Dialog (the form shown in your screenshot). It needs to appear there too so:
1. The prescriber can see/edit it while writing the prescription
2. It gets included on the generated prescription PDF
3. The value flows back to the parent dialog

### Changes

**1. PrescriptionWriterDialog.tsx** -- Add Days Supply input field

- Add `initialDaysSupply` prop (string) and `daysSupply` state
- Add a required numeric input field labeled "Days Supply *" between the SIG field and Additional Notes
- Include preset buttons for 30, 60, 90 days (matching the patient selection step)
- Allow custom entry (e.g., 14) with validation (1-365)
- Pass `daysSupply` back through the `onPrescriptionGenerated` callback (add it as a 7th parameter)
- Include `days_supply` in the data sent to the `generate-prescription-pdf` edge function so it appears on the PDF

**2. PatientSelectionDialog.tsx** -- Wire up the new prop

- Pass current `daysSupply` value as `initialDaysSupply` to PrescriptionWriterDialog
- Update the `onPrescriptionGenerated` callback to accept the returned `daysSupply` value and sync it back to state

### Technical Details

- The field will appear after "SIG - Directions for Use" and before "Additional Notes"
- Same validation as PatientSelectionDialog: positive integer, 1-365
- The `onPrescriptionGenerated` callback signature changes from 6 to 7 parameters (adding `daysSupply: string`)
- The `generate-prescription-pdf` edge function receives `days_supply` in its body payload for inclusion on the PDF

