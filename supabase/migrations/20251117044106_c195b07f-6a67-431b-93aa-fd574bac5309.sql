-- DROP ALL EXISTING POLICIES ON ORDERS
DROP POLICY IF EXISTS "Active doctors can create orders" ON orders;
DROP POLICY IF EXISTS "Active providers can create orders for their practice" ON orders;
DROP POLICY IF EXISTS "Active providers can view practice orders" ON orders;
DROP POLICY IF EXISTS "Active staff can create orders for their practice" ON orders;
DROP POLICY IF EXISTS "Active staff can view practice orders" ON orders;
DROP POLICY IF EXISTS "Admins can create orders for any active doctor" ON orders;
DROP POLICY IF EXISTS "Downline reps can view their practice orders" ON orders;
DROP POLICY IF EXISTS "Downlines can view assigned practice orders v2" ON orders;
DROP POLICY IF EXISTS "Providers and admins can update report notes" ON orders;
DROP POLICY IF EXISTS "Providers can view orders containing their prescriptions" ON orders;
DROP POLICY IF EXISTS "Staff can view their practice orders" ON orders;
DROP POLICY IF EXISTS "Topline reps can view their practice orders" ON orders;
DROP POLICY IF EXISTS "Toplines can view downline practice orders v2" ON orders;
DROP POLICY IF EXISTS "Users can cancel eligible orders" ON orders;
DROP POLICY IF EXISTS "orders_select_admin" ON orders;
DROP POLICY IF EXISTS "orders_select_pharmacy" ON orders;
DROP POLICY IF EXISTS "orders_select_practice_staff_provider" ON orders;

-- DROP ALL EXISTING POLICIES ON ORDER_LINES
DROP POLICY IF EXISTS "Active staff can insert order lines for their practice" ON order_lines;
DROP POLICY IF EXISTS "Admins can insert any order lines" ON order_lines;
DROP POLICY IF EXISTS "Admins can update all order lines" ON order_lines;
DROP POLICY IF EXISTS "Admins can view all order lines" ON order_lines;
DROP POLICY IF EXISTS "Doctors can insert their order lines" ON order_lines;
DROP POLICY IF EXISTS "Doctors can view their order lines" ON order_lines;
DROP POLICY IF EXISTS "Downline reps can view their practice order lines" ON order_lines;
DROP POLICY IF EXISTS "Downlines can view order lines for their practices v2" ON order_lines;
DROP POLICY IF EXISTS "Pharmacies can update assigned order line status" ON order_lines;
DROP POLICY IF EXISTS "Pharmacies can view assigned order lines" ON order_lines;
DROP POLICY IF EXISTS "Providers can insert order lines for their practice orders" ON order_lines;
DROP POLICY IF EXISTS "Providers can view their prescribed order lines" ON order_lines;
DROP POLICY IF EXISTS "Staff can view their practice order lines" ON order_lines;
DROP POLICY IF EXISTS "Staff in providers table can insert order lines for practice or" ON order_lines;
DROP POLICY IF EXISTS "Topline reps can view their practice order lines" ON order_lines;
DROP POLICY IF EXISTS "Toplines can view order lines for downline practices v2" ON order_lines;