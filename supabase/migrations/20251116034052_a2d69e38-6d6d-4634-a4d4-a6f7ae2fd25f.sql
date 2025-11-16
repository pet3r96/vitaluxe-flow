-- Phase 6: Drop all legacy tables not in the consolidated schema
-- This migration safely removes all tables that were migrated into the new consolidated structure

-- IMPORTANT: This only drops tables NOT in the KEEP list
-- All data has been validated and migrated to the new consolidated schema

BEGIN;

-- Drop legacy patient tables (migrated to patient_medical_vault)
DROP TABLE IF EXISTS patient_allergies CASCADE;
DROP TABLE IF EXISTS patient_conditions CASCADE;
DROP TABLE IF EXISTS patient_documents CASCADE;
DROP TABLE IF EXISTS patient_emergency_contacts CASCADE;
DROP TABLE IF EXISTS patient_follow_ups CASCADE;
DROP TABLE IF EXISTS patient_immunizations CASCADE;
DROP TABLE IF EXISTS patient_medications CASCADE;
DROP TABLE IF EXISTS patient_messages CASCADE;
DROP TABLE IF EXISTS patient_notes CASCADE;
DROP TABLE IF EXISTS patient_pharmacies CASCADE;
DROP TABLE IF EXISTS patient_surgeries CASCADE;
DROP TABLE IF EXISTS patient_vitals CASCADE;

-- Drop legacy audit/logging tables (consolidated functionality)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS audit_logs_archive CASCADE;
DROP TABLE IF EXISTS medical_vault_audit_logs CASCADE;
DROP TABLE IF EXISTS notification_logs CASCADE;
DROP TABLE IF EXISTS shipping_audit_logs CASCADE;
DROP TABLE IF EXISTS security_events CASCADE;
DROP TABLE IF EXISTS video_session_audit_log CASCADE;
DROP TABLE IF EXISTS two_fa_audit_log CASCADE;
DROP TABLE IF EXISTS two_fa_reset_logs CASCADE;
DROP TABLE IF EXISTS role_cleanup_log CASCADE;
DROP TABLE IF EXISTS usage_logs CASCADE;
DROP TABLE IF EXISTS sync_logs CASCADE;
DROP TABLE IF EXISTS file_upload_logs CASCADE;

-- Drop legacy messaging tables (replaced by new structure)
DROP TABLE IF EXISTS internal_message_recipients CASCADE;
DROP TABLE IF EXISTS internal_message_replies CASCADE;
DROP TABLE IF EXISTS internal_messages CASCADE;
DROP TABLE IF EXISTS message_thread_read_status CASCADE;
DROP TABLE IF EXISTS message_threads CASCADE;
DROP TABLE IF EXISTS thread_participants CASCADE;
DROP TABLE IF EXISTS video_messages CASCADE;

-- Drop legacy admin/security tables
DROP TABLE IF EXISTS account_lockouts CASCADE;
DROP TABLE IF EXISTS active_impersonation_sessions CASCADE;
DROP TABLE IF EXISTS active_sessions CASCADE;
DROP TABLE IF EXISTS admin_alerts CASCADE;
DROP TABLE IF EXISTS admin_ip_banlist CASCADE;
DROP TABLE IF EXISTS admin_notification_preferences CASCADE;
DROP TABLE IF EXISTS admin_role_audit CASCADE;
DROP TABLE IF EXISTS alert_rules CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS impersonation_logs CASCADE;
DROP TABLE IF EXISTS impersonation_permissions CASCADE;
DROP TABLE IF EXISTS failed_login_attempts CASCADE;

-- Drop legacy order/pharmacy tables
DROP TABLE IF EXISTS amazon_tracking_api_calls CASCADE;
DROP TABLE IF EXISTS easypost_tracking_events CASCADE;
DROP TABLE IF EXISTS order_profits CASCADE;
DROP TABLE IF EXISTS order_refunds CASCADE;
DROP TABLE IF EXISTS order_routing_log CASCADE;
DROP TABLE IF EXISTS order_status_configs CASCADE;
DROP TABLE IF EXISTS pharmacy_rep_assignments CASCADE;
DROP TABLE IF EXISTS pharmacy_shipping_rates CASCADE;

