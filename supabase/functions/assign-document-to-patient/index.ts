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

    const { documentId, patientId, message } = await req.json();

    if (!documentId || !patientId) {
      return new Response(
        JSON.stringify({ error: 'documentId and patientId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      },
    });

    console.log(`Document ${documentId} assigned to patient ${patientId}`);

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