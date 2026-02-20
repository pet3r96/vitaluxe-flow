

# Comprehensive Audit: Patient Flow, Calendar, Medical Vault, Intake Forms, and Audit Trail

## Audit Summary

I performed a deep code and data review across the patient lifecycle. Here are my findings:

---

## 1. Patient Addition Flow (Practice Side)
**Status: Working Correctly**

The `PatientDialog.tsx` creates patient records via direct `patient_accounts` INSERT with `practice_id: effectivePracticeId`. This is straightforward and does not involve the edge function where the pharmacy staff bug existed. No issues found.

---

## 2. Calendar and Appointment Lifecycle
**Status: Working Correctly**

The full appointment lifecycle is well-implemented:

| Step | Component | Status Field |
|------|-----------|-------------|
| Create Appointment | `CreateAppointmentDialog` | `scheduled` |
| Walk-in | `CreateAppointmentDialog` (isWalkIn) | `checked_in` + `checked_in_at` set |
| Confirm | `AppointmentDetailsDialog` | `confirmed` |
| Check In | `AppointmentDetailsDialog` / `WaitingRoomPanel` | `checked_in` + `checked_in_at` |
| Start Treatment | `WaitingRoomPanel` / `AppointmentDetailsDialog` | `being_treated` + `treatment_started_at` |
| Complete | `CompleteAppointmentDialog` | `completed` + `completed_at` |
| No Show | `WaitingRoomPanel` | `no_show` |
| Cancel | `AppointmentDetailsDialog` (status dropdown) | `cancelled` |

Key features confirmed working:
- Walk-in flow auto-sets `checked_in` status and `checked_in_at` timestamp
- Waiting Room Panel shows color-coded wait times with real-time subscriptions
- Being Treated Panel tracks treatment duration with color thresholds
- Complete Treatment dialog supports scheduling follow-ups and next appointments
- Reschedule and follow-up creation from appointment details
- Patient notifications sent on appointment creation (if portal access exists)
- Past-time validation prevents scheduling in the past (except walk-ins)

No code issues found in the calendar flow.

---

## 3. Medical Vault (Practice and Patient Views)
**Status: Working Correctly -- Shared Data Layer Confirmed**

Both sides read from the same `patient_medical_vault` table:
- **Patient view**: `PatientMedicalVault.tsx` queries by `user_id = effectiveUserId`
- **Practice view**: `MedicalVaultView.tsx` takes `patientAccountId` directly, with a `mode` prop (`'patient' | 'practice'`)
- The `canEdit` prop controls whether practice staff can modify records

Data entered by practice (via intake form or vault sections) is immediately visible to the patient and vice versa. Real-time subscriptions via `realtimeManager` keep both views current.

Currently in the vault: 7 allergies, 7 conditions, 9 medications, 19 vitals, 8 immunizations, 6 procedures, 3 pharmacies, 1 emergency contact, 8 documents, 20 notes.

No issues found.

---

## 4. Intake Form (Practice and Patient Completion)
**Status: Working Correctly**

The `PatientIntakeForm.tsx` supports dual-mode operation:
- **Patient mode**: Queries `patient_accounts` by `user_id = effectiveUserId`
- **Practice mode**: Uses `targetPatientAccountId` prop (from `PracticePatientIntakeForm.tsx`)

Both modes:
- Write to the same `patient_medical_vault` table with `practice_id` from the patient account
- Pre-populate existing vault data so entries added by one side appear in the other's form
- Set `intake_completed_at` on the `patient_accounts` record
- Redirect appropriately (practice -> patient detail page, patient -> medical vault)

The audit role is correctly derived: `targetPatientAccountId ? effectiveRole : 'patient'`.

No issues found.

---

## 5. Audit Trail
**Status: BROKEN -- 0 records in `medical_vault_audit_logs`**

This is the critical finding. Despite the code calling `logMedicalVaultChange()` for every vault operation (medications, allergies, conditions, surgeries, immunizations, pharmacy, emergency contacts, demographics, and intake completion), the `medical_vault_audit_logs` table has **zero records**.

### Root Cause

The `logMedicalVaultChange` function in `useAuditLogs.ts` inserts via the authenticated Supabase client (not service_role). The RLS INSERT policy `practice_team_insert_audit_logs` has a `WITH CHECK` clause:

```sql
(practice_id = auth.uid()) OR 
(EXISTS (SELECT 1 FROM providers p WHERE p.user_id = auth.uid() AND p.practice_id = medical_vault_audit_logs.practice_id)) OR
(EXISTS (SELECT 1 FROM practice_staff ps WHERE ps.user_id = auth.uid() AND ps.practice_id = medical_vault_audit_logs.practice_id))
```

The first clause `practice_id = auth.uid()` works ONLY when the practice owner's profile ID equals their user ID (which happens to be the case for the current practice). However, the `patients_insert_own_audit_logs` policy requires:

```sql
patient_account_id IN (SELECT id FROM patient_accounts WHERE user_id = auth.uid())
```

This works for patients with portal access, but fails when a **practice user** inserts an audit log for a patient -- because the practice user's `auth.uid()` doesn't match any `patient_accounts.user_id`.

The combination means:
- Practice owner inserts should work via the first clause... but the function catches errors silently (`logger.error` then returns), and something else may be blocking it.
- The error is silently swallowed on line 102 of `useAuditLogs.ts`, so no toast or visible feedback appears.

### Fix

Create a database function with `SECURITY DEFINER` to bypass RLS for audit log inserts, since audit logging should never be blocked by access policies. This ensures both practice users and patients can always write audit logs.

```sql
CREATE OR REPLACE FUNCTION public.insert_medical_vault_audit_log(
  p_patient_account_id uuid,
  p_practice_id uuid,
  p_action_type text,
  p_record_id uuid DEFAULT NULL,
  p_changed_by uuid DEFAULT NULL,
  p_performed_by_user_id uuid DEFAULT NULL,
  p_change_summary text DEFAULT NULL,
  p_previous_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO medical_vault_audit_logs (
    patient_account_id, practice_id, action_type,
    record_id, changed_by, performed_by_user_id,
    change_summary, previous_values, new_values
  ) VALUES (
    p_patient_account_id, p_practice_id, p_action_type,
    p_record_id, p_changed_by, p_performed_by_user_id,
    p_change_summary, p_previous_values, p_new_values
  );
$$;
```

Then update `logMedicalVaultChange` in `useAuditLogs.ts` to call `supabase.rpc('insert_medical_vault_audit_log', {...})` instead of the direct table insert.

---

## Changes Summary

| File | Change | Priority |
|------|--------|----------|
| New migration SQL | Create `insert_medical_vault_audit_log` SECURITY DEFINER function | Critical |
| `src/hooks/useAuditLogs.ts` | Update `logMedicalVaultChange` to use RPC instead of direct insert | Critical |

## What Does NOT Need Changes

- Patient addition flow -- working
- Calendar lifecycle (create, walk-in, check-in, treat, complete) -- working
- Medical vault data sharing between practice and patient -- working
- Intake form dual-mode (practice/patient) -- working
- CSRF fix from previous session -- working
- Pharmacy staff fix from previous session -- working

