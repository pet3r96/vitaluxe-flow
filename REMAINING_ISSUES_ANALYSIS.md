# Remaining Database Issues Analysis

**Date:** November 3, 2025  
**Status:** After RLS Consolidation Migration  
**Focus:** Additional issues beyond `patient_accounts` and `patient_follow_ups`

---

## Executive Summary

Beyond the consolidation migration we just created, there are **CRITICAL** additional issues that need attention:

1. 🔴 **8 conflicting versions** of `create_user_with_role` function
2. 🔴 **4 conflicting versions** of `get_visible_products_for_user` function
3. 🟠 **15+ policy cycles** on `patient_documents` table
4. 🟠 **Medical vault tables** rely on broken `user_belongs_to_patient_practice` function
5. 🟡 **Legacy `patients` table** still referenced in some migrations

---

## 🔴 CRITICAL ISSUES

### 1. `create_user_with_role` Function Duplication

**Severity:** 🔴 CRITICAL  
**Impact:** User creation may fail or behave inconsistently

**Findings:**
- **8 different versions** exist across migrations
- Each version has different function signatures and logic
- Some versions reference tables/columns that might not exist

**Affected Migrations:**
1. `20251009221531` - Original version (6 params)
2. `20251021044630` - Drops old, creates new (5 params)
3. `20251021051042` - Updates to handle conflicts (5 params)
4. + 5 more versions with variations

**Issues:**
- Function signature changes (parameter count/order)
- Different logic for handling role-specific data
- Some versions reference `practice_users` table that may not exist
- Inconsistent error handling

**Recommendation:**
```sql
-- Consolidate into SINGLE definitive version
-- Keep latest version with best error handling
-- Document all parameters clearly
-- Add proper idempotency checks
```

---

### 2. `get_visible_products_for_user` Function Duplication

**Severity:** 🔴 CRITICAL  
**Impact:** Product visibility may be inconsistent across users

**Findings:**
- **4 different versions** exist
- Each version handles provider/practice logic differently
- Some versions may not handle edge cases

**Affected Migrations:**
1. `20251017035539` - Base version
2. `20251017040753` - Enhanced with provider support
3. `20251017035849` - Further provider enhancements
4. `20251017041358` - Effective user version

**Related Function:**
- `get_visible_products_for_effective_user` has **3 versions** (impersonation support)

**Issues:**
- Inconsistent provider/practice resolution
- Different fallback logic
- Some versions may not handle impersonation correctly

**Recommendation:**
```sql
-- Keep `get_visible_products_for_effective_user` (impersonation support)
-- Remove `get_visible_products_for_user` (or make it call the effective version)
-- Consolidate logic into single function
```

---

### 3. Medical Vault Tables RLS Issues

**Severity:** 🟠 HIGH  
**Impact:** Medical vault access may be broken for providers/staff

**Affected Tables:**
- `patient_medications`
- `patient_conditions`
- `patient_allergies`
- `patient_vitals`
- `patient_immunizations`
- `patient_surgeries`
- `patient_pharmacies`
- `patient_emergency_contacts`

**Current Issue:**
- All 8 tables use `user_belongs_to_patient_practice()` function
- Migration `20251103015819` references `practice_users` table (BROKEN)
- Function may not recognize doctors/practice owners correctly

**Evidence:**
```sql
-- Migration 20251103015819 uses broken logic:
SELECT practice_id INTO user_practice_id
FROM public.practice_users  -- This table likely doesn't exist!
WHERE user_id = _user_id
```

**Current State:**
- Medical vault policies created in `20251103015819` use broken function
- Function was fixed in later migrations (`20251103043000`, `20251103053414`)
- But medical vault policies still reference old broken version logic

**Fix Required:**
- Medical vault policies need to use the FIXED `user_belongs_to_patient_practice` function
- Our consolidation migration should fix this, but need to verify

---

## 🟠 HIGH PRIORITY ISSUES

