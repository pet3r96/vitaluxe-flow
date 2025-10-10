-- Drop the problematic pharmacy policy that's blocking all users
DROP POLICY IF EXISTS "Pharmacies can view orders with assigned lines" ON public.orders;