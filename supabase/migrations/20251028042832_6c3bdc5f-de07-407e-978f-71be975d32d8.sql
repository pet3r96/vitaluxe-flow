-- Add system setting to control 2FA enforcement globally
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES (
  'two_fa_enforcement_enabled',
  'false',
  'Enable or disable 2FA enforcement system-wide. When disabled, users will not be prompted for 2FA setup or verification.'
)
ON CONFLICT (setting_key) DO NOTHING;