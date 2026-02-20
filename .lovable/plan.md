
# Fix NPI Validation and Google Maps on Signup Page

## Overview
Copy the working NPI verification pattern from the admin code (AddPracticeRequestDialog) into Auth.tsx, and fix Google Maps by loading the API key at runtime from the backend.

---

## 1. NPI Validation (copy from admin pattern)

### Practice NPI Field (line 424 of Auth.tsx)
- Restrict to digits only: `e.target.value.replace(/\D/g, '')`
- Add `maxLength={10}`
- Add red border when invalid (non-empty and not 10 digits)
- Add helper text below

### Provider NPI Field (line 463 of Auth.tsx)
- Restrict to digits only: `e.target.value.replace(/\D/g, '')`
- Keep existing `maxLength={10}` and visual feedback

### Real-time NPI Registry Verification (Provider NPI)
Replicate the exact pattern from `AddPracticeRequestDialog.tsx`:
- Add `npiVerificationStatus` state (`null | "verifying" | "verified" | "failed"`)
- Add `useRef` for `currentNpiRef` to guard against stale callbacks
- Import and use `verifyNPIDebounced` from `@/lib/npiVerification`
- When Provider NPI reaches 10 digits, automatically verify against the national registry
- Show status indicators below the field:
  - "Verifying NPI..." while checking
  - "NPI Verified" (green) on success
  - "Invalid NPI" (red) on failure
- Block form submission if NPI is not verified (same as admin flow)

### Submit Validation (lines 130-153 of Auth.tsx)
- Add check: if Provider NPI verification status is not "verified", block submission with clear error
- Add regex check for Practice NPI if non-empty

---

## 2. Google Maps Fix

The `VITE_GOOGLE_MAPS_API_KEY` is a client-side environment variable that is not currently set. The backend already has `GOOGLE_API_KEY` configured.

### Solution: Create a small edge function `get-google-maps-key`
- Returns the `GOOGLE_API_KEY` value for client-side use
- The google-address-autocomplete component will fetch this key at runtime instead of relying on `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`

### Changes to `google-address-autocomplete.tsx`
- Add a `useEffect` to fetch the API key from the edge function on mount
- Use the fetched key in `useLoadScript` instead of `import.meta.env`
- Show loading state while the key is being fetched

### New edge function: `supabase/functions/get-google-maps-key/index.ts`
- Returns `{ key: GOOGLE_API_KEY }` from the server-side secret
- Requires authentication (only logged-in or signing-up users can access)
- Actually, since this is used on the signup page before auth, it should be accessible without auth but rate-limited

---

## Technical Details

### Files Modified
1. **`src/pages/Auth.tsx`** -- Add NPI verification state, import `verifyNPIDebounced`, sanitize NPI inputs, block submit on unverified NPI
2. **`src/components/ui/google-address-autocomplete.tsx`** -- Fetch API key at runtime from edge function instead of env var
3. **New: `supabase/functions/get-google-maps-key/index.ts`** -- Expose Google Maps API key for client-side use

### NPI Verification Flow (copied from admin)
```text
User types NPI -> strip non-digits -> update state
  if length < 10: status = null (no feedback)
  if length = 10: status = "verifying"
    -> verifyNPIDebounced(npi, callback)
      -> callback checks currentNpiRef matches
        -> valid: status = "verified", toast success
        -> invalid: status = "failed", toast error

On submit:
  if npiVerificationStatus !== "verified" -> block with error
```
