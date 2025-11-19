-- =====================================================
-- PHASE 3: DATABASE LOAD TEST DATA GENERATOR
-- =====================================================
-- This script generates test data to simulate production scale
-- WARNING: Run on staging/test environment only!
-- =====================================================

-- 1. Generate 10,000 practice accounts
-- =====================================================
DO $$
DECLARE
  i INTEGER;
  practice_id UUID;
BEGIN
  FOR i IN 1..10000 LOOP
    practice_id := gen_random_uuid();
    
    INSERT INTO profiles (id, name, email, practice_name, role)
    VALUES (
      practice_id,
      'Test Practice ' || i,
      'practice' || i || '@loadtest.com',
      'Load Test Practice ' || i,
      'doctor'
    );
    
    INSERT INTO user_roles (user_id, role)
    VALUES (practice_id, 'doctor');
    
    -- Log progress every 1000 records
    IF i % 1000 = 0 THEN
      RAISE NOTICE 'Generated % practices', i;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Completed: 10,000 practice accounts created';
END $$;

-- 2. Generate 50,000 patients (5 patients per practice on average)
-- =====================================================
DO $$
DECLARE
  i INTEGER;
  patient_id UUID;
  practice_id UUID;
  practices UUID[];
BEGIN
  -- Get array of all practice IDs
  SELECT ARRAY_AGG(id) INTO practices
  FROM profiles
  WHERE role = 'doctor'
  LIMIT 10000;
  
  FOR i IN 1..50000 LOOP
    patient_id := gen_random_uuid();
    
    -- Assign to random practice
    practice_id := practices[1 + floor(random() * array_length(practices, 1))];
    
    INSERT INTO patient_accounts (id, name, email, phone, date_of_birth, practice_id)
    VALUES (
      patient_id,
      'Load Test Patient ' || i,
      'patient' || i || '@loadtest.com',
      '+1' || lpad((2000000000 + i)::text, 10, '0'),
      '1990-01-01'::date + (random() * 365 * 30)::integer,
      practice_id
    );
    
    -- Log progress every 5000 records
    IF i % 5000 = 0 THEN
      RAISE NOTICE 'Generated % patients', i;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Completed: 50,000 patient accounts created';
END $$;

-- 3. Generate 250,000 orders (5 orders per patient on average)
-- =====================================================
DO $$
DECLARE
  i INTEGER;
  order_id UUID;
  doctor_id UUID;
  patient_id UUID;
  product_id UUID;
  doctors UUID[];
  patients UUID[];
  products UUID[];
BEGIN
  -- Get arrays of IDs
  SELECT ARRAY_AGG(id) INTO doctors FROM profiles WHERE role = 'doctor' LIMIT 10000;
  SELECT ARRAY_AGG(id) INTO patients FROM patient_accounts LIMIT 50000;
  SELECT ARRAY_AGG(id) INTO products FROM products WHERE active = true LIMIT 100;
  
  FOR i IN 1..250000 LOOP
    order_id := gen_random_uuid();
    doctor_id := doctors[1 + floor(random() * array_length(doctors, 1))];
    patient_id := patients[1 + floor(random() * array_length(patients, 1))];
    product_id := products[1 + floor(random() * array_length(products, 1))];
    
    -- Create order
    INSERT INTO orders (id, practice_id, status, total, created_at)
    VALUES (
      order_id,
      doctor_id,
      (ARRAY['pending', 'processing', 'shipped', 'delivered'])[1 + floor(random() * 4)],
      50 + (random() * 950)::numeric,
      NOW() - (random() * 365 * interval '1 day')
    );
    
    -- Create order line
    INSERT INTO order_lines (
      order_id,
      product_id,
      patient_name,
      patient_email,
      price,
      quantity,
      shipping_speed,
      created_at
    )
    VALUES (
      order_id,
      product_id,
      'Load Test Patient',
      'patient@loadtest.com',
      50 + (random() * 950)::numeric,
      1,
      (ARRAY['standard', 'expedited', 'overnight'])[1 + floor(random() * 3)]::shipping_speed,
      NOW() - (random() * 365 * interval '1 day')
    );
    
    -- Log progress every 25000 records
    IF i % 25000 = 0 THEN
      RAISE NOTICE 'Generated % orders', i;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Completed: 250,000 orders created';
END $$;

-- 4. Generate 500,000 audit log entries
-- =====================================================
DO $$
DECLARE
  i INTEGER;
  user_id UUID;
  users UUID[];
