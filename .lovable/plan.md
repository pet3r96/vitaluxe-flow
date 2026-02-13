

## Fix: Set Testosterone Products to Require Prescription

### Problem
Three testosterone injectable products added on Feb 13 have `requires_prescription = false`:
- TESTOSTERONE (Injectable)
- TESTOSTERONE CYPIONATE (Injectable)
- TESTOSTERONE CYPIONATE MCT (Injectable)

These are controlled substances and must require a prescription.

### Fix
Run a single database migration to update all three products:

```sql
UPDATE products
SET requires_prescription = true
WHERE id IN (
  'a1b2c3d4-1111-4000-a000-000000000001',
  'a1b2c3d4-2222-4000-a000-000000000002',
  'a1b2c3d4-3333-4000-a000-000000000003'
);
```

No code changes needed -- just a data fix.

