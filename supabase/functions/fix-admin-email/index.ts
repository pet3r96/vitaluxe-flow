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
    console.log('Fixing admin email from admin@vitaluxeservice.com to admin@vitaluxeservices.com');

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

    const ADMIN_USER_ID = '28807c7e-5296-4860-b3a1-93c883dff39d';
    const OLD_EMAIL = 'admin@vitaluxeservice.com';
    const NEW_EMAIL = 'admin@vitaluxeservices.com';

    // Update email in auth.users using admin API
    const { data: userData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      ADMIN_USER_ID,
      { email: NEW_EMAIL }
    );

    if (updateError) {
      console.error('Error updating auth email:', updateError);
      throw updateError;
    }

    console.log('Auth email updated successfully');

    // Update email in profiles table
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        email: NEW_EMAIL,
        updated_at: new Date().toISOString()
      })
      .eq('id', ADMIN_USER_ID)
      .eq('email', OLD_EMAIL);

    if (profileError) {
      console.error('Error updating profile email:', profileError);
      throw profileError;
    }

    console.log('Profile email updated successfully');

    // Log the change
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        user_id: ADMIN_USER_ID,
        user_email: NEW_EMAIL,
        user_role: 'admin',
        action_type: 'email_correction',
        entity_type: 'user',
        entity_id: ADMIN_USER_ID,
        details: {
          message: 'Admin email corrected from admin@vitaluxeservice.com to admin@vitaluxeservices.com',
          old_email: OLD_EMAIL,
          new_email: NEW_EMAIL,
          timestamp: new Date().toISOString()
        }
      });

    console.log('Email fix completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Admin email successfully updated',
        old_email: OLD_EMAIL,
        new_email: NEW_EMAIL,
        note: 'You can now log in with admin@vitaluxeservices.com. This function can be safely deleted.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fix-admin-email function:', error);
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
