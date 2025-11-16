-- ============================================================================
-- PHASE 5: COMPREHENSIVE DATABASE VALIDATION PACK
-- RUN BEFORE PHASE 6 TABLE CLEANUP
-- ============================================================================

-- ============================================================================
-- SECTION 1: MISSING PRACTICE_ID VALIDATION
-- ============================================================================

-- 1.1 Providers missing practice_id (should be 0)
SELECT 'PROVIDERS_MISSING_PRACTICE_ID' as check_name, COUNT(*) as issues
FROM providers
WHERE practice_id IS NULL;

-- 1.2 Staff missing practice_id (should be 0)
SELECT 'STAFF_MISSING_PRACTICE_ID' as check_name, COUNT(*) as issues
FROM practice_staff
WHERE practice_id IS NULL;

-- 1.3 Patient accounts missing practice_id (should be 0)
SELECT 'PATIENT_ACCOUNTS_MISSING_PRACTICE_ID' as check_name, COUNT(*) as issues
FROM patient_accounts
WHERE practice_id IS NULL;

-- 1.4 Orders missing practice_id
SELECT 'ORDERS_MISSING_PRACTICE_ID' as check_name, COUNT(*) as issues
FROM orders
WHERE practice_id IS NULL;

-- ============================================================================
-- SECTION 2: MISSING USER_ID VALIDATION (WHERE REQUIRED)
-- ============================================================================

-- 2.1 Profiles missing user_id (should be 0)
SELECT 'PROFILES_MISSING_ID' as check_name, COUNT(*) as issues
FROM profiles
WHERE id IS NULL;

-- 2.2 Providers missing user_id (should be 0)
SELECT 'PROVIDERS_MISSING_USER_ID' as check_name, COUNT(*) as issues
FROM providers
WHERE user_id IS NULL;

-- 2.3 Staff missing user_id (should be 0)
SELECT 'STAFF_MISSING_USER_ID' as check_name, COUNT(*) as issues
FROM practice_staff
WHERE user_id IS NULL;

-- 2.4 Pharmacies missing user_id (should be 0)
SELECT 'PHARMACIES_MISSING_USER_ID' as check_name, COUNT(*) as issues
FROM pharmacies
WHERE user_id IS NULL;

-- ============================================================================
-- SECTION 3: DUPLICATE PRIMARY KEYS
-- ============================================================================

-- 3.1 Duplicate patient IDs
SELECT 'DUPLICATE_PATIENT_IDS' as check_name, COUNT(*) as issues
FROM (
  SELECT id, COUNT(*) 
  FROM patient_accounts 
  GROUP BY id 
  HAVING COUNT(*) > 1
) dupes;

-- 3.2 Duplicate provider IDs
SELECT 'DUPLICATE_PROVIDER_IDS' as check_name, COUNT(*) as issues
FROM (
  SELECT id, COUNT(*) 
  FROM providers 
  GROUP BY id 
  HAVING COUNT(*) > 1
) dupes;

-- 3.3 Duplicate staff IDs
SELECT 'DUPLICATE_STAFF_IDS' as check_name, COUNT(*) as issues
FROM (
  SELECT id, COUNT(*) 
  FROM practice_staff 
  GROUP BY id 
  HAVING COUNT(*) > 1
) dupes;

-- 3.4 Duplicate pharmacy IDs
SELECT 'DUPLICATE_PHARMACY_IDS' as check_name, COUNT(*) as issues
FROM (
  SELECT id, COUNT(*) 
  FROM pharmacies 
  GROUP BY id 
  HAVING COUNT(*) > 1
) dupes;

-- 3.5 Duplicate patients demographic table IDs
SELECT 'DUPLICATE_PATIENTS_IDS' as check_name, COUNT(*) as issues
FROM (
  SELECT id, COUNT(*) 
  FROM patients 
  GROUP BY id 
  HAVING COUNT(*) > 1
) dupes;

-- ============================================================================
-- SECTION 4: DUPLICATE EXTERNAL IDS / REFERENCE IDS
-- ============================================================================