BEGIN
  SELECT ARRAY_AGG(id) INTO users FROM profiles LIMIT 10000;
  
  FOR i IN 1..500000 LOOP
    user_id := users[1 + floor(random() * array_length(users, 1))];
    
    INSERT INTO audit_logs (
      user_id,
      action_type,
      entity_type,
      entity_id,
      ip_address,
      created_at
    )
    VALUES (
      user_id,
      (ARRAY['read', 'create', 'update', 'delete'])[1 + floor(random() * 4)],
      (ARRAY['order', 'patient', 'prescription', 'profile'])[1 + floor(random() * 4)],
      gen_random_uuid(),
      '192.168.' || floor(random() * 256) || '.' || floor(random() * 256),
      NOW() - (random() * 90 * interval '1 day')
    );
    
    -- Log progress every 50000 records
    IF i % 50000 = 0 THEN
      RAISE NOTICE 'Generated % audit logs', i;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Completed: 500,000 audit log entries created';
END $$;

-- =====================================================
-- PERFORMANCE TEST QUERIES
-- =====================================================
-- Run these queries to test performance with load data
-- All should complete in < 1 second
-- =====================================================

-- Test 1: Get recent orders for a practice
EXPLAIN ANALYZE
SELECT id, total, status, created_at
FROM orders
WHERE practice_id = (SELECT id FROM profiles WHERE role = 'doctor' LIMIT 1)
  AND status = 'pending'
ORDER BY created_at DESC
LIMIT 50;
-- Expected: Uses index, < 50ms

-- Test 2: Get patient list for a practice
EXPLAIN ANALYZE
SELECT id, name, email, phone
FROM patient_accounts
WHERE practice_id = (SELECT id FROM profiles WHERE role = 'doctor' LIMIT 1)
ORDER BY name
LIMIT 100;
-- Expected: Uses index, < 100ms

-- Test 3: Get audit logs for a user
EXPLAIN ANALYZE
SELECT action_type, entity_type, created_at
FROM audit_logs
WHERE user_id = (SELECT id FROM profiles LIMIT 1)
ORDER BY created_at DESC
LIMIT 100;
-- Expected: Uses index, < 50ms

-- Test 4: Get orders by status (common dashboard query)
EXPLAIN ANALYZE
SELECT COUNT(*), status
FROM orders
WHERE practice_id = (SELECT id FROM profiles WHERE role = 'doctor' LIMIT 1)
GROUP BY status;
-- Expected: Uses index, < 100ms

-- Test 5: Get recent patient orders
EXPLAIN ANALYZE
SELECT o.id, o.total, o.status, o.created_at, ol.product_id
FROM orders o
JOIN order_lines ol ON ol.order_id = o.id
WHERE ol.patient_id = (SELECT id FROM patient_accounts LIMIT 1)
ORDER BY o.created_at DESC
LIMIT 20;
-- Expected: Uses indexes on both tables, < 150ms

-- =====================================================
-- CLEANUP (Run after testing)
-- =====================================================
-- WARNING: This deletes all test data!
-- =====================================================

-- Uncomment to clean up test data:
-- DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM profiles WHERE email LIKE '%@loadtest.com');
-- DELETE FROM order_lines WHERE order_id IN (SELECT id FROM orders WHERE practice_id IN (SELECT id FROM profiles WHERE email LIKE '%@loadtest.com'));
-- DELETE FROM orders WHERE practice_id IN (SELECT id FROM profiles WHERE email LIKE '%@loadtest.com');
-- DELETE FROM patient_accounts WHERE email LIKE '%@loadtest.com';
-- DELETE FROM user_roles WHERE user_id IN (SELECT id FROM profiles WHERE email LIKE '%@loadtest.com');
-- DELETE FROM profiles WHERE email LIKE '%@loadtest.com';

-- =====================================================
-- SUMMARY STATISTICS
-- =====================================================

SELECT 
  'Practices' as entity,
  COUNT(*) as count
FROM profiles
WHERE role = 'doctor'
UNION ALL
SELECT 
  'Patients' as entity,
  COUNT(*) as count
FROM patient_accounts
UNION ALL
SELECT 
  'Orders' as entity,
  COUNT(*) as count
FROM orders
UNION ALL
SELECT 
  'Audit Logs' as entity,
  COUNT(*) as count
FROM audit_logs;
