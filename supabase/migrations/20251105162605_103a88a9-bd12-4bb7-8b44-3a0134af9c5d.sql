-- Add staff role to all treatment plan RLS policies
-- This allows staff users to create, view, edit, and manage treatment plans

-- ============================================================================
-- Part 1: Fix treatment_plans table (4 policies)
-- ============================================================================

-- 1. SELECT: Allow staff to read treatment plans
DROP POLICY IF EXISTS "staff_read_plans" ON public.treatment_plans;
CREATE POLICY "staff_read_plans"
ON public.treatment_plans
FOR SELECT
TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'doctor'::app_role) 
  OR has_role(auth.uid(), 'provider'::app_role)
  OR has_role(auth.uid(), 'staff'::app_role)
);

-- 2. INSERT: Allow staff to create treatment plans
DROP POLICY IF EXISTS "staff_insert_plans" ON public.treatment_plans;
CREATE POLICY "staff_insert_plans"
ON public.treatment_plans
FOR INSERT
TO public
WITH CHECK (
  (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'doctor'::app_role)
    OR has_role(auth.uid(), 'provider'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
  )
  AND (created_by_user_id = auth.uid())
);

-- 3. UPDATE: Allow staff to edit unlocked plans
DROP POLICY IF EXISTS "staff_update_unlocked_plans" ON public.treatment_plans;
CREATE POLICY "staff_update_unlocked_plans"
ON public.treatment_plans
FOR UPDATE
TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    NOT is_locked 
    AND (
      has_role(auth.uid(), 'doctor'::app_role) 
      OR has_role(auth.uid(), 'provider'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
    )
  )
);

-- 4. DELETE: Allow staff to delete unlocked plans
DROP POLICY IF EXISTS "staff_delete_unlocked_plans" ON public.treatment_plans;
CREATE POLICY "staff_delete_unlocked_plans"
ON public.treatment_plans
FOR DELETE
TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    NOT is_locked 
    AND (
      has_role(auth.uid(), 'doctor'::app_role) 
      OR has_role(auth.uid(), 'provider'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
    )
  )
);

-- ============================================================================
-- Part 2: Fix treatment_plan_goals table (4 policies)
-- ============================================================================

-- 1. SELECT: Allow staff to read goals
DROP POLICY IF EXISTS "read_goals_if_can_read_plan" ON public.treatment_plan_goals;
CREATE POLICY "read_goals_if_can_read_plan"
ON public.treatment_plan_goals
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 
    FROM treatment_plans tp
    WHERE tp.id = treatment_plan_goals.treatment_plan_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'doctor'::app_role)
      OR has_role(auth.uid(), 'provider'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR tp.patient_account_id = auth.uid()
    )
  )
);

-- 2. INSERT: Allow staff to add goals to unlocked plans
DROP POLICY IF EXISTS "insert_goals_when_unlocked" ON public.treatment_plan_goals;
CREATE POLICY "insert_goals_when_unlocked"
ON public.treatment_plan_goals
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM treatment_plans tp
    WHERE tp.id = treatment_plan_goals.treatment_plan_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR (
        NOT tp.is_locked
        AND (
          has_role(auth.uid(), 'doctor'::app_role)
          OR has_role(auth.uid(), 'provider'::app_role)
          OR has_role(auth.uid(), 'staff'::app_role)
        )
      )
    )
  )
);

-- 3. UPDATE: Allow staff to update goals on unlocked plans
DROP POLICY IF EXISTS "update_goals_when_unlocked" ON public.treatment_plan_goals;
CREATE POLICY "update_goals_when_unlocked"
ON public.treatment_plan_goals
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 
    FROM treatment_plans tp
    WHERE tp.id = treatment_plan_goals.treatment_plan_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR (
        NOT tp.is_locked
        AND (
          has_role(auth.uid(), 'doctor'::app_role)
          OR has_role(auth.uid(), 'provider'::app_role)
          OR has_role(auth.uid(), 'staff'::app_role)
        )
      )
    )
  )
);

-- 4. DELETE: Allow staff to delete goals from unlocked plans
DROP POLICY IF EXISTS "delete_goals_when_unlocked" ON public.treatment_plan_goals;
CREATE POLICY "delete_goals_when_unlocked"
ON public.treatment_plan_goals
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1 
    FROM treatment_plans tp
    WHERE tp.id = treatment_plan_goals.treatment_plan_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR (
        NOT tp.is_locked
        AND (
          has_role(auth.uid(), 'doctor'::app_role)
          OR has_role(auth.uid(), 'provider'::app_role)
          OR has_role(auth.uid(), 'staff'::app_role)
        )
      )
    )
  )
);

-- ============================================================================
-- Part 3: Fix treatment_plan_updates table (3 policies)
-- ============================================================================

-- 1. SELECT: Allow staff to read plan updates
DROP POLICY IF EXISTS "read_updates_if_can_read_plan" ON public.treatment_plan_updates;
CREATE POLICY "read_updates_if_can_read_plan"
ON public.treatment_plan_updates
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 
    FROM treatment_plans tp
    WHERE tp.id = treatment_plan_updates.treatment_plan_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'doctor'::app_role)
      OR has_role(auth.uid(), 'provider'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR tp.patient_account_id = auth.uid()
    )
  )
);

-- 2. INSERT: Allow staff to add updates to unlocked plans
DROP POLICY IF EXISTS "insert_updates_when_unlocked" ON public.treatment_plan_updates;
CREATE POLICY "insert_updates_when_unlocked"
ON public.treatment_plan_updates
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM treatment_plans tp
    WHERE tp.id = treatment_plan_updates.treatment_plan_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR (
        NOT tp.is_locked
        AND (
          has_role(auth.uid(), 'doctor'::app_role)
          OR has_role(auth.uid(), 'provider'::app_role)
          OR has_role(auth.uid(), 'staff'::app_role)
        )
      )
    )
  )
);

-- 3. DELETE: Allow staff to delete updates from unlocked plans
DROP POLICY IF EXISTS "delete_updates_when_unlocked" ON public.treatment_plan_updates;
CREATE POLICY "delete_updates_when_unlocked"
ON public.treatment_plan_updates
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1 
    FROM treatment_plans tp
    WHERE tp.id = treatment_plan_updates.treatment_plan_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR (
        NOT tp.is_locked
        AND (
          has_role(auth.uid(), 'doctor'::app_role)
          OR has_role(auth.uid(), 'provider'::app_role)
          OR has_role(auth.uid(), 'staff'::app_role)
        )
      )
    )
  )
);