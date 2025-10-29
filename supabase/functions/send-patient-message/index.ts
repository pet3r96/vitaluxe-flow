import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { subject, message } = await req.json();

    if (!message?.trim()) throw new Error('Message body is required');

    // Get patient account to find their practice_id and patient_id
    const { data: patientAccount, error: patientError } = await supabaseClient
      .from('patient_accounts')
      .select('id, practice_id')
      .eq('user_id', user.id)
      .single();

    if (patientError || !patientAccount) {
      throw new Error('Patient account not found');
    }

    if (!patientAccount.practice_id) {
      throw new Error('No practice assigned to your account');
    }

    const { error } = await supabaseClient
      .from('patient_messages')
      .insert({
        patient_id: patientAccount.id,
        practice_id: patientAccount.practice_id,
        sender_id: user.id,
        sender_type: 'patient',
        message_body: message,
        subject: subject || 'Patient Message',
        read_at: null
      });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