-- 4.1 Duplicate patient reference IDs
SELECT 'DUPLICATE_PATIENT_REFERENCE_IDS' as check_name, COUNT(*) as issues
FROM (
  SELECT patient_reference_id, COUNT(*) 
  FROM patient_accounts 
  WHERE patient_reference_id IS NOT NULL
  GROUP BY patient_reference_id 
  HAVING COUNT(*) > 1
) dupes;

-- 4.2 Duplicate prescription external IDs
SELECT 'DUPLICATE_PRESCRIPTION_EXTERNAL_IDS' as check_name, COUNT(*) as issues
FROM (
  SELECT external_id, COUNT(*) 
  FROM prescriptions 
  WHERE external_id IS NOT NULL
  GROUP BY external_id 
  HAVING COUNT(*) > 1
) dupes;

-- ============================================================================
-- SECTION 5: MISSING FOREIGN KEYS (ORPHANED RECORDS)
-- ============================================================================

-- 5.1 Patient accounts with invalid practice_id
SELECT 'PATIENT_ACCOUNTS_INVALID_PRACTICE' as check_name, COUNT(*) as issues
FROM patient_accounts pa
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = pa.practice_id);

-- 5.2 Providers with invalid practice_id
SELECT 'PROVIDERS_INVALID_PRACTICE' as check_name, COUNT(*) as issues
FROM providers pr
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = pr.practice_id);

-- 5.3 Staff with invalid practice_id
SELECT 'STAFF_INVALID_PRACTICE' as check_name, COUNT(*) as issues
FROM practice_staff ps
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = ps.practice_id);

-- 5.4 Patient appointments with invalid patient_id
SELECT 'APPOINTMENTS_INVALID_PATIENT' as check_name, COUNT(*) as issues
FROM patient_appointments apt
WHERE NOT EXISTS (SELECT 1 FROM patient_accounts pa WHERE pa.id = apt.patient_id);

-- 5.5 Patient appointments with invalid practice_id
SELECT 'APPOINTMENTS_INVALID_PRACTICE' as check_name, COUNT(*) as issues
FROM patient_appointments apt
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = apt.practice_id);

-- 5.6 Orders with invalid doctor_id
SELECT 'ORDERS_INVALID_DOCTOR' as check_name, COUNT(*) as issues
FROM orders o
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = o.doctor_id);

-- 5.7 Order lines with invalid order_id
SELECT 'ORDER_LINES_INVALID_ORDER' as check_name, COUNT(*) as issues
FROM order_lines ol
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = ol.order_id);

-- 5.8 Prescriptions with invalid patient_account_id
SELECT 'PRESCRIPTIONS_INVALID_PATIENT' as check_name, COUNT(*) as issues
FROM prescriptions p
WHERE NOT EXISTS (SELECT 1 FROM patient_accounts pa WHERE pa.id = p.patient_account_id);

-- 5.9 Medical vault entries with invalid patient_account_id
SELECT 'VAULT_INVALID_PATIENT' as check_name, COUNT(*) as issues
FROM patient_medical_vault v
WHERE NOT EXISTS (SELECT 1 FROM patient_accounts pa WHERE pa.id = v.patient_account_id);

-- ============================================================================
-- SECTION 6: PRACTICE-USER RELATIONSHIP MISMATCHES
-- ============================================================================

-- 6.1 Providers user_id not matching practice
SELECT 'PROVIDER_USER_PRACTICE_MISMATCH' as check_name, COUNT(*) as issues
FROM providers pr
JOIN profiles practice ON practice.id = pr.practice_id
WHERE pr.user_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM profiles provider_user 
    WHERE provider_user.id = pr.user_id
  );

-- 6.2 Staff user_id not matching practice
SELECT 'STAFF_USER_PRACTICE_MISMATCH' as check_name, COUNT(*) as issues
FROM practice_staff ps
JOIN profiles practice ON practice.id = ps.practice_id
WHERE ps.user_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM profiles staff_user 
    WHERE staff_user.id = ps.user_id
  );

-- ============================================================================
-- SECTION 7: ROW COUNT COMPARISONS (LEGACY VS CONSOLIDATED)
-- ============================================================================

