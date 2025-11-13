import { createAuthClient } from '../_shared/supabaseAdmin.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { bulkAppointmentsSchema, validateInput } from '../_shared/zodSchemas.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createAuthClient(req.headers.get('Authorization'));

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Validate input with Zod schema
    const body = await req.json();
    const validation = validateInput(bulkAppointmentsSchema, body);
    
    if (!validation.success) {
      throw new Error(`Invalid input: ${validation.errors.join(', ')}`);
    }

    const { appointments } = validation.data;

    // Add created_by to all appointments
    const appointmentsWithCreator = appointments.map(appt => ({
      ...appt,
      created_by: user.id,
      status: appt.status || 'scheduled'
    }));

    // Bulk insert
    const { data: created, error: insertError } = await supabaseClient
      .from('patient_appointments')
      .insert(appointmentsWithCreator)
      .select();

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        appointments: created,
        count: created?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Create bulk appointments error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
