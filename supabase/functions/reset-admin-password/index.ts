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
    console.log('Admin password reset requested');

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

    // Hardcoded admin email for security
    const ADMIN_EMAIL = 'info@vitaluxeservices.com';
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

    console.log(`Password reset initiated for: ${ADMIN_EMAIL}`);

    // Update password in auth.users
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      profile.id,
      { password: TEMP_PASSWORD }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw updateError;
    }

    // Set must_change_password flag
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

    // Log the password reset action
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        user_id: profile.id,
        user_email: ADMIN_EMAIL,
        user_role: 'admin',
        action_type: 'admin_password_reset',
        entity_type: 'user',
        entity_id: profile.id,
        details: {
          message: 'Admin password reset to temporary value',
          timestamp: new Date().toISOString(),
          ip_address: req.headers.get('x-forwarded-for') || 'unknown'
        }
      });

    console.log(`Password reset successful for: ${ADMIN_EMAIL}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Password reset successful',
        email: ADMIN_EMAIL,
        temporary_password: TEMP_PASSWORD,
        note: 'Login with this password. You will be required to change it immediately. DELETE THIS FUNCTION AFTER USE.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in reset-admin-password function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
