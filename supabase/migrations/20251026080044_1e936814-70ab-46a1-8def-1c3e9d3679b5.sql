-- Clean up duplicate invoices first
DELETE FROM practice_development_fee_invoices 
WHERE id IN (
  '3465dc5e-213b-4b29-ae3d-626a205cc784',
  '6baa57be-52be-4348-829c-896fd0a50b72',
  'b2f42a0f-3e5b-4ba7-9c5e-8e1262b78e81'
);

-- Now add unique constraint to prevent future duplicates
ALTER TABLE practice_development_fee_invoices
ADD CONSTRAINT unique_rep_billing_month 
UNIQUE (topline_rep_id, billing_month);