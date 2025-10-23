-- Backfill missing rep_practice_links for all active doctor practices
-- This will fix the count discrepancy by creating links that should exist
INSERT INTO rep_practice_links (rep_id, practice_id, created_at)
SELECT r.id, p.id, now()
FROM profiles p
JOIN user_roles ur ON ur.user_id = p.id AND ur.role = 'doctor'
JOIN reps r ON r.user_id = p.linked_topline_id AND r.active = true
WHERE p.active = true
  AND p.linked_topline_id IS NOT NULL
ON CONFLICT (rep_id, practice_id) DO NOTHING;