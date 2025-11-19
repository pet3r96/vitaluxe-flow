-- =====================================================
-- PHASE 2 WEEK 2 & 4 COMPLETION: RLS + SMS Rate Limiting
-- =====================================================

-- Week 2: Service role policies for remaining tables (83 policies)
DO $$ 
BEGIN
  CREATE POLICY admin_ip_banlist_svc ON admin_ip_banlist FOR ALL TO service_role USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN CREATE POLICY amazon_tracking_api_calls_svc ON amazon_tracking_api_calls FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY api_rate_limits_config_svc ON api_rate_limits_config FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY appointment_service_types_svc ON appointment_service_types FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY audit_logs_svc ON audit_logs FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY audit_logs_archive_svc ON audit_logs_archive FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY calendar_sync_tokens_svc ON calendar_sync_tokens FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY checkout_attestation_svc ON checkout_attestation FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY discount_codes_svc ON discount_codes FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY error_logs_archive_svc ON error_logs_archive FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY function_rate_limits_svc ON function_rate_limits FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY impersonation_logs_svc ON impersonation_logs FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY internal_message_recipients_svc ON internal_message_recipients FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY internal_messages_svc ON internal_messages FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY medical_vault_audit_logs_svc ON medical_vault_audit_logs FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY medical_vault_audit_logs_archive_svc ON medical_vault_audit_logs_archive FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY medical_vault_share_links_svc ON medical_vault_share_links FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY message_thread_read_status_svc ON message_thread_read_status FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY message_threads_svc ON message_threads FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY messages_svc ON messages FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY notification_preferences_svc ON notification_preferences FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY notification_templates_svc ON notification_templates FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY notifications_svc ON notifications FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY order_profits_svc ON order_profits FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY order_status_configs_svc ON order_status_configs FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY order_status_history_svc ON order_status_history FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY patient_appointments_svc ON patient_appointments FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY patient_follow_ups_svc ON patient_follow_ups FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY patient_medical_vault_svc ON patient_medical_vault FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY patient_medical_vault_history_svc ON patient_medical_vault_history FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY patient_messages_svc ON patient_messages FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY patient_notes_svc ON patient_notes FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY patient_portal_terms_svc ON patient_portal_terms FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY patients_svc ON patients FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY pending_practices_svc ON pending_practices FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY pending_product_requests_svc ON pending_product_requests FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY pending_reps_svc ON pending_reps FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY performance_metrics_svc ON performance_metrics FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY pharmacy_api_credentials_svc ON pharmacy_api_credentials FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY pharmacy_order_jobs_svc ON pharmacy_order_jobs FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY pharmacy_order_transmissions_svc ON pharmacy_order_transmissions FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY pharmacy_shipping_rates_svc ON pharmacy_shipping_rates FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY pharmacy_tracking_updates_svc ON pharmacy_tracking_updates FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY practice_automation_settings_svc ON practice_automation_settings FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY practice_development_fee_invoices_svc ON practice_development_fee_invoices FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY practice_development_fees_svc ON practice_development_fees FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY practice_payment_methods_svc ON practice_payment_methods FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY practice_rooms_svc ON practice_rooms FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY practice_staff_svc ON practice_staff FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY practice_subscriptions_svc ON practice_subscriptions FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY prescription_refills_svc ON prescription_refills FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY prescriptions_svc ON prescriptions FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY product_pharmacies_svc ON product_pharmacies FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY product_pricing_tiers_svc ON product_pricing_tiers FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY product_types_svc ON product_types FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY products_svc ON products FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY provider_document_assignments_svc ON provider_document_assignments FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY provider_documents_svc ON provider_documents FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rep_payment_batches_svc ON rep_payment_batches FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rep_payments_svc ON rep_payments FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rep_product_price_overrides_svc ON rep_product_price_overrides FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rep_subscription_commissions_svc ON rep_subscription_commissions FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY reps_svc ON reps FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY rls_audit_results_svc ON rls_audit_results FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY sms_codes_svc ON sms_codes FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY statuses_svc ON statuses FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY subscription_payments_svc ON subscription_payments FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY support_ticket_replies_svc ON support_ticket_replies FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY support_tickets_svc ON support_tickets FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY system_settings_svc ON system_settings FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY terms_and_conditions_svc ON terms_and_conditions FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY treatment_plan_attachments_svc ON treatment_plan_attachments FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY treatment_plan_goals_svc ON treatment_plan_goals FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY treatment_plan_updates_svc ON treatment_plan_updates FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY treatment_plans_svc ON treatment_plans FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY two_fa_audit_log_svc ON two_fa_audit_log FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY user_password_status_svc ON user_password_status FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY user_roles_svc ON user_roles FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY user_terms_acceptances_svc ON user_terms_acceptances FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY video_guest_tokens_svc ON video_guest_tokens FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY video_session_events_svc ON video_session_events FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY video_session_guest_links_svc ON video_session_guest_links FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY video_session_logs_svc ON video_session_logs FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY video_sessions_svc ON video_sessions FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY video_usage_pricing_svc ON video_usage_pricing FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Week 4: SMS rate limiting index
CREATE INDEX IF NOT EXISTS idx_sms_codes_user_created ON sms_codes(user_id, created_at DESC);