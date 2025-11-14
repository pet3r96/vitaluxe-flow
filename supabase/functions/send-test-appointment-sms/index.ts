import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting send-test-appointment-sms function');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    // Parse request body
    const { patientId, message } = await req.json();

    if (!patientId) {
      return new Response(
        JSON.stringify({ error: 'patientId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching patient data for:', patientId);

    // Fetch patient details
    const { data: patient, error: patientError } = await supabase
      .from('patient_accounts')
      .select('id, first_name, last_name, phone, practice_id')
      .eq('id', patientId)
      .single();

    if (patientError || !patient) {
      console.error('Patient not found:', patientError);
      return new Response(
        JSON.stringify({ error: 'Patient not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!patient.phone) {
      console.error('Patient has no phone number');
      return new Response(
        JSON.stringify({ error: 'Patient has no phone number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Patient found:', patient.first_name, patient.last_name);

    // Fetch practice name
    const { data: practice } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', patient.practice_id)
      .single();

    const practiceName = practice?.name || 'VitaLuxe Healthcare';

    // Compose message
    const smsMessage = message || `Reminder: You have an appointment with ${practiceName}. 

For questions or to reschedule, please call 561-886-8226.

Reply STOP to opt out.

- VitaLuxe Healthcare`;

    console.log('Sending SMS to:', patient.phone);

    // Get Twilio credentials
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioMessagingServiceSid = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');

    if (!twilioAccountSid || !twilioAuthToken || !twilioMessagingServiceSid) {
      console.error('Twilio credentials not configured');
      return new Response(
        JSON.stringify({ error: 'SMS service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number for Twilio (ensure E.164 format)
    let formattedPhone = patient.phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('1') && formattedPhone.length === 10) {
      formattedPhone = '1' + formattedPhone;
    }
    formattedPhone = '+' + formattedPhone;

    console.log('Formatted phone:', formattedPhone);

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: formattedPhone,
        MessagingServiceSid: twilioMessagingServiceSid,
        Body: smsMessage,
      }),
    });

    const twilioResult = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error('Twilio error:', twilioResult);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send SMS',
          details: twilioResult 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('SMS sent successfully. SID:', twilioResult.sid);

    // Log the SMS send
    await supabase
      .from('audit_logs')
      .insert({
        action: 'sms_sent',
        entity_type: 'appointment',
        user_id: user.id,
        details: {
          patient_id: patientId,
          phone: formattedPhone,
          message: smsMessage,
          twilio_sid: twilioResult.sid,
          status: twilioResult.status,
        },
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'SMS sent successfully',
        details: {
          to: formattedPhone,
          patient: `${patient.first_name} ${patient.last_name}`,
          sid: twilioResult.sid,
          status: twilioResult.status,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-test-appointment-sms:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
