import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient, createAuthClient } from '../_shared/supabaseAdmin.ts';
import { validateManageProviderStatusRequest } from "../_shared/requestValidators.ts";
import { validateCSRFToken } from '../_shared/csrfValidator.ts';

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

    const authHeader = req.headers.get('Authorization')!;
    
    // Client for RLS-based operations
    const supabaseClient = createAuthClient(authHeader);
    
    // Admin client for auth operations
    const supabaseAdmin = createAdminClient();

    const { data: { user } } = await supabaseClient.auth.getUser();
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate CSRF token
    const csrfToken = req.headers.get('x-csrf-token') || undefined;
    const { valid, error: csrfError } = await validateCSRFToken(supabaseAdmin, user.id, csrfToken);
    if (!valid) {
      console.error('CSRF validation failed:', csrfError);
      return new Response(
        JSON.stringify({ error: csrfError || 'Invalid CSRF token' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error in manage-provider-status:', error);
    return new Response(
      JSON.stringify({ error: errorMessage || 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