-- 7.1 Patient data migration verification
SELECT 
  'PATIENT_DATA_MIGRATION' as check_name,
  (SELECT COUNT(*) FROM patient_allergies) as legacy_allergies,
  (SELECT COUNT(*) FROM patient_conditions) as legacy_conditions,
  (SELECT COUNT(*) FROM patient_medications) as legacy_medications,
  (SELECT COUNT(*) FROM patient_vitals) as legacy_vitals,
  (SELECT COUNT(*) FROM patient_immunizations) as legacy_immunizations,
  (SELECT COUNT(*) FROM patient_surgeries) as legacy_surgeries,
  (SELECT COUNT(*) FROM patient_pharmacies) as legacy_pharmacies,
  (SELECT COUNT(*) FROM patient_emergency_contacts) as legacy_emergency,
  (SELECT COUNT(*) FROM patient_documents) as legacy_documents,
  (SELECT COUNT(*) FROM patient_follow_ups) as legacy_followups,
  (SELECT COUNT(*) FROM patient_notes) as legacy_notes,
  (SELECT COUNT(*) FROM patient_messages) as legacy_messages,
  (SELECT COUNT(*) FROM patient_medical_vault) as vault_total;

-- 7.2 Message migration verification
SELECT 
  'MESSAGE_MIGRATION' as check_name,
  (SELECT COUNT(*) FROM internal_messages) as legacy_internal_messages,
  (SELECT COUNT(*) FROM patient_messages) as legacy_patient_messages,
  (SELECT COUNT(*) FROM messages) as consolidated_messages,
  (SELECT COUNT(*) FROM messages WHERE message_type = 'internal') as internal_type_count;

-- 7.3 Video module verification
SELECT 
  'VIDEO_MODULE' as check_name,
  (SELECT COUNT(*) FROM video_sessions) as total_sessions,
  (SELECT COUNT(*) FROM video_guest_tokens) as total_guest_tokens,
  (SELECT COUNT(*) FROM video_usage_by_practice) as usage_records;

-- 7.4 Patient demographic migration
SELECT 
  'PATIENT_DEMOGRAPHIC_MIGRATION' as check_name,
  (SELECT COUNT(*) FROM patient_accounts) as patient_accounts_count,
  (SELECT COUNT(*) FROM patients) as patients_demographic_count,
  (SELECT COUNT(*) FROM patient_accounts WHERE patient_id IS NULL) as accounts_missing_patient_link;

-- ============================================================================
-- SECTION 8: INDEX VALIDATION
-- ============================================================================

-- 8.1 List all missing recommended indexes
SELECT 
  'MISSING_INDEXES' as check_name,
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'patients', 'patient_accounts', 'patient_medical_vault',
    'orders', 'order_lines', 'prescriptions',
    'messages', 'video_sessions', 'providers', 'practice_staff'
  )
ORDER BY tablename, indexname;

-- ============================================================================
-- SECTION 9: DATA INTEGRITY CHECKS
-- ============================================================================

-- 9.1 Patients with no email and no phone
SELECT 'PATIENTS_NO_CONTACT' as check_name, COUNT(*) as issues
FROM patients
WHERE (email IS NULL OR email = '') 
  AND (phone IS NULL OR phone = '');

-- 9.2 Orders with no order lines
SELECT 'ORDERS_NO_LINES' as check_name, COUNT(*) as issues
FROM orders o
WHERE NOT EXISTS (SELECT 1 FROM order_lines ol WHERE ol.order_id = o.id);

-- 9.3 Appointments with no patient
SELECT 'APPOINTMENTS_NO_PATIENT' as check_name, COUNT(*) as issues
FROM patient_appointments
WHERE patient_id IS NULL;

-- 9.4 Prescriptions with no medication name
SELECT 'PRESCRIPTIONS_NO_MEDICATION' as check_name, COUNT(*) as issues
FROM prescriptions
WHERE medication_name IS NULL OR medication_name = '';

-- ============================================================================
-- SECTION 10: SUMMARY STATISTICS
-- ============================================================================

