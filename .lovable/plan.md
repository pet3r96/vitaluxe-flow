

# Fix: Pharmacy RLS Infinite Recursion + System-Wide Audit

## Problem

The pharmacy page is STILL blank because the previous fix (making `has_role()` SECURITY DEFINER) only fixed part of the problem. There is a **second recursion loop** between two tables:

```text
pharmacies (policy: pharmacy_manage_own_record)
    --> subquery on pharmacy_staff
        --> pharmacy_staff (policy: pharmacy_owner_manage_staff)
            --> subquery on pharmacies
                --> INFINITE LOOP
```

Your pharmacy data (Vios Compounding, API config, credentials, 50 states) is all still there -- it just can't be read due to this policy loop.

## Fix

### Step 1: Break the pharmacies-pharmacy_staff circular dependency

Create a SECURITY DEFINER function that checks pharmacy staff membership without triggering RLS:

```sql
CREATE OR REPLACE FUNCTION public.is_pharmacy_member(_user_id uuid, _pharmacy_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pharmacy_staff
    WHERE user_id = _user_id AND pharmacy_id = _pharmacy_id AND active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_pharmacy_owner(_user_id uuid, _pharmacy_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pharmacies
    WHERE id = _pharmacy_id AND user_id = _user_id
  )
$$;
```

### Step 2: Replace the recursive policies

Drop and recreate the problematic policies on both tables:

- **pharmacies.pharmacy_manage_own_record**: Replace subquery on `pharmacy_staff` with call to `is_pharmacy_member()`
- **pharmacy_staff.pharmacy_owner_manage_staff**: Replace subquery on `pharmacies` with call to `is_pharmacy_owner()`

### Step 3: Fix admin_alerts duplicate/broken policy

The `admin_alerts` table has a policy that directly queries `user_roles` instead of using `has_role()`. While not currently causing recursion, it should be cleaned up for consistency.

## System-Wide Audit Findings

| Issue | Severity | Status |
|-------|----------|--------|
| pharmacies <-> pharmacy_staff RLS recursion | CRITICAL | Will fix |
| admin_alerts direct user_roles query | LOW | Will fix |
| Many tables use direct `EXISTS(SELECT FROM user_roles)` | LOW | Safe (user_roles has `user_id = auth.uid()` policy that resolves without recursion) |
| `has_role()` now SECURITY DEFINER | DONE | Fixed in previous migration |
| Pharmacy data intact | OK | Confirmed: Vios Compounding with all config |

## What Will Change

- Two new SECURITY DEFINER helper functions (`is_pharmacy_member`, `is_pharmacy_owner`)
- Two policies replaced (no data access changes, same logic, just no recursion)
- One duplicate admin_alerts policy cleaned up
- No data modifications whatsoever

## Technical Details

The `SECURITY DEFINER` functions execute as the function owner (postgres), bypassing RLS on the target table. This is the standard PostgreSQL pattern for breaking circular RLS dependencies. The `SET search_path = public` prevents search-path-based privilege escalation.