### 4. `patient_documents` Table RLS Policy Churn

**Severity:** 🟠 HIGH  
**Impact:** Document access policies may be inconsistent

**Findings:**
- **15+ DROP/CREATE cycles** found
- Multiple policy versions with different logic
- Conflicting policies for patient vs practice document access

**Key Issues:**
- Policies for patient-uploaded documents
- Policies for provider-uploaded documents
- Policies for document sharing (patient ↔ practice)
- Impersonation policies

**Recommendation:**
- Consolidate all `patient_documents` and `provider_documents` policies
- Ensure document sharing logic is clear and consistent
- Verify impersonation policies work correctly

---

### 5. `provider_documents` Table RLS Issues

**Severity:** 🟠 HIGH  
**Impact:** Provider document access may be broken

**Findings:**
- Similar policy churn as `patient_documents`
- Multiple policies for document assignment (`provider_document_patients`)
- May have conflicts between practice access and patient access

**Need to Check:**
- Practice users can view their practice's provider documents
- Patients can view assigned provider documents
- Admin impersonation policies

---

### 6. `get_provider_documents` Function Duplication

**Severity:** 🟡 MEDIUM  
**Impact:** Document fetching may be inconsistent

**Findings:**
- **6 versions** of `get_provider_documents` function
- Some versions take `practice_id`, others take `provider_id`
- Function signature inconsistencies

**Recommendation:**
- Consolidate into single definitive version
- Document which parameter format to use
- Ensure backward compatibility if needed

---

## 🟡 MEDIUM PRIORITY ISSUES

### 7. Legacy `patients` Table References

**Severity:** 🟡 MEDIUM  
**Impact:** Migration errors if table was properly dropped

**Findings:**
- **10+ migrations** still reference `patients` table
- Table should have been dropped in Oct 2024 (`20251031153900`)
- Some migrations check for both `patients` and `patient_accounts` (defensive)

**Examples:**
```sql
-- Migration 20251103043000 has defensive checks:
EXISTS (SELECT 1 FROM public.patients p WHERE ...)
OR EXISTS (SELECT 1 FROM public.patient_accounts pa WHERE ...)
```

**Status:**
- These are likely defensive (checking both tables)
- Should be safe if `patients` table was dropped
- Could cause confusion in migration history

**Recommendation:**
- Verify `patients` table is actually dropped in production
- If dropped, remove defensive checks to clean up code
- If not dropped, need migration to drop it

---

### 8. Multiple Encryption/Decryption Function Versions

**Severity:** 🟡 MEDIUM  
**Impact:** Encryption logic may be inconsistent

**Findings:**
- **4 versions** of `encrypt_patient_phi`
- **4 versions** of `decrypt_patient_phi`
- **4 versions** of `encrypt_prescription_data`
- **3 versions** of `encrypt_plaid_token`
- **3 versions** of `decrypt_plaid_token`

**Risk:**
- Different encryption logic could corrupt data
- Decryption must match encryption logic exactly
- Breaking changes could lose access to encrypted data

**Recommendation:**
- CRITICAL: Verify all versions use same encryption method
- Consolidate to single version for each function
- Test encryption/decryption thoroughly before consolidating

---

### 9. Helper Function Duplicates (Various)

**Severity:** 🟡 MEDIUM  
**Impact:** Potential logic inconsistencies

**Functions with 3+ versions:**
- `calculate_order_line_profit()` - 5 versions
- `update_order_status()` - 3 versions
- `refresh_security_events_summary()` - 3 versions
- `get_topline_rep_id_for_practice()` - 3 versions
- `get_patient_unified_documents()` - 3 versions

**Recommendation:**
- Audit each for breaking changes
- Consolidate non-critical functions after critical ones
- Document function version history

---

## 🔵 LOW PRIORITY ISSUES

### 10. Profile RLS Policy Churn

**Severity:** 🔵 LOW  
**Impact:** Minor confusion, but likely working

