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
    console.log('Emergency password reset requested');

    // Verify emergency secret
    const emergencySecret = req.headers.get('x-emergency-secret');
    const expectedSecret = Deno.env.get('EMERGENCY_RESET_SECRET');

    if (!expectedSecret || emergencySecret !== expectedSecret) {
      console.error('Unauthorized emergency reset attempt');
      
      // Log failed attempt
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
        
        await supabaseAdmin
          .from('security_events')
          .insert({
            event_type: 'unauthorized_emergency_reset_attempt',
            ip_address: req.headers.get('x-forwarded-for') || 'unknown',
            details: {
              timestamp: new Date().toISOString(),
              user_agent: req.headers.get('user-agent')
            }
          });
      } catch (logError) {
        console.error('Error logging unauthorized attempt:', logError);
      }
      
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Hardcoded admin email for security (emergency lookup only)
    const ADMIN_EMAIL = 'admin@vitaluxeservices.com';
    const TEMP_PASSWORD = 'TempAdmin2025!';

    // Get admin user from profiles table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', ADMIN_EMAIL)
      .single();
    
    if (profileError || !profile) {
      console.error('Admin profile not found:', profileError);
      throw new Error('Admin account not found');
    }

    console.log(`Emergency password reset initiated for: ${ADMIN_EMAIL}`);

    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      profile.id,
      { password: TEMP_PASSWORD }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw updateError;
    }

    // Set must_change_password flag
    try {
      const { error: flagError } = await supabaseAdmin
        .from('user_password_status')
        .upsert({
          user_id: profile.id,
          must_change_password: true,
          temporary_password_sent: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (flagError) {
        console.error('Error setting must_change_password flag:', flagError);
      }
    } catch (flagException) {
      console.error('Exception setting password flag:', flagException);
    }

    // Log the emergency reset action
    try {
      await supabaseAdmin
        .from('audit_logs')
        .insert({
          user_id: profile.id,
          user_email: ADMIN_EMAIL,
          user_role: 'admin',
          action_type: 'emergency_password_reset',
          entity_type: 'user',
          entity_id: profile.id,
          details: {
            message: 'Emergency password reset performed',
            timestamp: new Date().toISOString()
          }
        });
    } catch (logError) {
      console.error('Error logging emergency reset:', logError);
    }

    console.log(`Emergency password reset successful for: ${ADMIN_EMAIL}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Emergency password reset successful',
        email: ADMIN_EMAIL,
        temporary_password: TEMP_PASSWORD,
        note: 'You will be required to change this password on first login. DELETE THIS FUNCTION IMMEDIATELY AFTER USE.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in emergency-admin-reset function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error),
        note: 'This is a security-protected endpoint'
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
