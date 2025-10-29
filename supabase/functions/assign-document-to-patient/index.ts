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

    const { documentId, patientIds, message } = await req.json();

    console.log('Assign document request:', { documentId, patientIds, message, effectivePracticeId });

    if (!documentId || !patientIds || !Array.isArray(patientIds) || patientIds.length === 0) {
      console.error('Invalid request parameters:', { documentId, patientIds });
      return new Response(
        JSON.stringify({ error: 'documentId and patientIds (array) are required' }),
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
      console.error('Document access denied:', { docCheck, effectivePracticeId });
      return new Response(
        JSON.stringify({ error: 'Document not found or access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify all patients belong to this practice
    const { data: patientsCheck } = await supabaseAdmin
      .from('patients')
      .select('id, practice_id')
      .in('id', patientIds);

    if (!patientsCheck || patientsCheck.length !== patientIds.length) {
      console.error('Patient verification failed:', { 
        requested: patientIds.length, 
        found: patientsCheck?.length,
        patientIds 
      });
      return new Response(
        JSON.stringify({ error: 'One or more patients not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const invalidPatients = patientsCheck.filter(p => p.practice_id !== effectivePracticeId);
    if (invalidPatients.length > 0) {
      console.error('Invalid patients for practice:', { invalidPatients, effectivePracticeId });
      return new Response(
        JSON.stringify({ error: 'Access denied to one or more patients' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get document info
    const { data: document } = await supabaseAdmin
      .from('provider_documents')
      .select('document_name, practice_id')
      .eq('id', documentId)
      .single();

    // Insert assignments into junction table
    const assignments = patientIds.map(patientId => ({
      document_id: documentId,
      patient_id: patientId,
      assigned_by: user.id,
      message,
    }));

    const { error: assignError } = await supabaseAdmin
      .from('provider_document_patients')
      .insert(assignments);

    if (assignError) {
      console.error('Error assigning document:', assignError);
      return new Response(
        JSON.stringify({ error: assignError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get patient accounts for notifications
    const { data: patientAccounts } = await supabaseAdmin
      .from('patient_accounts')
      .select('user_id, full_name, patient_id')
      .in('patient_id', patientIds);

    // Create notifications for each patient
    if (patientAccounts && patientAccounts.length > 0) {
      const notifications = patientAccounts.map(account => ({
        user_id: account.user_id,
        title: 'New Document Assigned',
        message: message || `A new document "${document?.document_name}" has been assigned to you`,
        type: 'document_assigned',
        related_id: documentId,
      }));

      await supabaseAdmin.from('notifications').insert(notifications);
    }

    // Create audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action_type: 'document_assigned',
      entity_type: 'provider_document',
      entity_id: documentId,
      details: {
        document_name: document?.document_name,
        patient_ids: patientIds,
        patient_count: patientIds.length,
        message,
        effective_practice_id: effectivePracticeId,
      },
    });

    console.log(`Document ${documentId} assigned to ${patientIds.length} patients by practice ${effectivePracticeId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Document assigned to ${patientIds.length} patient${patientIds.length === 1 ? '' : 's'} successfully` 
      }),
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
