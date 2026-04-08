

# Backfill Order ae8f1f44 for Pharmacy Submission

## What

The order line `95d9e316` has `provider_id = null` and `custom_sig = null`. The practice has exactly one active provider: **Mary McMillin** (`9e8dd207`, NPI `1104570043`). We need to update both fields so the "Send to Pharmacy" action succeeds.

## Database Update (migration)

```sql
UPDATE order_lines
SET 
  provider_id = '9e8dd207-6469-45ed-971e-c40f7eaa0838',
  custom_sig = 'Inject subcutaneously once weekly as directed by prescriber'
WHERE id = '95d9e316-3cf2-4a6c-8cd9-f54b348b80dd'
  AND provider_id IS NULL;
```

Single migration, single row update. After this, retrying "Send to Pharmacy" on this order should pass VIOS validation.

## No Code Changes

The code fixes from the previous task already prevent this from happening on future orders.

