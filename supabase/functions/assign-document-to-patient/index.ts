import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve effectivePracticeId (same pattern as generate-branding-preview-pdf)
    let effectivePracticeId = user.id;

    const { data: impersonation } = await supabaseAdmin
      .from('active_impersonation_sessions')
      .select('impersonated_user_id')
      .eq('admin_user_id', user.id)
      .maybeSingle();

    if (impersonation?.impersonated_user_id) {
      effectivePracticeId = impersonation.impersonated_user_id;
      console.log(`Using impersonated practice: ${effectivePracticeId}`);
    }

    const { documentId, patientId, message } = await req.json();

    if (!documentId || !patientId) {
      return new Response(
        JSON.stringify({ error: 'documentId and patientId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify document belongs to this practice
    const { data: docCheck } = await supabaseAdmin
      .from('provider_documents')
      .select('practice_id')
      .eq('id', documentId)
      .single();

    if (!docCheck || docCheck.practice_id !== effectivePracticeId) {
      return new Response(
        JSON.stringify({ error: 'Document not found or access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify patient belongs to this practice
    const { data: patientCheck } = await supabaseAdmin
      .from('patients')
      .select('practice_id')
      .eq('id', patientId)
      .single();

    if (!patientCheck || patientCheck.practice_id !== effectivePracticeId) {
      return new Response(
        JSON.stringify({ error: 'Patient not found or access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update document with assigned patient
    const { data: document, error: updateError } = await supabaseAdmin
      .from('provider_documents')
      .update({ assigned_patient_id: patientId })
      .eq('id', documentId)
      .select('document_name, practice_id')
      .single();

    if (updateError) {
      console.error('Error assigning document:', updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get patient account for notification
    const { data: patientAccount } = await supabaseAdmin
      .from('patient_accounts')
      .select('user_id, full_name')
      .eq('patient_id', patientId)
      .single();

    // Create notification for patient
    if (patientAccount?.user_id) {
      await supabaseAdmin.from('notifications').insert({
        user_id: patientAccount.user_id,
        title: 'New Document Assigned',
        message: message || `A new document "${document.document_name}" has been assigned to you`,
        type: 'document_assigned',
        related_id: documentId,
      });
    }

    // Create audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action_type: 'document_assigned',
      entity_type: 'provider_document',
      entity_id: documentId,
      details: {
        document_name: document.document_name,
        patient_id: patientId,
        message,
        effective_practice_id: effectivePracticeId,
      },
    });

    console.log(`Document ${documentId} assigned to patient ${patientId} by practice ${effectivePracticeId}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Document assigned successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in assign-document-to-patient:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