SELECT 
  'DATABASE_SUMMARY' as report_name,
  (SELECT COUNT(*) FROM profiles) as total_profiles,
  (SELECT COUNT(*) FROM patient_accounts) as total_patient_accounts,
  (SELECT COUNT(*) FROM patients) as total_patients_demographic,
  (SELECT COUNT(*) FROM providers) as total_providers,
  (SELECT COUNT(*) FROM practice_staff) as total_staff,
  (SELECT COUNT(*) FROM pharmacies) as total_pharmacies,
  (SELECT COUNT(*) FROM orders) as total_orders,
  (SELECT COUNT(*) FROM order_lines) as total_order_lines,
  (SELECT COUNT(*) FROM prescriptions) as total_prescriptions,
  (SELECT COUNT(*) FROM patient_medical_vault) as total_vault_records,
  (SELECT COUNT(*) FROM messages) as total_messages,
  (SELECT COUNT(*) FROM video_sessions) as total_video_sessions,
  (SELECT COUNT(*) FROM patient_appointments) as total_appointments;

-- ============================================================================
-- SECTION 11: LEGACY TABLES STILL CONTAINING DATA
-- ============================================================================

SELECT 
  'LEGACY_TABLES_WITH_DATA' as check_name,
  'patient_allergies' as table_name,
  (SELECT COUNT(*) FROM patient_allergies) as row_count
WHERE (SELECT COUNT(*) FROM patient_allergies) > 0
UNION ALL
SELECT 
  'LEGACY_TABLES_WITH_DATA',
  'patient_conditions',
  (SELECT COUNT(*) FROM patient_conditions)
WHERE (SELECT COUNT(*) FROM patient_conditions) > 0
UNION ALL
SELECT 
  'LEGACY_TABLES_WITH_DATA',
  'patient_medications',
  (SELECT COUNT(*) FROM patient_medications)
WHERE (SELECT COUNT(*) FROM patient_medications) > 0
UNION ALL
SELECT 
  'LEGACY_TABLES_WITH_DATA',
  'patient_vitals',
  (SELECT COUNT(*) FROM patient_vitals)
WHERE (SELECT COUNT(*) FROM patient_vitals) > 0
UNION ALL
SELECT 
  'LEGACY_TABLES_WITH_DATA',
  'patient_immunizations',
  (SELECT COUNT(*) FROM patient_immunizations)
WHERE (SELECT COUNT(*) FROM patient_immunizations) > 0
UNION ALL
SELECT 
  'LEGACY_TABLES_WITH_DATA',
  'patient_surgeries',
  (SELECT COUNT(*) FROM patient_surgeries)
WHERE (SELECT COUNT(*) FROM patient_surgeries) > 0
UNION ALL
SELECT 
  'LEGACY_TABLES_WITH_DATA',
  'patient_pharmacies',
  (SELECT COUNT(*) FROM patient_pharmacies)
WHERE (SELECT COUNT(*) FROM patient_pharmacies) > 0
UNION ALL
SELECT 
  'LEGACY_TABLES_WITH_DATA',
  'patient_emergency_contacts',
  (SELECT COUNT(*) FROM patient_emergency_contacts)
WHERE (SELECT COUNT(*) FROM patient_emergency_contacts) > 0
UNION ALL
SELECT 
  'LEGACY_TABLES_WITH_DATA',
  'patient_documents',
  (SELECT COUNT(*) FROM patient_documents)
WHERE (SELECT COUNT(*) FROM patient_documents) > 0
UNION ALL
SELECT 
  'LEGACY_TABLES_WITH_DATA',
  'patient_follow_ups',
  (SELECT COUNT(*) FROM patient_follow_ups)
WHERE (SELECT COUNT(*) FROM patient_follow_ups) > 0
UNION ALL
SELECT 
  'LEGACY_TABLES_WITH_DATA',
  'patient_notes',
  (SELECT COUNT(*) FROM patient_notes)
WHERE (SELECT COUNT(*) FROM patient_notes) > 0
UNION ALL
SELECT 
  'LEGACY_TABLES_WITH_DATA',
  'patient_messages',
  (SELECT COUNT(*) FROM patient_messages)
WHERE (SELECT COUNT(*) FROM patient_messages) > 0
UNION ALL
SELECT 
  'LEGACY_TABLES_WITH_DATA',
  'internal_messages',
  (SELECT COUNT(*) FROM internal_messages)
WHERE (SELECT COUNT(*) FROM internal_messages) > 0;

-- ============================================================================
-- END OF VALIDATION PACK
-- ============================================================================
