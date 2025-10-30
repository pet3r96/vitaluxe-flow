import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    console.log('[list-provider-documents] Invoked');
    
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    
    if (!token) {
      console.error('[list-provider-documents] Missing authorization token');
      return new Response(JSON.stringify({ error: 'Missing authorization token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      console.error('[list-provider-documents] Authentication failed:', userError);
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[list-provider-documents] User authenticated:', user.id);

    // Resolve effectivePracticeId (same logic as create-provider-document)
    let effectivePracticeId: string | null = null;

    const { data: impersonationSession, error: impErr } = await supabaseAdmin
      .from('active_impersonation_sessions')
      .select('impersonated_user_id, impersonated_role, expires_at')
      .eq('admin_user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (impErr) {
      console.error('[list-provider-documents] Impersonation lookup error:', impErr);
    }

    if (impersonationSession?.impersonated_user_id) {
      const role = impersonationSession.impersonated_role;
      const impersonatedId = impersonationSession.impersonated_user_id as string;
      console.log('[list-provider-documents] Impersonation active:', { role, impersonatedId });

      if (role === 'patient') {
        const { data: patientAccount } = await supabaseAdmin
          .from('patient_accounts')
          .select('practice_id')
          .eq('user_id', impersonatedId)
          .maybeSingle();
        effectivePracticeId = patientAccount?.practice_id ?? null;
      } else if (role === 'staff') {
        const { data: staffRecord } = await supabaseAdmin
          .from('practice_staff')
          .select('practice_id')
          .eq('user_id', impersonatedId)
          .maybeSingle();
        effectivePracticeId = staffRecord?.practice_id ?? impersonatedId;
      } else if (role === 'provider') {
        const { data: providerRecord } = await supabaseAdmin
          .from('providers')
          .select('practice_id')
          .eq('user_id', impersonatedId)
          .maybeSingle();
        effectivePracticeId = providerRecord?.practice_id ?? impersonatedId;
      } else {
        effectivePracticeId = impersonatedId;
      }
    }

    if (!effectivePracticeId) {
      const { data: doctorRole } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'doctor')
        .maybeSingle();

      if (doctorRole) {
        effectivePracticeId = user.id;
      } else {
        const { data: providerRow } = await supabaseAdmin
          .from('providers')
          .select('practice_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (providerRow?.practice_id) {
          effectivePracticeId = providerRow.practice_id as string;
        } else {
          const { data: staffRow } = await supabaseAdmin
            .from('practice_staff')
            .select('practice_id')
            .eq('user_id', user.id)
            .maybeSingle();
          if (staffRow?.practice_id) {
            effectivePracticeId = staffRow.practice_id as string;
          }
        }
      }
    }

    if (!effectivePracticeId) {
      console.error('[list-provider-documents] No practice context');
      return new Response(
        JSON.stringify({ error: 'No practice context' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[list-provider-documents] Resolved practice:', effectivePracticeId);

    const { filters = {}, pagination = { limit: 50, offset: 0 } } = await req.json();

    let query = supabaseAdmin
      .from('provider_documents')
      .select('*', { count: 'exact' })
      .eq('practice_id', effectivePracticeId)
      .order('created_at', { ascending: false });

    if (filters.patientId) query = query.eq('assigned_patient_id', filters.patientId);
    if (filters.documentType) query = query.eq('document_type', filters.documentType);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
    if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
    if (filters.uploadedBy) query = query.eq('uploaded_by', filters.uploadedBy);
    if (filters.isInternal) query = query.eq('is_internal', filters.isInternal === 'true');
    if (filters.assignedStaffId) query = query.eq('assigned_staff_id', filters.assignedStaffId);

    query = query.range(pagination.offset, pagination.offset + pagination.limit - 1);

    const { data: documents, error: queryError, count } = await query;

    if (queryError) {
      console.error('[list-provider-documents] Query error:', queryError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch documents' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[list-provider-documents] Found', documents?.length, 'documents');

    return new Response(
      JSON.stringify({ documents: documents || [], total: count || 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[list-provider-documents] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
