import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';
import { getClientIP } from '../_shared/rateLimiter.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const clientIP = getClientIP(req);

    // Validate token and get share link data
    const { data: shareLink, error: linkError } = await supabase
      .from('medical_vault_share_links')
      .select(`
        id,
        patient_id,
        expires_at,
        used_at,
        is_revoked,
        patient_accounts!inner(
          id,
          first_name,
          last_name,
          date_of_birth,
          user_id
        )
      `)
      .eq('token', token)
      .single();

    if (linkError || !shareLink) {
      console.error('Token not found:', linkError);
      return new Response(
        JSON.stringify({ error: 'invalid_token', message: 'Invalid share link' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already used
    if (shareLink.used_at) {
      await supabase.from('audit_logs').insert({
        user_id: null,
        user_email: 'public',
        user_role: 'public',
        action_type: 'medical_vault_share_link_already_used',
        entity_type: 'medical_vault_share_links',
        entity_id: shareLink.id,
        details: { token, ip_address: clientIP, attempted_at: new Date().toISOString() }
      });

      return new Response(
        JSON.stringify({ error: 'already_used', message: 'This link has already been used' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(shareLink.expires_at);
    if (now > expiresAt) {
      await supabase.from('audit_logs').insert({
        user_id: null,
        user_email: 'public',
        user_role: 'public',
        action_type: 'medical_vault_share_link_expired',
        entity_type: 'medical_vault_share_links',
        entity_id: shareLink.id,
        details: { token, ip_address: clientIP, expired_at: shareLink.expires_at }
      });

      return new Response(
        JSON.stringify({ error: 'expired', message: 'This link has expired after 60 minutes' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if revoked
    if (shareLink.is_revoked) {
      return new Response(
        JSON.stringify({ error: 'revoked', message: 'This link has been revoked' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all medical data for PDF generation
    const patientId = shareLink.patient_id;
    
    const [
      { data: medications },
      { data: conditions },
      { data: allergies },
      { data: vitals },
      { data: immunizations },
      { data: surgeries },
      { data: pharmacies },
      { data: emergencyContacts }
    ] = await Promise.all([
      supabase.from('patient_medications').select('*').eq('patient_id', patientId),
      supabase.from('patient_conditions').select('*').eq('patient_id', patientId),
      supabase.from('patient_allergies').select('*').eq('patient_id', patientId),
      supabase.from('patient_vitals').select('*').eq('patient_id', patientId).order('recorded_date', { ascending: false }).limit(1),
      supabase.from('patient_immunizations').select('*').eq('patient_id', patientId),
      supabase.from('patient_surgeries').select('*').eq('patient_id', patientId),
      supabase.from('patient_pharmacies').select('*').eq('patient_id', patientId),
      supabase.from('patient_emergency_contacts').select('*').eq('patient_id', patientId)
    ]);

    // Mark as used IMMEDIATELY before returning data
    await supabase
      .from('medical_vault_share_links')
      .update({ used_at: new Date().toISOString(), accessed_by_ip: clientIP })
      .eq('id', shareLink.id);

    // Log successful access
    await supabase.from('audit_logs').insert({
      user_id: null,
      user_email: 'public',
      user_role: 'public',
      action_type: 'medical_vault_share_link_accessed',
      entity_type: 'medical_vault_share_links',
      entity_id: shareLink.id,
      details: {
        token,
        patient_id: patientId,
        patient_name: `${shareLink.patient_accounts.first_name} ${shareLink.patient_accounts.last_name}`,
        ip_address: clientIP,
        accessed_at: new Date().toISOString()
      }
    });

    // Return data for PDF generation on frontend
    return new Response(
      JSON.stringify({
        success: true,
        patient: {
          first_name: shareLink.patient_accounts.first_name,
          last_name: shareLink.patient_accounts.last_name,
          date_of_birth: shareLink.patient_accounts.date_of_birth
        },
        medications: medications || [],
        conditions: conditions || [],
        allergies: allergies || [],
        vitals: vitals?.[0] || null,
        immunizations: immunizations || [],
        surgeries: surgeries || [],
        pharmacies: pharmacies || [],
        emergencyContacts: emergencyContacts || []
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error validating share link:', error);
    return new Response(
      JSON.stringify({ error: 'internal_error', message: 'An error occurred processing this link' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
