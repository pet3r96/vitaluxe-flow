import { createAuthClient, createAdminClient } from '../_shared/supabaseAdmin.ts';
import { validateCSRFToken } from '../_shared/csrfValidator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createAuthClient(req.headers.get('Authorization'));
    const supabaseAdmin = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate CSRF token
    const csrfToken = req.headers.get('x-csrf-token') || undefined;
    const { valid, error: csrfError } = await validateCSRFToken(supabase, user.id, csrfToken);
    if (!valid) {
      console.error('CSRF validation failed:', csrfError);
      return new Response(
        JSON.stringify({ error: csrfError || 'Invalid CSRF token' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const userRoles = roles?.map(r => r.role) || [];
    const isAdmin = userRoles.includes('admin');
    const isDoctor = userRoles.includes('doctor');

    if (!isAdmin && !isDoctor) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only admins and practice owners can manage staff' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { staffId, active, canOrder } = body;

    if (!staffId) {
      return new Response(
        JSON.stringify({ error: 'Staff ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[manage-staff-status] User ${user.id} attempting to update staff ${staffId} to active=${active}`);

    // Ownership check for non-admins
    if (!isAdmin) {
      // Try to find by user_id first
      let { data: staffRecord } = await supabase
        .from('practice_staff')
        .select('practice_id, id')
        .eq('user_id', staffId)
        .maybeSingle();

      // Fallback: try by id if not found by user_id
      if (!staffRecord) {
        console.log(`[manage-staff-status] Staff not found by user_id, trying by id`);
        const fallback = await supabase
          .from('practice_staff')
          .select('practice_id, id')
          .eq('id', staffId)
          .maybeSingle();
        
        staffRecord = fallback.data;
      }

      if (!staffRecord) {
        console.error(`[manage-staff-status] Staff record not found for staffId=${staffId}`);
        return new Response(
          JSON.stringify({ error: 'Staff member not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (staffRecord.practice_id !== user.id) {
        console.error(`[manage-staff-status] Forbidden: staff practice_id=${staffRecord.practice_id} != user.id=${user.id}`);
        return new Response(
          JSON.stringify({ error: 'You can only manage staff from your own practice' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Build update object dynamically
    const updateData: any = { updated_at: new Date().toISOString() };
    if (active !== undefined) updateData.active = active;
    if (canOrder !== undefined) updateData.can_order = canOrder;

    // Attempt update by user_id first
    let { data, error } = await supabaseAdmin
      .from('practice_staff')
      .update(updateData)
      .eq('user_id', staffId)
      .select()
      .maybeSingle();

    // Fallback: try by id if no rows affected
    if (!data && !error) {
      console.log(`[manage-staff-status] No rows updated by user_id, trying by id`);
      const fallback = await supabaseAdmin
        .from('practice_staff')
        .update(updateData)
        .eq('id', staffId)
        .select()
        .maybeSingle();
      
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error('[manage-staff-status] Error updating staff status:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to update staff status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data) {
      console.error(`[manage-staff-status] No staff record found to update for staffId=${staffId}`);
      return new Response(
        JSON.stringify({ error: 'Staff member not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[manage-staff-status] Staff status updated successfully:', data.id);

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
