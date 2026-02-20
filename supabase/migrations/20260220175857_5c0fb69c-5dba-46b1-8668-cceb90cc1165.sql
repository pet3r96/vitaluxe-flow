ALTER TABLE performance_metrics
  DROP CONSTRAINT performance_metrics_user_id_fkey,
  ADD CONSTRAINT performance_metrics_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;