

# Complete Audit: Admin IP Filter Blocking Browser-Based Operations

## Problem
The `enforceAdminIP` middleware blocks any request originating from an IP not in the admin allowlist. Since admin users access the application from their browser (with varying IPs), this blocks legitimate admin operations performed through the UI.

This is the same class of bug that broke self-signup. It affects **5 edge functions** with **7 IP check points**.

## Affected Functions and Impact

### 1. `manage-entity-status` (3 IP check points)

| Action | Who calls it from browser | IP check applied to | Impact |
|--------|--------------------------|---------------------|--------|
| `provider-status` | Admin users (non-doctors) via ProvidersDataTable | Admins only (doctors bypass) | Admin cannot toggle provider active/inactive from browser |
| `staff-status` | Admin users (non-doctors) via StaffDataTable, StaffDetailsDialog | Admins only (doctors bypass) | Admin cannot toggle staff active/canOrder from browser |
| `status-configs` | Admin users via OrderStatusManager | All requests | Admin cannot create/update/delete order status configs from browser |

**Doctor users are NOT affected** -- they already bypass the IP check. Only admin-role users are blocked.

### 2. `cleanup-test-data` (1 IP check point)
- Called from: AccountsDataTable, PatientsDataTable, PendingPracticesApproval, FactoryResetManager
- Impact: Admin cannot clean up test accounts from the browser UI

### 3. `factory-reset` (1 IP check point)
- Called from: FactoryResetManager component
- Impact: Admin cannot run factory reset from browser UI

### 4. `delete-all-orders` (1 IP check point)
- Called from: FactoryResetManager component
- Impact: Admin cannot delete all orders from browser UI

### 5. `assign-user-role` (already fixed)
- Self-signup and pharmacy-staff creation now correctly bypass the IP check

## Root Cause
The IP filter was designed for server-to-server admin operations but was applied to functions that admins invoke from the browser UI. Browser requests come from the user's ISP-assigned IP, which will almost never be in the allowlist.

## Proposed Fix

**Remove `enforceAdminIP` from all browser-invoked functions.** These functions already have proper security:

- **Authentication**: All require a valid JWT (logged-in user)
- **Role checks**: All verify the caller has admin/doctor role before proceeding
- **RLS policies**: Database-level access controls are enforced

The IP filter should only be used for truly server-side automation (cron jobs, webhooks) -- not for browser-based admin dashboards.

### Changes by file:

#### A. `supabase/functions/manage-entity-status/index.ts`
- **Lines 81-85**: Remove the `enforceAdminIP` block for `provider-status` action
- **Lines 166-170**: Remove the `enforceAdminIP` block for `staff-status` action
- **Lines 388-390**: Remove the `enforceAdminIP` block for `status-configs` action
- Remove the `enforceAdminIP` import (line 4)

#### B. `supabase/functions/cleanup-test-data/index.ts`
- **Lines 50-52**: Remove the `enforceAdminIP` block
- Remove the `enforceAdminIP` import (line 6)

#### C. `supabase/functions/factory-reset/index.ts`
- **Lines 46-48**: Remove the `enforceAdminIP` block
- Remove the `enforceAdminIP` import (line 5)

#### D. `supabase/functions/delete-all-orders/index.ts`
- **Lines 24-26**: Remove the `enforceAdminIP` block
- Remove the `enforceAdminIP` import (line 5)

#### E. `supabase/functions/assign-user-role/index.ts`
- **Lines 121-123**: Remove the remaining `enforceAdminIP` block entirely (admin-created users are also done from the browser by admins)
- Remove the `enforceAdminIP` import (line 11)

### Security remains intact because:
1. All functions require authenticated JWT tokens
2. All functions verify admin/doctor role before executing
3. Database RLS policies provide an additional layer of protection
4. Rate limiting is in place where applicable
5. CSRF validation is enforced on sensitive operations

### What `enforceAdminIP` should be reserved for:
- Cron-triggered functions (already use `x-cron-secret` instead)
- External webhook endpoints (if any are added in the future)
- NOT browser-invoked admin operations