**Findings:**
- Multiple policy updates for `profiles` table
- Most are security improvements (TO authenticated)
- Less critical than patient/medical vault policies

---

## Recommended Action Plan

### Phase 1: Fix Critical Function Duplicates (IMMEDIATE)

**Priority 1: `create_user_with_role`**
- Consolidate 8 versions → 1
- Test user creation thoroughly
- Document all use cases

**Priority 2: `get_visible_products_for_user`**  
- Consolidate 4 versions → 1 (or remove if superseded)
- Keep `get_visible_products_for_effective_user` (impersonation support)
- Test product visibility for all roles

**Priority 3: Medical Vault RLS**
- Verify `user_belongs_to_patient_practice` works for all medical vault tables
- Update medical vault policies to use correct function version
- Test provider/staff access to medical vault

### Phase 2: Consolidate Document Tables RLS (WITHIN 1 WEEK)

**Priority 1: `patient_documents`**
- Consolidate 15+ policy cycles → definitive set
- Verify sharing logic (patient ↔ practice)
- Test impersonation policies

**Priority 2: `provider_documents`**
- Consolidate policy churn
- Verify practice access
- Verify patient assignment access

### Phase 3: Clean Up Helper Functions (WITHIN 1 MONTH)

**Encryption Functions:**
- ⚠️ **CRITICAL:** Verify all use same encryption method before consolidating
- Test thoroughly before changing
- Keep backups of encryption keys

**Other Helper Functions:**
- Consolidate `get_provider_documents` (6 versions)
- Consolidate `calculate_order_line_profit` (5 versions)
- Consolidate other functions with 3+ versions

### Phase 4: Remove Legacy References (FUTURE)

**Legacy `patients` Table:**
- Verify it's dropped in production
- Remove defensive checks if confirmed dropped
- Clean up migration history references

---

## Test Checklist After Fixes

### Critical Functions
- [ ] `create_user_with_role` - Test user creation for all roles
- [ ] `get_visible_products_for_user` - Test product visibility for all roles
- [ ] `user_belongs_to_patient_practice` - Test for all medical vault tables

### Medical Vault
- [ ] Doctor can access all 8 medical vault sections
- [ ] Provider can access all 8 medical vault sections
- [ ] Staff can access all 8 medical vault sections
- [ ] Patient can access own medical vault
- [ ] Inactive providers/staff cannot access

### Documents
- [ ] Practice can view provider documents
- [ ] Patient can view assigned provider documents
- [ ] Patient can view own documents
- [ ] Practice can view patient-shared documents
- [ ] Impersonation works for documents

---

## Files to Create

1. **`fix_create_user_with_role.sql`** - Consolidate 8 versions
2. **`fix_product_visibility_functions.sql`** - Consolidate visibility functions
3. **`consolidate_medical_vault_rls.sql`** - Verify/fix medical vault policies
4. **`consolidate_document_rls.sql`** - Fix document table policies
5. **`verify_encryption_functions.sql`** - Audit encryption consistency

---

## Summary

**Total Issues Found:**
- 🔴 **3 CRITICAL** function duplications
- 🟠 **2 HIGH** RLS policy issues
- 🟡 **4 MEDIUM** function duplicates
- 🔵 **1 LOW** cleanup item

**Estimated Impact:**
- **User Creation:** May fail or be inconsistent (8 function versions)
- **Product Visibility:** May show wrong products (4 function versions)
- **Medical Vault:** May not work for providers/staff (broken function reference)
- **Documents:** May have access issues (15+ policy cycles)

**Next Steps:**
1. ✅ Your consolidation migration fixes `user_belongs_to_patient_practice` and patient_accounts/follow_ups
2. ⚠️ Still need to fix: `create_user_with_role`, product visibility functions
3. ⚠️ Still need to verify: Medical vault policies use correct function
4. ⚠️ Still need to consolidate: Document table policies

---

**END OF ANALYSIS**

