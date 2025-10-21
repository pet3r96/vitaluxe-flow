-- Clear must_change_password flag for admin account
UPDATE user_password_status
SET 
  must_change_password = false,
  temporary_password_sent = false,
  updated_at = now()
WHERE user_id = '28807c7e-5296-4860-b3a1-93c883dff39d';

-- Add comment for audit trail
COMMENT ON TABLE user_password_status IS 'Tracks password status flags. must_change_password cleared for admin@vitaluxeservice.com on 2025-10-21 for production deployment';