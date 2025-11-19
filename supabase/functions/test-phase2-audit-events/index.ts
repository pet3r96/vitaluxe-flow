import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * PHASE 2 AUDIT EVENT TEST SUITE
 * Generates all 10 required Phase 2 audit event types for verification
 * 
 * Required Events:
 * 1. login_failed
 * 2. sms_sent
 * 3. sms_verified
 * 4. password_reset
 * 5. password_changed
 * 6. role_changed
 * 7. order_status_changed
 * 8. pharmacy_order_routed
 * 9. video_session_created
 * 10. cross_tenant_access_attempt
 */

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createAdminClient();
    const results: Record<string, any> = {};
    const testUserId = '00000000-0000-0000-0000-000000000001'; // Test UUID
    const testEmail = 'test-phase2@vitaluxe.test';

    edgeLogger.info('[TestPhase2] Starting audit event generation test suite');

    // EVENT 1: login_failed
    try {
      const { error: loginFailedError } = await supabaseAdmin
        .from('audit_logs')
        .insert({
          action_type: 'login_failed',
          entity_type: 'auth',
          user_email: testEmail,
          details: {
            reason: 'Invalid credentials - Phase 2 test',
            ip_address: '127.0.0.1',
            timestamp: new Date().toISOString(),
            test_event: true
          }
        });

      results.login_failed = loginFailedError ? { success: false, error: loginFailedError } : { success: true };
      edgeLogger.info('[TestPhase2] Generated login_failed event');
    } catch (e: any) {
      results.login_failed = { success: false, error: e.message };
    }

    // EVENT 2: sms_sent
    try {
      const { error: smsSentError } = await supabaseAdmin
        .from('audit_logs')
        .insert({
          action_type: 'sms_sent',
          entity_type: 'notification',
          user_email: testEmail,
          details: {
            phone: '+15555551234',
            message_type: '2FA verification - Phase 2 test',
            timestamp: new Date().toISOString(),
            test_event: true
          }
        });

      results.sms_sent = smsSentError ? { success: false, error: smsSentError } : { success: true };
      edgeLogger.info('[TestPhase2] Generated sms_sent event');
    } catch (e: any) {
      results.sms_sent = { success: false, error: e.message };
    }

    // EVENT 3: sms_verified
    try {
      const { error: smsVerifiedError } = await supabaseAdmin
        .from('audit_logs')
        .insert({
          action_type: 'sms_verified',
          entity_type: 'auth',
          user_email: testEmail,
          details: {
            phone: '+15555551234',
            verification_method: '2FA code - Phase 2 test',
            timestamp: new Date().toISOString(),
            test_event: true
          }
        });

      results.sms_verified = smsVerifiedError ? { success: false, error: smsVerifiedError } : { success: true };
      edgeLogger.info('[TestPhase2] Generated sms_verified event');
    } catch (e: any) {
      results.sms_verified = { success: false, error: e.message };
    }

    // EVENT 4: password_reset
    try {
      const { error: passwordResetError } = await supabaseAdmin
        .from('audit_logs')
        .insert({
          action_type: 'password_reset',
          entity_type: 'auth',
          user_email: testEmail,
          details: {
            reset_method: 'Email token - Phase 2 test',
            timestamp: new Date().toISOString(),
            test_event: true
          }
        });

      results.password_reset = passwordResetError ? { success: false, error: passwordResetError } : { success: true };
      edgeLogger.info('[TestPhase2] Generated password_reset event');
    } catch (e: any) {
      results.password_reset = { success: false, error: e.message };
    }

    // EVENT 5: password_changed
    try {
      const { error: passwordChangedError } = await supabaseAdmin
        .from('audit_logs')
        .insert({
          action_type: 'password_changed',
          entity_type: 'auth',
          user_email: testEmail,
          details: {
            change_method: 'Reset token - Phase 2 test',
            timestamp: new Date().toISOString(),
            test_event: true
          }
        });

      results.password_changed = passwordChangedError ? { success: false, error: passwordChangedError } : { success: true };
      edgeLogger.info('[TestPhase2] Generated password_changed event');
    } catch (e: any) {
      results.password_changed = { success: false, error: e.message };
    }

    // EVENT 6: role_changed
    try {
      const { error: roleChangedError } = await supabaseAdmin
        .from('audit_logs')
        .insert({
          action_type: 'role_changed',
          entity_type: 'user_roles',
          user_email: testEmail,
          details: {
            old_role: 'doctor',
            new_role: 'admin',
            changed_by: 'test-admin',
            reason: 'Phase 2 test',
            timestamp: new Date().toISOString(),
            test_event: true
          }
        });

      results.role_changed = roleChangedError ? { success: false, error: roleChangedError } : { success: true };
      edgeLogger.info('[TestPhase2] Generated role_changed event');
    } catch (e: any) {
      results.role_changed = { success: false, error: e.message };
    }

    // EVENT 7: order_status_changed
    try {
      const { error: orderStatusError } = await supabaseAdmin
        .from('audit_logs')
        .insert({
          action_type: 'order_status_changed',
          entity_type: 'orders',
          entity_id: testUserId,
          user_email: testEmail,
          details: {
            old_status: 'pending',
            new_status: 'processing',
            changed_by: 'test-admin',
            reason: 'Phase 2 test',
            timestamp: new Date().toISOString(),
            test_event: true
          }
        });

      results.order_status_changed = orderStatusError ? { success: false, error: orderStatusError } : { success: true };
      edgeLogger.info('[TestPhase2] Generated order_status_changed event');
    } catch (e: any) {
      results.order_status_changed = { success: false, error: e.message };
    }

    // EVENT 8: pharmacy_order_routed
    try {
      const { error: pharmacyRoutedError } = await supabaseAdmin
        .from('audit_logs')
        .insert({
          action_type: 'pharmacy_order_routed',
          entity_type: 'orders',
          entity_id: testUserId,
          user_email: testEmail,
          details: {
            pharmacy_id: testUserId,
            order_id: testUserId,
            routing_algorithm: 'priority_map',
            reason: 'Phase 2 test',
            timestamp: new Date().toISOString(),
            test_event: true
          }
        });

      results.pharmacy_order_routed = pharmacyRoutedError ? { success: false, error: pharmacyRoutedError } : { success: true };
      edgeLogger.info('[TestPhase2] Generated pharmacy_order_routed event');
    } catch (e: any) {
      results.pharmacy_order_routed = { success: false, error: e.message };
    }

    // EVENT 9: video_session_created
    try {
      const { error: videoSessionError } = await supabaseAdmin
        .from('audit_logs')
        .insert({
          action_type: 'video_session_created',
          entity_type: 'video_sessions',
          entity_id: testUserId,
          user_email: testEmail,
          details: {
            session_id: testUserId,
            appointment_id: testUserId,
            host_id: testUserId,
            reason: 'Phase 2 test',
            timestamp: new Date().toISOString(),
            test_event: true
          }
        });

      results.video_session_created = videoSessionError ? { success: false, error: videoSessionError } : { success: true };
      edgeLogger.info('[TestPhase2] Generated video_session_created event');
    } catch (e: any) {
      results.video_session_created = { success: false, error: e.message };
    }

    // EVENT 10: cross_tenant_access_attempt
    try {
      const { error: crossTenantError } = await supabaseAdmin
        .from('audit_logs')
        .insert({
          action_type: 'cross_tenant_access_attempt',
          entity_type: 'security',
          user_email: testEmail,
          details: {
            attempted_resource: 'patient_data',
            user_practice_id: testUserId,
            resource_practice_id: '00000000-0000-0000-0000-000000000002',
            blocked: true,
            reason: 'Phase 2 test',
            timestamp: new Date().toISOString(),
            test_event: true
          }
        });

      results.cross_tenant_access_attempt = crossTenantError ? { success: false, error: crossTenantError } : { success: true };
      edgeLogger.info('[TestPhase2] Generated cross_tenant_access_attempt event');
    } catch (e: any) {
      results.cross_tenant_access_attempt = { success: false, error: e.message };
    }

    // Summary
    const successCount = Object.values(results).filter((r: any) => r.success).length;
    const totalEvents = 10;

    edgeLogger.info('[TestPhase2] Test suite complete', {
      success_count: successCount,
      total_events: totalEvents,
      pass_rate: `${(successCount / totalEvents * 100).toFixed(1)}%`
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Generated ${successCount}/${totalEvents} Phase 2 audit events`,
        results,
        summary: {
          total_events: totalEvents,
          successful: successCount,
          failed: totalEvents - successCount,
          pass_rate: `${(successCount / totalEvents * 100).toFixed(1)}%`
        },
        verification_query: `
          SELECT action_type, COUNT(*) as count
          FROM audit_logs
          WHERE created_at > NOW() - INTERVAL '24 hours'
            AND details->>'test_event' = 'true'
          GROUP BY action_type
          ORDER BY action_type
        `
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    edgeLogger.error('[TestPhase2] Test suite failed', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Test suite execution failed' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
};

serve(handler);
