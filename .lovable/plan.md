

# Fix: Profile Address Not Saving / Not Updating Instantly

## Root Cause

There are two issues preventing the client from saving their practice address on the Profile page:

### Issue 1: Save Button Blocked by NPI Verification
The "Save Profile" button is disabled unless NPI verification status is "verified". This means if a practice has any NPI issue (or the verification check hasn't run), they **cannot save any changes** -- including address updates. This is the primary blocker.

**Current code (line 563):**
```
disabled={updateMutation.isPending || npiVerificationStatus !== "verified"}
```

### Issue 2: UI Not Refreshing After Save
When the save does succeed, the cache invalidation key doesn't perfectly match, and the form may not visually update until a hard refresh. The query fetches with key `["practice-profile", effectiveUserId]` but invalidation targets `["practice-profile"]`. While React Query prefix matching should handle this, adding the exact key ensures instant refetch.

---

## Fix Plan

### 1. Decouple NPI verification from the Save button (PracticeProfileForm.tsx, line 563)

Change the Save button to only be disabled during the mutation (loading state). Move NPI verification to a warning/toast on submit instead of blocking the button entirely.

- The Save button will be: `disabled={updateMutation.isPending}`
- On submit, if NPI is not verified, show a warning toast but still allow saving address and other fields
- This unblocks address editing for all practices regardless of NPI status

### 2. Fix cache invalidation key (PracticeProfileForm.tsx, line 183)

Update the invalidation to use the exact query key:
```
queryClient.invalidateQueries({ queryKey: ["practice-profile", effectiveUserId] });
```

Also add `refetchType: 'all'` to force immediate refetch so the UI updates instantly without needing a hard refresh.

### 3. Force form reset after successful save

After mutation success, call `form.reset()` with the new values or let the `values` prop auto-sync by ensuring the refetch completes before showing the success toast.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/profile/PracticeProfileForm.tsx` (line 563) | Remove NPI check from Save button disabled state |
| `src/components/profile/PracticeProfileForm.tsx` (line 183) | Fix invalidation query key to include effectiveUserId |
| `src/components/profile/PracticeProfileForm.tsx` (line 194-213) | Move NPI validation to a warning instead of a hard block |

## Expected Result
- Clients can save address changes regardless of NPI verification status
- After saving, the UI updates instantly without needing a page refresh
- NPI verification still shows a warning but doesn't block other profile updates

