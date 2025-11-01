-- Add can_order column to practice_staff table
ALTER TABLE public.practice_staff 
ADD COLUMN IF NOT EXISTS can_order BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.practice_staff.can_order IS 
  'Whether this staff member can place orders on behalf of the practice';

-- Create index for common query pattern
CREATE INDEX IF NOT EXISTS idx_practice_staff_can_order 
ON public.practice_staff(practice_id, can_order) 
WHERE active = true AND can_order = true;