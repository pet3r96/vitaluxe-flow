CREATE UNIQUE INDEX IF NOT EXISTS idx_user_terms_unique 
ON user_terms_acceptances (user_id, terms_id);