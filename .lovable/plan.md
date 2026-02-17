
# Patient Portal End-to-End Audit: Practice Grants Portal Access through Full Usage

## Audit Scope
Complete patient ("borrower") flow: practice grants portal access, patient logs in, accepts terms, completes intake, medical vault, appointments, document uploads, and all patient pages.

---

## Findings Summary

| # | Severity | Area | Issue |
|---|----------|------|-------|
| 1 | **CRITICAL** | Patient Intake Form | ALL `patient_medical_vault` inserts in `PatientIntakeForm.tsx` are missing the required `practice_id` column (NOT NULL constraint). Every intake submission will fail with a database error. |
| 2 | **CRITICAL** | Patient Onboarding Page | `PatientOnboarding.tsx` inserts into `patient_medical_vault` using non-existent columns (`allergies`, `current_medications`, `medical_conditions`) and missing ALL required columns (`patient_id`, `record_type`, `title`, `practice_id`). This page is completely broken. |
| 3 | **MEDIUM** | Patient Onboarding Page | `PatientOnboarding.tsx` inserts into `patient_accounts` without `practice_id` (NOT NULL) or `user_id`, so the patient account creation will also fail. |
| 4 | **LOW** | Blood Type Insert | `PatientIntakeForm.tsx` line 564-567 inserts a record with only `patient_id` and `blood_type`, missing `record_type`, `title`, and `practice_id` (all NOT NULL). |

---

## Detailed Findings

### 1. CRITICAL: PatientIntakeForm - Missing `practice_id` on All Vault Inserts

**File:** `src/pages/patient/PatientIntakeForm.tsx`

Every `patient_medical_vault` insert in this file (vitals at lines 498-511, 522-535; medications at lines 597-603; NKA at lines 636-649; allergies at lines 694-700; conditions at lines 757-763; surgeries at lines 815-821; immunizations at lines 868-874; pharmacy at lines 933-939; emergency contact at lines 985-991) is missing the required `practice_id` column.

The `patientAccount` object already has `practice_id` available (it's selected at lines 163 and 174), so the fix is straightforward: add `practice_id: patientAccount.practice_id` to every insert object.

**Impact:** Intake form submission fails completely. No medical data is saved. Patients see an error after filling out the entire form.

**Fix:** Add `practice_id: patientAccount.practice_id` to all vault insert objects alongside `patient_account_id` and `patient_id`.

### 2. CRITICAL: PatientOnboarding - Completely Broken Medical Vault Insert

**File:** `src/pages/patient/PatientOnboarding.tsx` (lines 54-58)

```text
await supabase.from("patient_medical_vault").insert([{
  allergies: allergies,           // Column doesn't exist
  current_medications: medications, // Column doesn't exist  
  medical_conditions: conditions,   // Column doesn't exist
} as any]);
```

The `patient_medical_vault` table requires: `patient_id` (NOT NULL), `record_type` (NOT NULL), `title` (NOT NULL), `practice_id` (NOT NULL). None are provided. The columns `allergies`, `current_medications`, `medical_conditions` are JSONB columns that exist but are legacy -- the modern approach uses `record_type` + `record_data`.

**Impact:** Onboarding medical data insert always fails. The error is swallowed because it's in a try/catch that navigates to dashboard regardless.

**Fix:** This page appears to be a legacy/dead page that is not part of the main patient flow (the main flow uses `PatientIntakeForm.tsx`). It should either be removed or rewritten to use the correct schema. Since patients are created by the practice via `create-patient-portal-account`, this self-service onboarding path is likely unused.

### 3. MEDIUM: PatientOnboarding - Patient Account Insert Missing Required Fields

**File:** `src/pages/patient/PatientOnboarding.tsx` (lines 31-45)

The insert into `patient_accounts` is missing `practice_id` (NOT NULL required column). Since patients are created by practices (not self-service), this page cannot work as designed.

### 4. LOW: Blood Type Insert Missing Required Fields

**File:** `src/pages/patient/PatientIntakeForm.tsx` (lines 562-568)

```text
await supabase.from('patient_medical_vault').insert({
  patient_id: patientAccount.id,
  blood_type: data.blood_type,
} as any);
```

Missing `record_type`, `title`, and `practice_id` (all NOT NULL). This fallback path (when no existing vault record is found) will fail.

---

## Flows Verified as Correct

### Portal Account Creation (Practice Side)
- `create-patient-portal-account` edge function correctly creates auth user, assigns patient role, links `user_id` to `patient_accounts`, creates temp password token, handles re-invites
- Proper subscription check, practice ownership validation, rate limiting, CSRF protection
- Audit logging for both new accounts and re-invites

### Patient Login Flow
- Temp password redirects to `/change-password`
- Terms acceptance check via `user_terms_acceptances` (unified table)
- 2FA enforcement check
- Session management with activity-based timeout

### Patient Terms Acceptance
- Uses unified `user_terms_acceptances` table (same as all roles)
- `ProtectedRoute` correctly redirects to `/accept-terms` when `termsAccepted === false`
- Grace period prevents redirect loops

### Patient Medical Vault (View)
- `PatientMedicalVault.tsx` correctly queries `patient_medical_vault` by `patient_account_id` and `record_type`
- All sections (medications, conditions, allergies, vitals, immunizations, surgeries, pharmacies, emergency contacts) use correct column names
- PDF generation, audit logs, print functionality all work

### Patient Appointments
- `PatientAppointments.tsx` correctly uses RPC with fallback to direct query
- Appointment booking dialog, cancellation, reschedule, calendar export all present
- Subscription check gates booking when practice subscription lapses

### Patient Documents
- `PatientDocuments.tsx` correctly uses unified RPC `get_patient_unified_documents`
- Upload to `patient-documents` bucket with correct `patient_medical_vault` insert (record_type: 'document')
- Download via `manage-documents` edge function with signed URLs
- Realtime subscriptions for both patient uploads and provider-assigned documents

### Patient Dashboard
- Batched data loading via `usePatientDashboard` hook
- Intake prompt shown when `intake_completed_at` is null
- Medical vault onboarding banner shown after intake when no vault data exists

### Practice-Side Patient Detail
- `PatientDetail.tsx` correctly resolves patient IDs, loads medical data in parallel
- Tabs for overview, medical vault, appointments, documents, notes, treatment plans
- PDF chart generation and download

---

## Implementation Plan

### Fix 1: Add `practice_id` to all PatientIntakeForm vault inserts
Add `practice_id: patientAccount.practice_id` to every `patient_medical_vault` insert in `PatientIntakeForm.tsx`. This affects approximately 10 insert locations:
- Height vital (line ~498)
- Weight vital (line ~522)
- Blood type new record (line ~564)
- Medications batch (line ~597)
- NKA record (line ~636)
- Allergies batch (line ~694)
- Conditions batch (line ~757)
- Surgeries batch (line ~815)
- Immunizations batch (line ~868)
- Pharmacy (line ~933)
- Emergency contact (line ~985)

### Fix 2: Fix blood type insert missing required fields
Update the blood type insert (lines 562-568) to include `record_type: 'vital_sign'`, `title: 'Blood Type'`, and `practice_id: patientAccount.practice_id`.

### Fix 3: Remove or deprecate PatientOnboarding page
Since patients are created by practices via `create-patient-portal-account` and go through `PatientIntakeForm` for data entry, the `PatientOnboarding.tsx` page is dead code with broken inserts. Options:
- Remove the page and its route from `App.tsx`
- Or rewrite it to use the correct schema (not recommended since the intake form already handles this)

The recommended approach is to remove the route and page to prevent any accidental usage.
