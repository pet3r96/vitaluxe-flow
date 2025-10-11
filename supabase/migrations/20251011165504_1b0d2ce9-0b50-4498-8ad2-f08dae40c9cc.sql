-- Migrate existing practices to rep_practice_links
-- This creates links for practices that have linked_topline_id set

-- Link 1: Create direct rep → practice links
INSERT INTO rep_practice_links (rep_id, practice_id, assigned_topline_id)
SELECT 
  r.id as rep_id,
  p.id as practice_id,
  r.assigned_topline_id
FROM profiles p
JOIN user_roles ur ON p.id = ur.user_id
JOIN reps r ON p.linked_topline_id = r.user_id
WHERE ur.role = 'doctor'
  AND p.linked_topline_id IS NOT NULL
  AND p.id NOT IN (SELECT user_id FROM providers)
  AND NOT EXISTS (
    SELECT 1 FROM rep_practice_links 
    WHERE practice_id = p.id AND rep_id = r.id
  );

-- Link 2: For downline-managed practices, also link the topline
-- This ensures toplines can see practices managed by their downlines
INSERT INTO rep_practice_links (rep_id, practice_id, assigned_topline_id)
SELECT 
  r.assigned_topline_id as rep_id,
  p.id as practice_id,
  r.assigned_topline_id
FROM profiles p
JOIN user_roles ur ON p.id = ur.user_id
JOIN reps r ON p.linked_topline_id = r.user_id
WHERE ur.role = 'doctor'
  AND p.linked_topline_id IS NOT NULL
  AND p.id NOT IN (SELECT user_id FROM providers)
  AND r.role = 'downline'
  AND r.assigned_topline_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM rep_practice_links 
    WHERE practice_id = p.id AND rep_id = r.assigned_topline_id
  );