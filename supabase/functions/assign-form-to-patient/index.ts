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

    const { formId, patientIds, dueDate, customInstructions } = await req.json();

    if (!formId || !patientIds || !Array.isArray(patientIds) || patientIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'formId and patientIds array are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get form details
    const { data: form, error: formError } = await supabaseAdmin
      .from('practice_forms')
      .select('form_name, practice_id')
      .eq('id', formId)
      .single();

    if (formError || !form) {
      return new Response(
        JSON.stringify({ error: 'Form not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const submissionIds: string[] = [];

    // Create form submissions for each patient
    for (const patientId of patientIds) {
      // Get patient details
      const { data: patient } = await supabaseAdmin
        .from('patients')
        .select('id')
        .eq('id', patientId)
        .single();

      if (!patient) {
        console.warn(`Patient ${patientId} not found, skipping`);
        continue;
      }

      // Get patient account
      const { data: patientAccount } = await supabaseAdmin
        .from('patient_accounts')
        .select('id, user_id, full_name')
        .eq('patient_id', patientId)
        .single();

      // Create submission
      const { data: submission, error: subError } = await supabaseAdmin
        .from('patient_form_submissions')
        .insert({
          form_id: formId,
          patient_id: patientId,
          patient_account_id: patientAccount?.id,
          practice_id: form.practice_id,
          assigned_by: user.id,
          due_date: dueDate || null,
          notes: customInstructions || null,
        })
        .select('id')
        .single();

      if (subError) {
        console.error(`Error creating submission for patient ${patientId}:`, subError);
        continue;
      }

      submissionIds.push(submission.id);

      // Create notification for patient
      if (patientAccount?.user_id) {
        await supabaseAdmin.from('notifications').insert({
          user_id: patientAccount.user_id,
          title: 'New Form Assigned',
          message: customInstructions || `You have been assigned the form "${form.form_name}"`,
          type: 'form_assigned',
          related_id: submission.id,
        });
      }
    }

    // Create audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action_type: 'forms_assigned',
      entity_type: 'patient_form_submission',
      entity_id: formId,
      details: {
        form_name: form.form_name,
        patient_count: submissionIds.length,
        due_date: dueDate,
      },
    });

    console.log(`Form ${formId} assigned to ${submissionIds.length} patients`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Form assigned to ${submissionIds.length} patient(s)`,
        submissionIds,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in assign-form-to-patient:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});