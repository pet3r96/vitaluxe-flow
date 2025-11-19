-- Add foreign key constraints required for PostgREST relationship resolution
-- These enable Admin Profit Reports and Rep Payments to query joined data

ALTER TABLE order_profits
  ADD CONSTRAINT order_profits_order_id_fkey 
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE order_profits
  ADD CONSTRAINT order_profits_topline_id_fkey 
    FOREIGN KEY (topline_id) REFERENCES reps(id) ON DELETE CASCADE;

ALTER TABLE order_profits
  ADD CONSTRAINT order_profits_downline_id_fkey 
    FOREIGN KEY (downline_id) REFERENCES reps(id) ON DELETE SET NULL;