

# Update Placeholder Text for Representative and Pharmacy Roles

## Change
Make the name field placeholder dynamic based on the selected role:

- **Practice (doctor)**: "Acme Medical Spa" (unchanged)
- **Pharmacy**: "ABC Pharmacy"
- **Representative (topline)**: "Your full name"

## Technical Detail
In `src/pages/Auth.tsx` (line 450), replace the static `placeholder="Acme Medical Spa"` with:

```
placeholder={role === "topline" ? "Your full name" : role === "pharmacy" ? "ABC Pharmacy" : "Acme Medical Spa"}
```

One line change, one file.

