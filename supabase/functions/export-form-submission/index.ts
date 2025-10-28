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

    const { submissionId } = await req.json();

    if (!submissionId) {
      return new Response(
        JSON.stringify({ error: 'submissionId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get submission with form details and patient info
    const { data: submission, error: subError } = await supabaseAdmin
      .from('patient_form_submissions')
      .select(`
        *,
        form:practice_forms(form_name, form_schema),
        patient:patients(first_name, last_name),
        patient_account:patient_accounts(full_name, email)
      `)
      .eq('id', submissionId)
      .single();

    if (subError || !submission) {
      return new Response(
        JSON.stringify({ error: 'Submission not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate simple HTML for PDF conversion (can be enhanced with jsPDF or other libraries)
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Form Submission - ${submission.form.form_name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          h1 { color: #333; }
          .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
          .field { margin-bottom: 15px; }
          .field-label { font-weight: bold; color: #666; }
          .field-value { margin-left: 20px; }
          .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #ccc; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${submission.form.form_name}</h1>
          <p><strong>Patient:</strong> ${submission.patient_account?.full_name || `${submission.patient.first_name} ${submission.patient.last_name}`}</p>
          <p><strong>Submitted:</strong> ${new Date(submission.completed_at || submission.created_at).toLocaleDateString()}</p>
          <p><strong>Status:</strong> ${submission.status}</p>
        </div>
        
        <div class="content">
          <h2>Form Data:</h2>
          ${Object.entries(submission.form_data || {}).map(([key, value]) => `
            <div class="field">
              <div class="field-label">${key}:</div>
              <div class="field-value">${JSON.stringify(value)}</div>
            </div>
          `).join('')}
        </div>
        
        ${submission.notes ? `
          <div style="margin-top: 30px;">
            <h3>Notes:</h3>
            <p>${submission.notes}</p>
          </div>
        ` : ''}
        
        ${submission.signed_at ? `
          <div style="margin-top: 30px;">
            <p><strong>Signed at:</strong> ${new Date(submission.signed_at).toLocaleString()}</p>
          </div>
        ` : ''}
        
        <div class="footer">
          <p>Generated on ${new Date().toLocaleString()}</p>
          <p>VitaLuxe Practice Management System</p>
        </div>
      </body>
      </html>
    `;

    // Return HTML (frontend can use libraries like html2pdf or print to convert to PDF)
    return new Response(
      JSON.stringify({ 
        success: true, 
        html,
        submission: {
          id: submission.id,
          form_name: submission.form.form_name,
          patient_name: submission.patient_account?.full_name,
          status: submission.status,
          completed_at: submission.completed_at,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in export-form-submission:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});