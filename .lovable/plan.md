

# Remove Subscription Gates from Add Provider and Add Staff

## Problem
The "Add Provider" and "Add Staff" dialogs currently block submission if the practice does not have an active subscription. This is wrong -- practices should be able to add providers and staff members regardless of their subscription status. Subscription status should not gate basic team management.

## Fix (2 files, same change in each)

### A. `src/components/providers/AddProviderDialog.tsx`
- Remove the `useSubscription` import and `isSubscribed` usage (line 29)
- Remove the subscription check block (lines 113-116) that returns early with a toast error

### B. `src/components/staff/AddStaffDialog.tsx`
- Remove the `useSubscription` import and `isSubscribed` usage (line 40)
- Remove the subscription check block (lines 93-96) that returns early with a toast error

## What stays the same
- All other validation (required fields, phone validation, practice selection) remains unchanged
- The edge function `assign-user-role` still handles backend validation and permissions
- Subscription context continues to work for features that actually need it (e.g., portal access)

## Result
Any practice can add providers and staff without being blocked by subscription status.

