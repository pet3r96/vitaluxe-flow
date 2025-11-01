# QA Report: Patient Accounts and Patients Table Merge

## Overview
This report summarizes the QA testing performed on the database migration that merges the `patients` and `patient_accounts` tables into a unified `patient_accounts` table.

## Migration Files Created

1. **20251031153732_merge_patient_accounts_and_patients.sql**
   - Main migration that merges tables
   - Extends patient_accounts schema
   - Migrates all data
   - Updates foreign keys and RLS policies

2. **20251031153900_cleanup_after_merge_patients.sql**
   - Updates views (v_patients_with_portal_status)
   - Drops patients table after verification

## Code Changes Summary

### Frontend Files Updated (12 files)
✅ All `.from("patients")` queries replaced with `.from("patient_accounts")`:
- src/components/patients/PatientsDataTable.tsx
- src/components/patients/PatientDialog.tsx
- src/pages/practice/PracticePatients.tsx
- src/pages/InternalChat.tsx
- src/pages/DeliveryConfirmation.tsx
- src/pages/Checkout.tsx (2 instances)
- src/components/security/SecurityOverview.tsx
- src/components/products/ProductsGrid.tsx
- src/components/products/ProductsDataTable.tsx
- src/components/products/PatientSelectionDialog.tsx
- src/components/messages/PatientMessagesTab.tsx
- src/components/documents/EditDocumentDialog.tsx

### Edge Functions Updated (4 files)
✅ All `.from("patients")` queries replaced with `.from("patient_accounts")`:
- supabase/functions/create-patient-portal-account/index.ts
- supabase/functions/bulk-invite-patients/index.ts
- supabase/functions/assign-document-to-patient/index.ts
- supabase/functions/cleanup-test-data/index.ts

### Migrations Fixed (2 files)
✅ Updated migrations that referenced patients table after merge:
- 20251031204615 - Fixed provider_document_patients migration
- 20251031203543 - Fixed get_patient_unified_documents function

## Validation Results

### ✅ Linting
- No linting errors found in migration files
- No linting errors found in updated TypeScript files

### ✅ Code References
- ✅ No remaining `.from("patients")` queries in src/ directory
- ✅ No remaining `.from("patients")` queries in supabase/functions/
- ✅ All comments updated to reference patient_accounts

### ✅ Migration Logic
- Data migration uses COALESCE to preserve existing values
- Handles matching by email + practice_id
- Creates new records for patients without portal accounts (user_id = NULL)
- Preserves all address verification data
- Preserves encrypted fields (allergies_encrypted, notes_encrypted)

### ✅ Foreign Key Updates
- cart_lines.patient_id → patient_accounts.id ✅
- order_lines.patient_id → patient_accounts.id ✅
- provider_document_patients.patient_id → patient_accounts.id ✅
- Dynamic detection and update of any other foreign keys ✅

### ✅ RLS Policies
- Admin policies (view all, create, update) ✅
- Doctor policies (view/update practice patients) ✅
- Provider policies (view/update practice patients) ✅
- Patient policies (view/update own account) ✅

### ✅ Triggers
- update_patient_accounts_updated_at trigger maintained ✅
- log_patient_access function updated to reference patient_accounts ✅
- Triggers moved from patients to patient_accounts ✅

### ✅ Views
- v_patients_with_portal_status updated to use patient_accounts ✅

## Potential Issues Identified & Status

### ⚠️ Issue 1: Name Splitting Logic
**Location**: Migration data migration DO block (lines 117-123)
**Issue**: Simple space-based name splitting may not handle all edge cases (multiple spaces, middle names, etc.)
**Impact**: Low - Worst case is "Unknown" as first_name if splitting fails
**Status**: Acceptable for migration, can be refined later

### ⚠️ Issue 2: Migration Order Dependency
**Location**: 20251031204615 migration references patients table
**Issue**: This migration was created after merge, but references old table structure
**Status**: ✅ FIXED - Migration updated to work with merged structure

### ⚠️ Issue 3: ID Collision Risk
**Location**: Migration uses patients.id as patient_accounts.id
**Issue**: If a patient_account with same UUID exists, INSERT will fail
**Impact**: Low - UUIDs are random, collision probability is negligible
**Status**: Acceptable - Will error gracefully if collision occurs

### ✅ Issue 4: Patient Medical Vault Tables
**Location**: patient_medications, patient_vitals, etc. use patient_account_id
**Status**: ✅ CORRECT - These tables already reference patient_accounts.id via patient_account_id column

## Testing Recommendations

### Pre-Production Testing
1. **Backup Database** - Full backup before running migrations
2. **Test Migration on Staging** - Run both migrations in sequence
3. **Verify Data Integrity**:
   - Count records: `SELECT COUNT(*) FROM patients` vs `SELECT COUNT(*) FROM patient_accounts`
   - Verify no orphaned foreign keys
   - Check that all patients have practice_id set
4. **Test Portal Access**:
   - Verify patients with portal access (user_id IS NOT NULL) can still log in
   - Verify grant portal access flow works
   - Test subscription checks
5. **Test Application Flow**:
   - Create new patient (should create in patient_accounts with user_id = NULL)
   - Grant portal access (should set user_id)
   - View patient list
   - Create order with patient
   - View patient medical vault

### Rollback Plan
If migration fails:
1. Both migrations are in transactions (BEGIN/COMMIT)
2. If merge migration fails, transaction rolls back
3. Cleanup migration will fail if patients table doesn't exist (safe)
4. Consider creating backup view before merge: `CREATE VIEW patients_backup AS SELECT * FROM patients;`

## Migration Safety Features

✅ **Transaction Wrapped** - Both migrations use BEGIN/COMMIT
✅ **Idempotent Operations** - Uses IF NOT EXISTS, COALESCE, etc.
✅ **Preserves Data** - COALESCE ensures existing data not overwritten
✅ **Foreign Key Verification** - Checks for orphaned references before dropping table
✅ **Constraint Validation** - Verifies foreign key constraints point correctly

## Notes

1. **Impersonation Permissions**: ✅ Not modified (only references auth.users)
2. **Subscription Logic**: ✅ Preserved (practice_subscriptions determines PRO status)
3. **Portal Access**: ✅ Preserved (user_id NULL = no portal access)
4. **Patient Accounts with Portal**: ✅ Already in patient_accounts, will be updated with missing fields

## Summary

✅ **All code references updated**
✅ **All migrations validated**
✅ **No linting errors**
✅ **Foreign keys properly updated**
✅ **RLS policies consolidated**
✅ **Triggers migrated**
✅ **Views updated**

**Status**: Ready for staging/testing environment. Recommend testing thoroughly before production deployment.