-- Drop legacy product/rep tables
DROP TABLE IF EXISTS product_rep_assignments CASCADE;
DROP TABLE IF EXISTS rep_payment_batches CASCADE;
DROP TABLE IF EXISTS rep_payments CASCADE;
DROP TABLE IF EXISTS rep_practice_links CASCADE;
DROP TABLE IF EXISTS rep_product_price_overrides CASCADE;
DROP TABLE IF EXISTS rep_product_visibility CASCADE;
DROP TABLE IF EXISTS rep_subscription_commissions CASCADE;

-- Drop legacy practice tables
DROP TABLE IF EXISTS practice_automation_settings CASCADE;
DROP TABLE IF EXISTS practice_blocked_time CASCADE;
DROP TABLE IF EXISTS practice_branding CASCADE;
DROP TABLE IF EXISTS practice_calendar_hours CASCADE;
DROP TABLE IF EXISTS practice_development_fee_invoices CASCADE;
DROP TABLE IF EXISTS practice_development_fees CASCADE;
DROP TABLE IF EXISTS practice_metrics_snapshot CASCADE;
DROP TABLE IF EXISTS practice_rooms CASCADE;
DROP TABLE IF EXISTS practice_video_rooms CASCADE;

-- Drop legacy provider tables
DROP TABLE IF EXISTS provider_document_patients CASCADE;
DROP TABLE IF EXISTS provider_documents CASCADE;
DROP TABLE IF EXISTS provider_schedules CASCADE;

-- Drop legacy subscription/payment tables
DROP TABLE IF EXISTS subscription_payments CASCADE;
DROP TABLE IF EXISTS subscription_upgrade_prompts CASCADE;
DROP TABLE IF EXISTS trial_payment_reminders CASCADE;
DROP TABLE IF EXISTS commissions CASCADE;
DROP TABLE IF EXISTS discount_code_usage CASCADE;
DROP TABLE IF EXISTS discount_codes CASCADE;

-- Drop legacy appointment/video tables
DROP TABLE IF EXISTS appointment_service_types CASCADE;
DROP TABLE IF EXISTS appointment_settings CASCADE;
DROP TABLE IF EXISTS calendar_sync_tokens CASCADE;
DROP TABLE IF EXISTS video_session_metrics CASCADE;
DROP TABLE IF EXISTS video_session_participants CASCADE;

-- Drop legacy auth/security tables
DROP TABLE IF EXISTS email_verification_tokens CASCADE;
DROP TABLE IF EXISTS encryption_keys CASCADE;
DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS temp_password_tokens CASCADE;
DROP TABLE IF EXISTS user_password_status CASCADE;
DROP TABLE IF EXISTS sms_codes CASCADE;
DROP TABLE IF EXISTS sms_verification_attempts CASCADE;

-- Drop legacy terms/portal tables
DROP TABLE IF EXISTS patient_portal_terms CASCADE;
DROP TABLE IF EXISTS patient_terms_acceptances CASCADE;
DROP TABLE IF EXISTS user_terms_acceptances CASCADE;

-- Drop legacy misc tables
DROP TABLE IF EXISTS cart_access_log CASCADE;
DROP TABLE IF EXISTS checkout_attestation CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS medical_vault_share_links CASCADE;
DROP TABLE IF EXISTS pending_practices CASCADE;
DROP TABLE IF EXISTS pending_product_requests CASCADE;
DROP TABLE IF EXISTS pending_reps CASCADE;
DROP TABLE IF EXISTS api_rate_limits_config CASCADE;
DROP TABLE IF EXISTS notifications_sent CASCADE;

COMMIT;

-- Verify: List remaining tables
SELECT 'Remaining tables after Phase 6 cleanup:' as status;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;