import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { validateManageProviderStatusRequest } from "../_shared/requestValidators.ts";

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
    // Parse JSON with error handling
    let requestData;
    try {
      requestData = await req.json();
    } catch (error) {
      console.error('Invalid JSON in request body:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input
    const validation = validateManageProviderStatusRequest(requestData);
    if (!validation.valid) {
      console.warn('Validation failed:', validation.errors);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request data', 
          details: validation.errors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Check if user is a practice or admin
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    
    const role = roleData?.role;
    const isDoctor = role === 'doctor';
    const isAdmin = role === 'admin';
    
    if (!isDoctor && !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Only practices or admins can manage provider status' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { providerId, active }: StatusRequest = requestData;
    
    // Fetch the provider to get the user_id
    // For doctors: enforce practice ownership
    // For admins: allow access to any provider
    let providerQuery = supabaseClient
      .from('providers')
      .select('user_id, practice_id')
      .eq('id', providerId);
    
    if (isDoctor) {
      providerQuery = providerQuery.eq('practice_id', user.id);
    }
    
    const { data: providerData, error: fetchError } = await providerQuery.single();

    if (fetchError || !providerData) {
      console.error('Provider fetch error:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Provider not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Update provider status
    // For doctors: enforce practice ownership in update
    // For admins: allow update to any provider
    let updateQuery = supabaseClient
      .from('providers')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', providerId);
    
    if (isDoctor) {
      updateQuery = updateQuery.eq('practice_id', user.id);
    }
    
    const { error: updateError } = await updateQuery;
    
    if (updateError) {
      console.error('Provider update error:', updateError);
      throw updateError;
    }
    
    // Update the provider's profile active status using admin client
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', providerData.user_id);

    if (profileUpdateError) {
      console.error('Failed to update provider profile status:', profileUpdateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update provider profile status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
