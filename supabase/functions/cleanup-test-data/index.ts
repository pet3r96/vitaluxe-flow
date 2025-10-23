import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Extract and validate auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify caller
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      console.error('Admin check failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { email, emails, pendingPracticeId } = await req.json();

    // Build email list
    let emailList: string[] = [];
    if (email) emailList.push(email);
    if (emails && Array.isArray(emails)) emailList.push(...emails);

    // Remove duplicates and trim
    emailList = [...new Set(emailList.map(e => e.trim().toLowerCase()))];

    if (emailList.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No emails provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (emailList.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Maximum 50 emails per request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing deletion request for ${emailList.length} users by admin ${user.email}`);

    const results: Array<{ email: string; success: boolean; message: string; details?: any }> = [];
    let deletedCount = 0;
    let errorCount = 0;

    // Process each email
    for (const targetEmail of emailList) {
      try {
        console.log(`Processing user: ${targetEmail}`);

        // Find user by email (case-insensitive)
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('id, name, email')
          .ilike('email', targetEmail)
          .single();

        if (profileError || !profile) {
          console.log(`User not found: ${targetEmail}`);
          results.push({
            email: targetEmail,
            success: false,
            message: 'User not found in profiles'
          });
          errorCount++;
          continue;
        }

        const userId = profile.id;
        console.log(`Found user ${userId} for ${targetEmail}`);

        // Safety check: verify no orders or patients
        const { count: orderCount } = await supabaseAdmin
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('doctor_id', userId);

        const { count: patientCount } = await supabaseAdmin
          .from('patients')
          .select('id', { count: 'exact', head: true })
          .eq('practice_id', userId);

        if ((orderCount ?? 0) > 0 || (patientCount ?? 0) > 0) {
          console.log(`User ${targetEmail} has data - orders: ${orderCount}, patients: ${patientCount}`);
          results.push({
            email: targetEmail,
            success: false,
            message: `User has ${orderCount} orders and ${patientCount} patients. Manual review required to avoid data loss.`
          });
          errorCount++;
          continue;
        }

        // Start cleanup process
        const cleanupDetails: any = {};

        // 1. Nullify references in profiles
        const { error: parentRefError } = await supabaseAdmin
          .from('profiles')
          .update({ parent_id: null })
          .eq('parent_id', userId);
        if (parentRefError) console.log('Error nullifying parent_id:', parentRefError);

        const { error: toplineRefError } = await supabaseAdmin
          .from('profiles')
          .update({ linked_topline_id: null })
          .eq('linked_topline_id', userId);
        if (toplineRefError) console.log('Error nullifying linked_topline_id:', toplineRefError);

        // 2. Find and delete reps
        const { data: reps } = await supabaseAdmin
          .from('reps')
          .select('id')
          .eq('user_id', userId);

        if (reps && reps.length > 0) {
          const repIds = reps.map(r => r.id);
          cleanupDetails.reps_deleted = repIds.length;

          // Delete rep practice links
          const { error: linkError } = await supabaseAdmin
            .from('rep_practice_links')
            .delete()
            .in('rep_id', repIds);
          if (linkError) console.log('Error deleting rep links:', linkError);

          // Delete reps
          const { error: repsError } = await supabaseAdmin
            .from('reps')
            .delete()
            .eq('user_id', userId);
          if (repsError) console.log('Error deleting reps:', repsError);
        }

        // 3. Delete providers
        const { error: providersError } = await supabaseAdmin
          .from('providers')
          .delete()
          .eq('user_id', userId);
        if (providersError) console.log('Error deleting providers:', providersError);

        // 4. Delete user roles
        const { error: rolesError } = await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', userId);
        if (rolesError) console.log('Error deleting user_roles:', rolesError);

        // 5. Delete carts
        const { error: cartError } = await supabaseAdmin
          .from('cart')
          .delete()
          .eq('doctor_id', userId);
        if (cartError) console.log('Error deleting cart:', cartError);

        // 6. Delete cart lines
        const { error: cartLinesError } = await supabaseAdmin
          .from('cart_lines')
          .delete()
          .eq('doctor_id', userId);
        if (cartLinesError) console.log('Error deleting cart_lines:', cartLinesError);

        // 7. Delete pending reps created by this user
        const { error: pendingRepsError } = await supabaseAdmin
          .from('pending_reps')
          .delete()
          .eq('created_by_user_id', userId);
        if (pendingRepsError) console.log('Error deleting pending_reps:', pendingRepsError);

        // 8. Delete auth user (will cascade to profiles)
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (deleteError) {
          console.error(`Failed to delete auth user ${userId}:`, deleteError);
          results.push({
            email: targetEmail,
            success: false,
            message: `Failed to delete auth user: ${deleteError.message}`
          });
          errorCount++;
          continue;
        }

        // Log to audit_logs
        await supabaseAdmin.from('audit_logs').insert({
          user_id: user.id,
          user_email: user.email,
          user_role: 'admin',
          action_type: 'cleanup_test_user',
          entity_type: 'profiles',
          entity_id: userId,
          details: {
            target_email: targetEmail,
            target_user_id: userId,
            cleanup_details: cleanupDetails
          }
        });

        console.log(`Successfully deleted user: ${targetEmail}`);
        results.push({
          email: targetEmail,
          success: true,
          message: 'User deleted successfully',
          details: cleanupDetails
        });
        deletedCount++;

      } catch (error: any) {
        console.error(`Error processing ${targetEmail}:`, error);
        results.push({
          email: targetEmail,
          success: false,
          message: `Error: ${error.message}`
        });
        errorCount++;
      }
    }

    // Optional: Delete pending practice if provided
    if (pendingPracticeId) {
      const { error: pendingError } = await supabaseAdmin
        .from('pending_practices')
        .delete()
        .eq('id', pendingPracticeId);
      if (pendingError) {
        console.log('Error deleting pending practice:', pendingError);
      }
    }

    const executionTime = (Date.now() - startTime) / 1000;

    return new Response(
      JSON.stringify({
        success: errorCount === 0,
        results,
        totals: {
          requested: emailList.length,
          deleted: deletedCount,
          errors: errorCount
        },
        execution_time_seconds: executionTime
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error in cleanup-test-data function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
