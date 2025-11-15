# 🔧 SCHEMA MIGRATION PLAN - VitaLuxe Orders System

**Date Created:** 2025-11-15  
**Purpose:** Fix all schema mismatches between code and database structure  
**Status:** 🟡 READY FOR IMPLEMENTATION

---

## 📋 EXECUTIVE SUMMARY

### Current State
- **Database Schema:** Uses `profiles`, `providers`, `practice_staff`, `patient_accounts`, `reps` tables
- **Code References:** Some components/functions reference non-existent tables (`practices`, `practice_accounts`)
- **Impact:** Multiple pages failing or showing partial data

### Target State
- All code uses correct table names and column references
- All edge functions properly join with `profiles` for user data
- All SQL queries validated against actual schema
- Zero schema mismatch errors

---

## 🎯 PRIORITY CLASSIFICATION

### 🔴 CRITICAL (Blocks Core Functionality)
1. **get-orders-page Edge Function** - Orders page partially broken
2. **list-providers Edge Function** - Providers page failing
3. **list-staff Edge Function** - Staff page failing

### 🟡 HIGH (Impacts User Experience)
4. **Practices DataTable** - Uses complex filtering logic
5. **Representatives Data Fetching** - No dedicated edge function
6. **Pharmacies Data Fetching** - Direct database queries

### 🟢 MEDIUM (Enhancement/Optimization)
7. **Patient Data Services** - Already correct, needs validation
8. **Dashboard Functions** - Need schema audit
9. **Order-related Functions** - Need comprehensive review

---

## 📊 DATABASE SCHEMA REFERENCE

### ✅ CORRECT TABLES (Use These)

#### **profiles** (User Core Data)
```sql
Columns:
- id (uuid, PK) - same as auth.users.id
- name (text)
- full_name (text)
- email (text)
- phone (text)
- created_at (timestamp)
- status (text)

NOTE: Roles are NOT in profiles table!
Roles are in: user_roles(user_id, role)
OR auth.users.raw_user_meta_data->>'role'
```

#### **providers** (Medical Providers)
```sql
Columns:
- id (uuid, PK)
- user_id (uuid, FK -> profiles.id)
- practice_id (uuid, FK -> profiles.id)
- role_type (text) - 'provider' or 'doctor'
- active (boolean)
- can_order (boolean)
- created_at (timestamp)

Join Pattern:
providers p
INNER JOIN profiles prof ON prof.id = p.user_id
WHERE p.role_type = 'provider'
```

#### **practice_staff** (Non-Provider Staff)
```sql
Columns:
- id (uuid, PK)
- user_id (uuid, FK -> profiles.id)
- practice_id (uuid, FK -> profiles.id)
- role (text) - 'front_desk', 'admin', etc.
- active (boolean)
- can_order (boolean)
- created_at (timestamp)

Join Pattern:
practice_staff ps
INNER JOIN profiles prof ON prof.id = ps.user_id
```

#### **reps** (Sales Representatives)
```sql
Columns:
- id (uuid, PK)
- user_id (uuid, FK -> profiles.id)
- assigned_topline_id (uuid, nullable)
- rep_type (text) - 'topline' or 'downline'
- active (boolean)
- created_at (timestamp)

Join Pattern:
reps r
INNER JOIN profiles prof ON prof.id = r.user_id
LEFT JOIN reps topline ON topline.id = r.assigned_topline_id
```

#### **patient_accounts** (Patient Data)
```sql
Columns:
- id (uuid, PK)
- practice_id (uuid, FK -> profiles.id)
- provider_id (uuid, FK -> providers.id, nullable)
- first_name (text)
- last_name (text)
- email (text, encrypted)
- phone (text, encrypted)
- created_at (timestamp)

NOTE: Patients are NOT users (no auth.users record)
```

#### **pharmacies** (Pharmacy Partners)
```sql
Columns:
- id (uuid, PK)
- user_id (uuid, FK -> profiles.id)
- name (text)
- states_serviced (text[])
- active (boolean)
- created_at (timestamp)
```

### ❌ NON-EXISTENT TABLES (Do NOT Use)
- ~~practices~~ → Use `profiles` WHERE role='doctor' AND is actual practice
- ~~practice_accounts~~ → Use `profiles` with `user_roles`
- ~~users~~ → Use `profiles` (frontend) or `auth.users` (backend only)

---

## 🔧 MIGRATION TASKS

### Task 1: Fix list-providers Edge Function
**File:** `supabase/functions/list-providers/index.ts`

#### Current Issues
```typescript
// ❌ WRONG - References non-existent columns
const { data, error } = await adminClient
  .from("providers")
  .select(`
    *,
    first_name,    // ❌ Does not exist in providers table
    last_name,     // ❌ Does not exist in providers table
    email,         // ❌ Does not exist in providers table
    role           // ❌ Does not exist in providers table
  `)
```

