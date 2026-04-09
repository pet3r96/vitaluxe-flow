

# Fix: Attestation Timestamp Displaying in UTC Instead of Local Time

## Problem
The edge function uses `toLocaleString('en-US', ...)` without specifying a `timeZone` option. Deno edge functions run in UTC, so the timestamp shows "Apr 8, 2026, 2:31 AM" instead of the correct local time "Apr 7, 2026, 7:31 PM" (MST/Arizona).

## Fix

### `supabase/functions/generate-prescription-pdf/index.ts` (~lines 717-724)

Add `timeZone: 'America/Phoenix'` to both `toLocaleString` calls for `fullTimestamp`:

```typescript
fullTimestamp = rawTs
  ? new Date(rawTs).toLocaleString('en-US', { 
      month: 'short', day: 'numeric', year: 'numeric', 
      hour: 'numeric', minute: '2-digit', hour12: true,
      timeZone: 'America/Phoenix'
    })
  : date;
```

And for the direct-call path (line 724):
```typescript
fullTimestamp = new Date().toLocaleString('en-US', { 
  month: 'short', day: 'numeric', year: 'numeric', 
  hour: 'numeric', minute: '2-digit', hour12: true,
  timeZone: 'America/Phoenix'
});
```

### After deploy
Regenerate Renee Rodriguez's prescription (`order_line_id: 95d9e316-3cf2-4a6c-8cd9-f54b348b80dd`) so the attestation shows "Apr 7, 2026, 7:31 PM".

## Scope
- 1 file, 2 locale option changes
- 1 regeneration call

