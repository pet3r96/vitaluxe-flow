

# Add Representative Signup Option

## What You'll See
A third "Representative" option will appear in the signup form alongside "Practice" and "Pharmacy." When selected:
- The name field label changes to **"Contact Name"**
- Only **Phone Number** (required) and **Company Name** (required) fields appear below
- **Email** and **Password** are already part of the form for everyone -- they're at the bottom of the signup form and will remain required

## What Changes

### `src/pages/Auth.tsx`

1. **Role type** -- extend from `"doctor" | "pharmacy"` to `"doctor" | "pharmacy" | "topline"` (internal name, never shown to user)

2. **Radio buttons** -- add a third option:
   - Value: `topline`
   - Label: **Representative**

3. **Name field label** (currently hardcoded as "Practice Name") -- make dynamic:
   - doctor: "Practice Name"
   - pharmacy: "Pharmacy Name"
   - topline: "Contact Name"

4. **Representative fields block** -- when `role === "topline"`, show:
   - Phone Number (required, reuses existing `phone` state)
   - Company Name (required, reuses existing `company` state)

5. **Submit validation** -- add `else if (role === "topline")` block requiring phone and company

6. **Role data for signup** -- add a third branch:
   ```
   roleData = { phone, company }
   ```

### No backend changes needed
The role assignment function already handles the `topline` role for self-signup.