#### Fixed Query
```typescript
// ✅ CORRECT - Joins with profiles for user data
const { data, error } = await adminClient
  .from("providers")
  .select(`
    id,
    user_id,
    practice_id,
    role_type,
    active,
    can_order,
    npi_number,
    license_number,
    license_state,
    created_at,
    profiles:profiles!providers_user_id_fkey (
      id,
      full_name,
      name,
      email,
      phone,
      status
    )
  `)
  .eq("role_type", "provider")
  .order("created_at", { ascending: false });
```

#### Response Transformation
```typescript
// Transform to expected format
return providers.map(p => ({
  id: p.id,
  user_id: p.user_id,
  practice_id: p.practice_id,
  role_type: p.role_type,
  active: p.active,
  can_order: p.can_order,
  npi_number: p.npi_number,
  license_number: p.license_number,
  license_state: p.license_state,
  created_at: p.created_at,
  // Flattened profile data
  full_name: p.profiles?.full_name,
  name: p.profiles?.name,
  email: p.profiles?.email,
  phone: p.profiles?.phone,
  status: p.profiles?.status
}));
```

---

### Task 2: Fix list-staff Edge Function
**File:** `supabase/functions/list-staff/index.ts`

#### Current Issues
```typescript
// ❌ WRONG - Likely references providers table for staff
const { data, error } = await adminClient
  .from("providers")
  .select(`*`)
  .neq("role_type", "provider");  // ❌ Staff are in practice_staff table
```

#### Fixed Query
```typescript
// ✅ CORRECT - Uses practice_staff table
const { data, error } = await adminClient
  .from("practice_staff")
  .select(`
    id,
    user_id,
    practice_id,
    role,
    active,
    can_order,
    hire_date,
    created_at,
    profiles:profiles!practice_staff_user_id_fkey (
      id,
      full_name,
      name,
      email,
      phone,
      status
    ),
    practice:profiles!practice_staff_practice_id_fkey (
      id,
      full_name,
      name
    )
  `)
  .eq("active", true)
  .order("created_at", { ascending: false });
```

---

### Task 3: Fix get-orders-page Edge Function
**File:** `supabase/functions/get-orders-page/index.ts`

#### Current Issues
- May reference `profiles.role` column (does not exist)
- Should use `user_roles` table or metadata

#### Validation Query
```typescript
// ✅ CORRECT - Get user role properly
const { data: userRoles } = await adminClient
  .from("user_roles")
  .select("role")
  .eq("user_id", userId)
  .single();

const userRole = userRoles?.role;

// Alternative: Get from auth metadata
const { data: { user } } = await adminClient.auth.admin.getUserById(userId);
const userRole = user?.raw_user_meta_data?.role;
```

#### Orders Query Fix
```sql
-- ✅ CORRECT - Join with profiles for user data
SELECT 
  o.*,
  doc.full_name as doctor_name,
  doc.email as doctor_email
FROM orders o
INNER JOIN profiles doc ON doc.id = o.doctor_id
WHERE o.doctor_id = $1
ORDER BY o.created_at DESC;
```

---

### Task 4: Create get-representatives-data Edge Function
**Status:** 🆕 NEW - Does not exist

#### Purpose
Dedicated edge function for representatives data table

