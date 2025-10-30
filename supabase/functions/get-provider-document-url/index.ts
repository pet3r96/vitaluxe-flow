import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    console.log('[get-provider-document-url] Invoked');
    
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    
    if (!token) {
      console.error('[get-provider-document-url] Missing authorization token');
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
      console.error('[get-provider-document-url] Authentication failed:', userError);
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[get-provider-document-url] User authenticated:', user.id);

    // Resolve effectivePracticeId
    let effectivePracticeId: string | null = null;

    const { data: impersonationSession, error: impErr } = await supabaseAdmin
      .from('active_impersonation_sessions')
      .select('impersonated_user_id, impersonated_role, expires_at')
      .eq('admin_user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (impErr) {
      console.error('[get-provider-document-url] Impersonation lookup error:', impErr);
    }

    if (impersonationSession?.impersonated_user_id) {
      const role = impersonationSession.impersonated_role;
      const impersonatedId = impersonationSession.impersonated_user_id as string;
      console.log('[get-provider-document-url] Impersonation active:', { role, impersonatedId });

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
      console.error('[get-provider-document-url] No practice context');
      return new Response(
        JSON.stringify({ error: 'No practice context' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[get-provider-document-url] Resolved practice:', effectivePracticeId);

    const { document_id, storage_path } = await req.json();

    let finalStoragePath: string | null = null;

    if (document_id) {
      const { data: document, error: docError } = await supabaseAdmin
        .from('provider_documents')
        .select('storage_path, practice_id')
        .eq('id', document_id)
        .single();

      if (docError || !document) {
        console.error('[get-provider-document-url] Document not found:', docError);
        return new Response(
          JSON.stringify({ error: 'Document not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (document.practice_id !== effectivePracticeId) {
        console.error('[get-provider-document-url] Access denied - wrong practice');
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      finalStoragePath = document.storage_path;
    } else if (storage_path) {
      const expectedPrefix = `${effectivePracticeId}/documents/`;
      if (!storage_path.startsWith(expectedPrefix)) {
        console.error('[get-provider-document-url] Invalid storage path');
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      finalStoragePath = storage_path;
    }

    if (!finalStoragePath) {
      return new Response(
        JSON.stringify({ error: 'Missing document_id or storage_path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[get-provider-document-url] Generating signed URL for:', finalStoragePath);

    const { data: urlData, error: urlError } = await supabaseAdmin.storage
      .from('provider-documents')
      .createSignedUrl(finalStoragePath, 60);

    if (urlError || !urlData) {
      console.error('[get-provider-document-url] Failed to create signed URL:', urlError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate signed URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[get-provider-document-url] Signed URL generated successfully');

    return new Response(
      JSON.stringify({ signedUrl: urlData.signedUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[get-provider-document-url] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
