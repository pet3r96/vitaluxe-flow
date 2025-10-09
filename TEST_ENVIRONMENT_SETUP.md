# Test Environment Setup Guide

## ✅ COMPLETED: Database Configuration

### Role-Based Access Control
- ✅ Admin: Full access to all data and operations
- ✅ Provider (Doctor): Can manage own patients and orders only
- ✅ Pharmacy: Can view and update status of assigned orders only

### Test Products Created
- ✅ 10 test products added with "Test -" prefix for easy identification
- ✅ All products visible to providers (read-only)
- ✅ Only admins can create/edit products

### Database Schema
- ✅ Patient table includes `provider_id` for ownership tracking
- ✅ Order status timestamps added (processing_at, shipped_at, delivered_at)
- ✅ Automatic timestamp updates on status changes
- ✅ Proper RLS policies enforced for all roles

---

## 📋 NEXT STEPS: Create Test User Accounts

**IMPORTANT**: You must create the following test accounts through the Auth page at `/auth`

### 1. Admin Account
Navigate to `/auth` and sign up:
- **Email**: `admin.test@vitaluxe.com`
- **Password**: `Admin123!`
- **Name**: `Test Admin`
- **Role**: Select "Admin" (or you'll assign this via backend)

### 2. Provider Accounts
Create two provider accounts:

**Provider 1:**
- **Email**: `dr.john.test@vitaluxe.com`
- **Password**: `Provider123!`
- **Name**: `Dr. John Test`
- **Role**: Doctor
- **License Number**: `TEST-LIC-001`
- **NPI**: `1234567890`

**Provider 2:**
- **Email**: `dr.emily.test@vitaluxe.com`
- **Password**: `Provider123!`
- **Name**: `Dr. Emily Test`
- **Role**: Doctor
- **License Number**: `TEST-LIC-002`
- **NPI**: `0987654321`

### 3. Pharmacy Accounts
Create two pharmacy accounts:

**Pharmacy 1:**
- **Email**: `pharmacy.one.test@vitaluxe.com`
- **Password**: `Pharmacy123!`
- **Name**: `Test Pharmacy One`
- **Role**: Pharmacy
- **Contact Email**: `contact@pharmacy1test.com`
- **Address**: `100 Pharmacy Plaza, Test City, TC 12345`
- **States Serviced**: `["CA", "NY", "TX"]`

**Pharmacy 2:**
- **Email**: `pharmacy.two.test@vitaluxe.com`
- **Password**: `Pharmacy123!`
- **Name**: `Test Pharmacy Two`
- **Role**: Pharmacy
- **Contact Email**: `contact@pharmacy2test.com`
- **Address**: `200 Medical Center Dr, Test Town, TT 54321`
- **States Serviced**: `["FL", "IL", "WA"]`

---

## 🔧 After Creating Accounts: Assign User IDs

Once all accounts are created, you'll need to:

1. **Get User IDs**: Query the backend to get the UUID for each user
2. **Create Test Patients**: Link patients to their respective providers
3. **Create Test Orders**: Link orders to providers, patients, and pharmacies

### SQL to Get User IDs
Run this query in your backend to get the user IDs:

```sql
SELECT id, email, name FROM profiles WHERE email LIKE '%test@vitaluxe.com';
```

### Create Test Patients (Run after getting provider UUIDs)

**For Dr. John Test** (replace `<dr_john_uuid>` with actual UUID):
```sql
INSERT INTO public.patients (provider_id, name, email, phone, address, birth_date) VALUES
('<dr_john_uuid>', 'John Smith', 'john.smith@test.com', '555-0101', '123 Main St, Test City, TC 12345', '1985-06-21'),
('<dr_john_uuid>', 'Sarah Miller', 'sarah.miller@test.com', '555-0102', '22 Oak Dr, Test City, TC 12346', '1990-09-05'),
('<dr_john_uuid>', 'Jason Kim', 'jason.kim@test.com', '555-0103', '555 Pine Ln, Test City, TC 12347', '1979-03-18');
```

**For Dr. Emily Test** (replace `<dr_emily_uuid>` with actual UUID):
```sql
INSERT INTO public.patients (provider_id, name, email, phone, address, birth_date) VALUES
('<dr_emily_uuid>', 'Anna Rivera', 'anna.rivera@test.com', '555-0201', '789 Maple St, Test Town, TT 54321', '1992-11-02'),
('<dr_emily_uuid>', 'Marcus Lee', 'marcus.lee@test.com', '555-0202', '44 Birch Ave, Test Town, TT 54322', '1988-04-11'),
('<dr_emily_uuid>', 'David Patel', 'david.patel@test.com', '555-0203', '77 Cedar Way, Test Town, TT 54323', '1975-02-14');
```

### Create Test Orders (Run after getting all UUIDs)

**Order 1** - Dr. John Test → John Smith → Pharmacy One:
```sql
-- First, create the order
INSERT INTO public.orders (doctor_id, total_amount, status)
VALUES ('<dr_john_uuid>', 23.00, 'pending')
RETURNING id;

-- Then create order lines (replace <order_id>, <patient_id>, <pharmacy_id>, and product IDs)
INSERT INTO public.order_lines (order_id, product_id, patient_id, patient_name, patient_address, assigned_pharmacy_id, quantity, price, status)
VALUES
('<order_id>', '<thermometer_product_id>', '<john_smith_patient_id>', 'John Smith', '123 Main St, Test City, TC 12345', '<pharmacy_one_id>', 1, 15.00, 'pending'),
('<order_id>', '<syringe_product_id>', '<john_smith_patient_id>', 'John Smith', '123 Main St, Test City, TC 12345', '<pharmacy_one_id>', 1, 8.00, 'pending');
```

**Order 2** - Dr. Emily Test → Anna Rivera → Pharmacy Two:
```sql
INSERT INTO public.orders (doctor_id, total_amount, status)
VALUES ('<dr_emily_uuid>', 23.00, 'processing')
RETURNING id;

INSERT INTO public.order_lines (order_id, product_id, patient_id, patient_name, patient_address, assigned_pharmacy_id, quantity, price, status)
VALUES
('<order_id>', '<bandage_product_id>', '<anna_rivera_patient_id>', 'Anna Rivera', '789 Maple St, Test Town, TT 54321', '<pharmacy_two_id>', 1, 5.00, 'processing'),
('<order_id>', '<glucose_product_id>', '<anna_rivera_patient_id>', 'Anna Rivera', '789 Maple St, Test Town, TT 54321', '<pharmacy_two_id>', 1, 18.00, 'processing');
```

**Order 3** - Dr. John Test → Sarah Miller → Pharmacy One:
```sql
INSERT INTO public.orders (doctor_id, total_amount, status)
VALUES ('<dr_john_uuid>', 30.00, 'shipped')
RETURNING id;

INSERT INTO public.order_lines (order_id, product_id, patient_id, patient_name, patient_address, assigned_pharmacy_id, quantity, price, status)
VALUES
('<order_id>', '<oximeter_product_id>', '<sarah_miller_patient_id>', 'Sarah Miller', '22 Oak Dr, Test City, TC 12346', '<pharmacy_one_id>', 1, 25.00, 'shipped'),
('<order_id>', '<tape_product_id>', '<sarah_miller_patient_id>', 'Sarah Miller', '22 Oak Dr, Test City, TC 12346', '<pharmacy_one_id>', 1, 5.00, 'shipped');
```

---

## 🔐 Role-Based Access Verification

### Admin Dashboard
Login as `admin.test@vitaluxe.com` and verify access to:
- ✅ Products (full CRUD)
- ✅ Providers (view all, manage)
- ✅ Pharmacies (view all, manage)
- ✅ Patients (view all)
- ✅ Orders (view all, update any status)

### Provider Dashboard
Login as `dr.john.test@vitaluxe.com` and verify:
- ✅ Products visible (read-only, cannot edit)
- ✅ Can create and manage own patients only
- ✅ Can create orders for own patients
- ✅ Can view own orders and track status
- ❌ Cannot see Dr. Emily's patients or orders

### Pharmacy Dashboard
Login as `pharmacy.one.test@vitaluxe.com` and verify:
- ✅ Can view orders assigned to Pharmacy One only
- ✅ Can update status: pending → processing → shipped → delivered
- ❌ Cannot view Pharmacy Two's orders
- ❌ Cannot edit products, patients, or providers

---

## 📊 Order Status Lifecycle

### Status Flow
```
pending → processing → shipped → delivered
```

### Permissions
- **Pharmacies**: Can transition statuses forward only
- **Admins**: Can set any status at any time
- **Providers**: View-only, cannot change status

### Timestamps
Automatically tracked on status changes:
- `processing_at`: When status changes to "processing"
- `shipped_at`: When status changes to "shipped"
- `delivered_at`: When status changes to "delivered"

---

## ✅ Validation Checklist

After completing all setup steps, verify:

- [ ] 10 "Test -" products visible in Products tab
- [ ] Admin account has full access to all sections
- [ ] 2 provider accounts created with doctor role
- [ ] 2 pharmacy accounts created with pharmacy role
- [ ] 6 patients created (3 per provider)
- [ ] Each provider sees only their own patients
- [ ] 3 test orders created with proper assignments
- [ ] Pharmacies can update status of assigned orders
- [ ] Providers cannot edit products
- [ ] Proper role-based navigation working
- [ ] Status timestamps auto-populate on changes

---

## 🧹 Cleanup Commands

When testing is complete, remove all test data:

```sql
-- Delete test orders
DELETE FROM public.order_lines WHERE patient_name LIKE '%Smith%' OR patient_name LIKE '%Rivera%' OR patient_name LIKE '%Miller%';
DELETE FROM public.orders WHERE id IN (SELECT DISTINCT order_id FROM public.order_lines WHERE patient_name LIKE '%Smith%');

-- Delete test patients
DELETE FROM public.patients WHERE email LIKE '%@test.com';

-- Delete test products
DELETE FROM public.products WHERE name LIKE 'Test -%';

-- Delete test profiles and auth users (do this via Supabase Auth dashboard)
-- Search for emails containing 'test@vitaluxe.com' and delete
```

---

## 📞 Support

If you encounter any issues during setup:
1. Check the browser console for errors
2. Verify RLS policies in the backend
3. Confirm user roles are properly assigned in `user_roles` table
4. Check that `provider_id` is set correctly on patients

---

**Status**: Database schema and products ready ✅  
**Next**: Create test user accounts via Auth page  
**Then**: Populate patients and orders with actual UUIDs
