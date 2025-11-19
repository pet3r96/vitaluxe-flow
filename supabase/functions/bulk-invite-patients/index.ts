import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { validateCSRFToken } from '../_shared/csrfValidator.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { RateLimiter, getClientIP } from '../_shared/rateLimiter.ts';
import { validateUserOwnsResource } from '../_shared/idValidator.ts';

interface BulkInviteRequest {
  patientIds: string[];
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const ipAddress = getClientIP(req);
  
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createAdminClient();

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authToken = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authToken);
    if (authError || !user) {
      edgeLogger.logOperation({
        ip_address: ipAddress,
        operation: 'bulk-invite-patients',
        success: false,
        duration_ms: Date.now() - startTime,
        metadata: { error: 'Authentication failed' }
      });
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PHASE 3: Rate limiting (10 requests/hour)
    const limiter = new RateLimiter();
    const { allowed } = await limiter.checkLimit(
      supabaseAdmin,
      user.id,
      'bulk-invite-patients',
      { maxRequests: 10, windowSeconds: 3600 }
    );

    if (!allowed) {
      edgeLogger.info('Rate limit exceeded', { userId: user.id, function: 'bulk-invite-patients' });
      return new Response(
        JSON.stringify({ error: 'Too many bulk invite requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is a practice owner or admin
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['doctor', 'admin']);

    if (!roles || roles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Only practice owners or admins can invite patients' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate CSRF token
    const csrfToken = req.headers.get('x-csrf-token') || undefined;
    const { valid, error: csrfError } = await validateCSRFToken(supabaseAdmin, user.id, csrfToken);
    if (!valid) {
      edgeLogger.error('CSRF validation failed', new Error(csrfError || 'Invalid CSRF token'), { userId: user.id });
      return new Response(
        JSON.stringify({ error: csrfError || 'Invalid CSRF token' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { patientIds }: BulkInviteRequest = await req.json();

    if (!patientIds || !Array.isArray(patientIds) || patientIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'patientIds must be a non-empty array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: max 50 patients per request
    if (patientIds.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Maximum 50 patients can be invited at once' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PHASE 3: ID validation for all patientIds
    for (const patientId of patientIds) {
      const { valid: ownsResource, error: idError } = await validateUserOwnsResource(
        supabaseAdmin,
        user.id,
        'patient',
        patientId
      );

      if (!ownsResource) {
        edgeLogger.error('ID validation failed', undefined, { error: idError, userId: user.id, patientId });
        return new Response(
          JSON.stringify({ error: `Access denied to patient ${patientId}` }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const results = {
      total: patientIds.length,
      successful: 0,
      failed: 0,
      errors: [] as Array<{ patientId: string; error: string }>,
    };

    // Process each patient
    for (const patientId of patientIds) {
      try {
        // Call create-patient-portal-account function
        const createAccountResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/create-patient-portal-account`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ patientId }),
          }
        );

        const createAccountResult = await createAccountResponse.json();

        if (!createAccountResponse.ok) {
          throw new Error(createAccountResult.error || 'Failed to create account');
        }

        // Get patient details for email
        const { data: patient } = await supabaseAdmin
          .from('patient_accounts')
          .select('name, first_name, last_name, email, practice_id')
          .eq('id', patientId)
          .single();

        if (!patient) {
          throw new Error('Patient not found after account creation');
        }

        // Call send-welcome-email function (replaces deprecated send-patient-welcome-email)
        edgeLogger.info('Calling send-welcome-email for patient portal access', { patientId });
        const sendEmailResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-welcome-email`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: createAccountResult.userId,
              email: patient.email,
              name: patient.name,
              role: 'patient',
              token: createAccountResult.token,
              practiceId: patient.practice_id,
            }),
          }
        );

        const sendEmailResult = await sendEmailResponse.json();

        if (!sendEmailResponse.ok) {
          throw new Error(sendEmailResult.error || 'Failed to send email');
        }

        results.successful++;
      } catch (error: any) {
        edgeLogger.error('Failed to invite patient', error, { patientId });
        results.failed++;
        results.errors.push({
          patientId,
          error: error.message || 'Unknown error',
        });
      }
    }

    // Log audit event for bulk operation
    try {
      await supabaseAdmin.rpc('log_audit_event', {
        p_action_type: 'bulk_patient_invitation',
        p_entity_type: 'patients',
        p_entity_id: user.id,
        p_details: {
          total: results.total,
          successful: results.successful,
          failed: results.failed,
          initiated_by: user.id,
        }
      });
    } catch (auditError) {
      edgeLogger.error('Failed to log audit event', auditError instanceof Error ? auditError : new Error(String(auditError)));
    }

    // Log successful operation
    edgeLogger.logOperation({
      user_id: user.id,
      ip_address: ipAddress,
      operation: 'bulk-invite-patients',
      success: true,
      duration_ms: Date.now() - startTime,
      metadata: {
        total: results.total,
        successful: results.successful,
        failed: results.failed
      }
    });

    return new Response(
      JSON.stringify(results),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    edgeLogger.error('Error in bulk-invite-patients function', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to process bulk invitation' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
