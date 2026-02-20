
# Fix: Newly Added Patient Not Showing in List

## Root Cause

There is a **double-caching problem** causing the patient list to serve stale data even after a successful insert:

1. **In-memory cache** (`patientService.ts`): A custom `Map`-based cache with a 2-minute TTL sits in front of the database query. When React Query invalidates and re-runs the fetch, it hits this in-memory cache and gets the OLD data back -- the new patient is invisible.

2. **React Query over-caching** (`usePatients.ts`): `staleTime` is set to 5 minutes and the global config disables `refetchOnMount`, so even navigating away and back won't trigger a fresh fetch.

These two caches fighting each other mean it can take up to 2-5 minutes for a new patient to appear.

## Fix

### 1. Remove the in-memory cache from `patientService.ts`

The in-memory cache is redundant -- React Query already caches the result. Having two caches creates exactly this kind of staleness bug. Remove the `patientListCache` Map entirely and let React Query be the single source of truth.

**File: `src/services/patients/patientService.ts`**
- Delete the `CacheEntry` interface, `patientListCache` Map, and `CACHE_TTL` constant
- Remove the cache-check and cache-store logic
- Keep only the actual database fetch logic

### 2. Reduce staleTime in `usePatients.ts`

Change `staleTime` from 300000 (5 min) to 30000 (30 sec) to match the global default. This ensures that when the query is invalidated after adding a patient, it actually refetches.

**File: `src/hooks/usePatients.ts`**
- Change `staleTime: 300000` to `staleTime: 30000`

### 3. Force cache clear on add in `PatientDialog.tsx`

After a successful patient insert, use `removeQueries` before `invalidateQueries` to guarantee no stale cache is returned.

**File: `src/components/patients/PatientDialog.tsx`**
- After insert succeeds, call `queryClient.removeQueries({ queryKey: ["patients"] })` before the invalidation calls
- This ensures React Query discards the cached result entirely and does a fresh fetch

## Expected Result

After these changes:
- Adding a patient triggers an immediate fresh database query
- No in-memory cache can serve stale data
- The new patient appears in the list instantly

## Technical Details

| File | Change |
|------|--------|
| `src/services/patients/patientService.ts` | Remove in-memory cache (Map + TTL logic) |
| `src/hooks/usePatients.ts` | Reduce `staleTime` from 5 min to 30 sec |
| `src/components/patients/PatientDialog.tsx` | Add `removeQueries` before `invalidateQueries` after insert |
