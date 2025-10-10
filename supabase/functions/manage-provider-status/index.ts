import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StatusRequest {
  providerId: string;
  active: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const authHeader = req.headers.get('Authorization')!;
    
    // Client for RLS-based operations
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    // Admin client for auth operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: { user } } = await supabaseClient.auth.getUser();
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is a practice (role='doctor')
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    
    if (roleData?.role !== 'doctor') {
      return new Response(
        JSON.stringify({ error: 'Only practices can manage provider status' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { providerId, active }: StatusRequest = await req.json();
    
    // Update provider status - RLS ensures practice owns this provider
    const { error: updateError } = await supabaseClient
      .from('providers')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', providerId)
      .eq('practice_id', user.id); // Double-check ownership
    
    if (updateError) {
      console.error('Provider update error:', updateError);
      throw updateError;
    }
    
    // Use admin client to ban/unban the provider's auth account
    if (!active) {
      await supabaseAdmin.auth.admin.updateUserById(providerId, {
        ban_duration: 'indefinite'
      });
    } else {
      await supabaseAdmin.auth.admin.updateUserById(providerId, {
        ban_duration: 'none'
      });
    }
    
    return new Response(
      JSON.stringify({ success: true, message: active ? 'Provider activated' : 'Provider deactivated' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in manage-provider-status:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
