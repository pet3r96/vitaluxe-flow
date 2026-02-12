

# Fix: Pharmacy Page Blank Due to RLS Infinite Recursion

## Root Cause

The pharmacy page is blank because of a **database error (500)**, not because data was deleted. Your pharmacy (Vios Compounding) is still in the database with all its API config, address, credentials, and states.

The error message from the database is:
```
"infinite recursion detected in policy for relation 'pharmacies'"
```

Here is what is happening:
1. The `pharmacies` table has an RLS policy called `admin_all_pharmacies` that calls the function `has_role(auth.uid(), 'admin')`
2. The `has_role()` function queries the `user_roles` table
3. The `user_roles` table has RLS policies that ALSO call `has_role()` -- which queries `user_roles` again
4. This creates an infinite loop, and the database rejects the query

## Fix

Replace the `has_role()` calls in `user_roles` RLS policies with direct checks that don't recurse. The standard fix is to use `auth.jwt()` metadata or query the table with `SECURITY DEFINER` to bypass RLS on the self-referencing table.

### Step 1: Create a SECURITY DEFINER helper function

Create a new function `has_role_no_rls()` that bypasses RLS on `user_roles` to break the recursion cycle:

```sql
CREATE OR REPLACE FUNCTION public.has_role_no_rls(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

### Step 2: Update the `has_role()` function

Update the existing `has_role()` function to use `SECURITY DEFINER` as well, so all callers automatically bypass the recursion:

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

### Step 3: Clean up duplicate policies on `user_roles`

The `user_roles` table has redundant overlapping policies (e.g., two admin ALL policies). These will be cleaned up to prevent confusion and ensure no recursion remains.

## Result

- The pharmacy page will load and display Vios Compounding with all its data
- No data changes -- this is purely fixing the RLS policy recursion
- All other pages that use `has_role()` will also benefit from this fix

## Technical Details

- Only one function (`has_role`) needs the `SECURITY DEFINER` attribute added
- `SECURITY DEFINER` means the function runs as the function owner (bypassing RLS), which is the standard Postgres pattern for breaking RLS recursion
- `SET search_path = public` is a security best practice for `SECURITY DEFINER` functions

