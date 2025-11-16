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
      console.log('[validate-share-link] Missing token in request');
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[validate-share-link] Validating token:', token.substring(0, 8) + '...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const clientIP = getClientIP(req);
    console.log('[validate-share-link] Client IP:', clientIP);

    // Validate token and get share link data
    const { data: shareLink, error: linkError } = await supabase
      .from('medical_vault_share_links')
      .select(`
        id,
        patient_id,
        expires_at,
        used_at,
        access_count,
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
      console.error('[validate-share-link] Token not found:', linkError);
      return new Response(
        JSON.stringify({ error: 'invalid_token', message: 'Invalid share link' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[validate-share-link] Share link found:', {
      id: shareLink.id,
      token_prefix: token.substring(0, 8),
      used_at: shareLink.used_at,
      access_count: shareLink.access_count || 0,
      expires_at: shareLink.expires_at,
      is_revoked: shareLink.is_revoked
    });

    const currentAccessCount = shareLink.access_count || 0;

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(shareLink.expires_at);
    if (now > expiresAt) {
      console.log('[validate-share-link] Link expired:', { now, expiresAt });
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
      console.log('[validate-share-link] Link has been revoked');
      return new Response(
        JSON.stringify({ error: 'revoked', message: 'This link has been revoked' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all medical data for PDF generation
    const patientAccountId = shareLink.patient_id;
    
    const { data: vaultData } = await supabase
      .from('patient_medical_vault')
      .select('*')
      .eq('patient_id', patientAccountId);

    // Group vault data by record_type
    const vaultRecords = vaultData || [];
    const medications = vaultRecords.filter((r: any) => r.record_type === 'medication');
    const conditions = vaultRecords.filter((r: any) => r.record_type === 'condition');
    const allergies = vaultRecords.filter((r: any) => r.record_type === 'allergy');
    const immunizations = vaultRecords.filter((r: any) => r.record_type === 'immunization');
    const surgeries = vaultRecords.filter((r: any) => r.record_type === 'surgery');
    const vitals = vaultRecords.find((r: any) => r.record_type === 'vital_signs') || null;

    // Increment access count for auditing (unlimited views within 60 minutes)
    const newAccessCount = currentAccessCount + 1;
    console.log('[validate-share-link] Incrementing access count to:', newAccessCount, '(unlimited within 60 min)');
    
    const updateData: any = { 
      access_count: newAccessCount,
      accessed_by_ip: clientIP 
    };
    
    // Mark as used_at on first access (for auditing only, does not restrict further access)
    if (newAccessCount === 1) {
      updateData.used_at = new Date().toISOString();
      console.log('[validate-share-link] Marking link as first accessed');
    }
    
    const { error: updateError } = await supabase
      .from('medical_vault_share_links')
      .update(updateData)
      .eq('id', shareLink.id);
    
    if (updateError) {
      console.error('[validate-share-link] Failed to update link:', updateError);
    } else {
      console.log('[validate-share-link] Link updated. Access count:', newAccessCount);
    }

    // Extract patient account from the array
    const patientAccount = Array.isArray(shareLink.patient_accounts) 
      ? shareLink.patient_accounts[0] 
      : shareLink.patient_accounts;

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
        patient_account_id: patientAccountId,
        patient_name: `${patientAccount.first_name} ${patientAccount.last_name}`,
        ip_address: clientIP,
        access_count: newAccessCount,
        accessed_at: new Date().toISOString()
      }
    });

    console.log('[validate-share-link] Successfully validated. Access count:', newAccessCount);

    // Return data for PDF generation on frontend
    return new Response(
      JSON.stringify({
        success: true,
        patient: {
          first_name: patientAccount.first_name,
          last_name: patientAccount.last_name,
          date_of_birth: patientAccount.date_of_birth
        },
        medications,
        conditions,
        allergies,
        vitals,
        immunizations,
        surgeries
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
