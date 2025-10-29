import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
    const { staffId, active } = body;

    if (!staffId || typeof active !== 'boolean') {
      return new Response(
        JSON.stringify({ error: 'Staff ID and active status are required' }),
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

    // Attempt update by user_id first
    let { data, error } = await supabase
      .from('practice_staff')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('user_id', staffId)
      .select()
      .maybeSingle();

    // Fallback: try by id if no rows affected
    if (!data && !error) {
      console.log(`[manage-staff-status] No rows updated by user_id, trying by id`);
      const fallback = await supabase
        .from('practice_staff')
        .update({ active, updated_at: new Date().toISOString() })
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
