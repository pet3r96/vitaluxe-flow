

# Fix Google Maps, Practice NPI, and Provider NPI Validation on Signup

## Three Problems

1. **Google Maps Address Autocomplete** shows "This page can't load Google Maps correctly" because the client-side environment variable `VITE_GOOGLE_MAPS_API_KEY` is not set. A `GOOGLE_API_KEY` exists for backend functions but is not accessible to the browser.
2. **Practice NPI field** has zero validation -- it accepts any number of characters, letters, and symbols.
3. **Provider NPI field** has `maxLength={10}` but still accepts letters and does not verify against the national registry (NPPES) before allowing signup.

---

## Fix 1: Google Maps API Key

The `VITE_GOOGLE_MAPS_API_KEY` environment variable needs to be configured. This is a client-side key that must be added to the project's environment. You will be prompted to enter your Google Maps API key (it may be the same key as `GOOGLE_API_KEY` if that key has the Maps JavaScript API and Places API enabled).

---

## Fix 2: Practice NPI Input Validation

**File:** `src/pages/Auth.tsx` (line 424)

- Add `maxLength={10}` to the Practice NPI input
- Restrict input to digits only (strip non-numeric characters on change)
- Show validation message when length is not 0 and not 10
- Add red border when invalid

---

## Fix 3: Provider NPI Input Validation

**File:** `src/pages/Auth.tsx` (line 463)

- Restrict input to digits only (strip non-numeric characters on change)
- Keep existing `maxLength={10}` and visual feedback

---

## Fix 4: NPI Format Validation on Submit

**File:** `src/pages/Auth.tsx` (lines 131-153)

Add to the doctor validation block:
- Check that Provider NPI is exactly 10 digits (digits only)
- Check that Practice NPI, if provided, is also exactly 10 digits
- Call the existing `verify-npi` edge function to validate Provider NPI against the NPPES registry before allowing signup
- Show clear error messages for each case

---

## Technical Details

### Input Sanitization (both NPI fields)
```text
onChange handler: strip all non-digit chars
  e.target.value.replace(/\D/g, '')
```

### Practice NPI Input (line 424)
- Add `maxLength={10}`
- Add conditional border class like Provider NPI already has
- Add helper text below

### Submit Validation (lines 131-153)
- Regex check: `/^\d{10}$/` for Provider NPI (required)
- Regex check: `/^\d{10}$/` for Practice NPI (only if non-empty)
- Call `verify-npi` edge function for Provider NPI
- If NPI not found in registry, show error and block submission
- If registry unavailable, allow submission with a warning toast

### Google Maps
- Prompt for `VITE_GOOGLE_MAPS_API_KEY` to be added as a project environment variable