#### Implementation
```typescript
// File: supabase/functions/get-representatives-data/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from "../_shared/supabaseAdmin.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminClient = createAdminClient();

    // Fetch all reps with profile data and topline relationships
    const { data: reps, error } = await adminClient
      .from("reps")
      .select(`
        id,
        user_id,
        assigned_topline_id,
        rep_type,
        active,
        commission_rate,
        created_at,
        profiles:profiles!reps_user_id_fkey (
          id,
          full_name,
          name,
          email,
          phone,
          status
        ),
        topline:reps!reps_assigned_topline_id_fkey (
          id,
          profiles:profiles!reps_user_id_fkey (
            full_name,
            name
          )
        ),
        rep_practice_links (
          practice:profiles!rep_practice_links_practice_id_fkey (
            id,
            full_name,
            name
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return new Response(JSON.stringify({ representatives: reps }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("[get-representatives-data] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
```

---

### Task 5: Create get-pharmacies-data Edge Function
**Status:** 🆕 NEW - Does not exist

#### Implementation
```typescript
// File: supabase/functions/get-pharmacies-data/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from "../_shared/supabaseAdmin.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminClient = createAdminClient();

    const { data: pharmacies, error } = await adminClient
      .from("pharmacies")
      .select(`
        id,
        user_id,
        name,
        contact_email,
        contact_phone,
        address,
        states_serviced,
        priority_map,
        active,
        api_enabled,
        created_at,
        profiles:profiles!pharmacies_user_id_fkey (
          id,
          email,
          phone,
          status
        )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return new Response(JSON.stringify({ pharmacies }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("[get-pharmacies-data] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
```

---

### Task 6: Update Practices Data Fetching
**File:** `src/components/practices/PracticesDataTable.tsx`

#### Current Status
✅ Already using correct schema (profiles + user_roles)

#### Validation Needed
```typescript
// Verify query matches actual schema
const { data: allDoctors, error } = await supabase
  .from("profiles")
  .select(`
    *,
    user_roles!inner(role)
  `)
  .eq("user_roles.role", "doctor");

// ✅ CORRECT - No changes needed
```

---

## 🧪 VALIDATION & TESTING PLAN

### Phase 1: Schema Validation (15 min)
Run these SQL queries to verify schema matches:

```sql
-- Verify providers table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'providers' 
AND table_schema = 'public';

-- Verify practice_staff table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'practice_staff' 
AND table_schema = 'public';

-- Verify reps table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'reps' 
AND table_schema = 'public';

-- Check how roles are stored
SELECT 
  'user_roles' as source,
  COUNT(*) as count
FROM user_roles
UNION ALL
SELECT 
  'raw_user_meta_data' as source,
  COUNT(*) as count
FROM auth.users
WHERE raw_user_meta_data->>'role' IS NOT NULL;
```

### Phase 2: Edge Function Testing (30 min)
For each edge function:

1. **list-providers**
```bash
# Test with admin context
curl -X POST 'https://qbtsfajshnrwwlfzkeog.supabase.co/functions/v1/list-providers' \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"practice_id": "uuid-here"}'
```

2. **list-staff**
```bash
# Test staff listing
curl -X POST 'https://qbtsfajshnrwwlfzkeog.supabase.co/functions/v1/list-staff' \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"practice_id": "uuid-here"}'
```

3. **get-representatives-data**
```bash
# Test new rep function
curl -X POST 'https://qbtsfajshnrwwlfzkeog.supabase.co/functions/v1/get-representatives-data' \
  -H "Authorization: Bearer $ANON_KEY"
```

### Phase 3: UI Integration Testing (20 min)
Test each page manually:

- [ ] **/practices** - Verify practices list loads
- [ ] **/providers** - Verify providers list with names
- [ ] **/staff** - Verify staff list with practice info
- [ ] **/representatives** - Verify reps with topline relationships
- [ ] **/pharmacies** - Verify pharmacy list
- [ ] **/orders** - Verify orders load for all roles
- [ ] **/patients** - Verify patient list

### Phase 4: Performance Validation (15 min)
Check edge function logs for:

```sql
-- Query edge function performance
SELECT 
  function_name,
  AVG(execution_time_ms) as avg_time,
  MAX(execution_time_ms) as max_time,
  COUNT(*) as call_count
FROM function_edge_logs
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY function_name
ORDER BY avg_time DESC;
```

Target: All queries < 300ms

---

## 📅 IMPLEMENTATION TIMELINE

### Day 1: Critical Fixes (2 hours)
- ✅ Task 1: Fix list-providers (30 min)
- ✅ Task 2: Fix list-staff (30 min)
- ✅ Task 3: Audit get-orders-page (30 min)
- ✅ Phase 2: Test edge functions (30 min)

### Day 2: New Functions (1.5 hours)
- ✅ Task 4: Create get-representatives-data (45 min)
- ✅ Task 5: Create get-pharmacies-data (45 min)

### Day 3: Integration & Testing (2 hours)
- ✅ Update UI components to use new functions
- ✅ Phase 3: UI integration testing
- ✅ Phase 4: Performance validation
- ✅ Document any remaining issues

### Total Estimated Time: 5.5 hours

---

## ✅ SUCCESS CRITERIA

1. **Zero Schema Errors**
   - No "column does not exist" errors
   - No "table does not exist" errors

2. **All Pages Load Successfully**
   - Practices page: Shows all practice users
   - Providers page: Shows providers with names
   - Staff page: Shows staff with practice info
   - Representatives page: Shows reps with relationships
   - Pharmacies page: Shows pharmacies with details
   - Orders page: Works for all 7 roles

3. **Performance Targets Met**
   - All edge functions: < 300ms average
   - All database queries: < 200ms
   - UI page loads: < 1 second

4. **Data Isolation Verified**
   - Practices see only their data
   - Providers see only their assignments
   - Staff see only their practice data
   - Reps see only their linked practices
   - Admins see everything

---

## 🚨 ROLLBACK PLAN

If issues occur during implementation:

1. **Immediate Rollback**
   - Revert edge function deployments
   - Restore previous function versions

2. **Gradual Rollout**
   - Test each function individually
   - Enable for admin role first
   - Gradually enable for other roles

3. **Monitoring**
   - Watch error logs closely
   - Track performance metrics
   - Monitor user feedback

---

## 📞 SIGN-OFF

**Created By:** AI Assistant  
**Reviewed By:** [Pending]  
**Approved By:** [Pending]  
**Implementation Start:** [Pending]  
**Implementation Complete:** [Pending]

---

## 🔗 RELATED DOCUMENTS

- Database Schema: `src/integrations/supabase/types.ts`
- Edge Functions: `supabase/functions/`
- Frontend Services: `src/services/`
- Component Files: `src/components/`

---

*Last Updated: 2025-11-15*
