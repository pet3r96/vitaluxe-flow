import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validatePhone, generateSecurePassword } from '../_shared/validators.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Declare variables at top scope for error logging
  let supabaseAdmin: any;
  let requestId: string | undefined;
  let action: string | undefined;
  let adminNotes: string | undefined;
  let pendingRep: any;

  try {
    supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);

    if (!user) {
      throw new Error('Not authenticated');
    }

    // Verify admin role
    const { data: adminRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!adminRole) {
      throw new Error('Unauthorized - Admin access required');
    }

    const requestData = await req.json();
    requestId = requestData.requestId;
    action = requestData.action;
    const rejectionReason = requestData.rejectionReason;
    adminNotes = requestData.adminNotes;

    console.log('Processing pending rep request:', { requestId, action });

    // Get pending request
    const { data: fetchedRep, error: fetchError } = await supabaseAdmin
      .from('pending_reps')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !fetchedRep) {
      throw new Error('Pending request not found');
    }

    pendingRep = fetchedRep;

    if (pendingRep.status !== 'pending') {
      throw new Error('Request already processed');
    }

    if (action === 'approve') {
      // Validate phone number
      if (pendingRep.phone) {
        const phoneResult = validatePhone(pendingRep.phone);
        if (!phoneResult.valid) {
          throw new Error(`Phone validation: ${phoneResult.error}`);
        }
      }

      // Generate secure temporary password
      const temporaryPassword = generateSecurePassword();

      console.log('Creating user account for:', pendingRep.email);

      // Create user with admin client
      const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: pendingRep.email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          name: pendingRep.full_name,
          phone: pendingRep.phone,
          company: pendingRep.company
        }
      });

      if (createUserError || !newUser.user) {
        console.error('Failed to create user:', createUserError);
        throw new Error(`Failed to create user: ${createUserError?.message}`);
      }

      console.log('User created:', newUser.user.id);

      // Create profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: newUser.user.id,
          name: pendingRep.full_name,
          email: pendingRep.email,
          phone: pendingRep.phone,
          company: pendingRep.company,
          active: true,
          linked_topline_id: pendingRep.role === 'downline' ? pendingRep.assigned_topline_user_id : null
        });

      if (profileError) {
        console.error('Failed to create profile:', profileError);
        throw new Error(`Failed to create profile: ${profileError.message}`);
      }

      // Add role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: newUser.user.id,
          role: pendingRep.role
        });

      if (roleError) {
        console.error('Failed to add role:', roleError);
        throw new Error(`Failed to add role: ${roleError.message}`);
      }

      // Create rep record
      let assigned_topline_id = null;
      if (pendingRep.role === 'downline' && pendingRep.assigned_topline_user_id) {
        // Get topline's rep.id
        const { data: toplineRep } = await supabaseAdmin
          .from('reps')
          .select('id')
          .eq('user_id', pendingRep.assigned_topline_user_id)
          .eq('role', 'topline')
          .maybeSingle();
        
        assigned_topline_id = toplineRep?.id || null;
      }

      const { error: repError } = await supabaseAdmin
        .from('reps')
        .insert({
          user_id: newUser.user.id,
          role: pendingRep.role,
          assigned_topline_id: assigned_topline_id,
          active: true
        });

      if (repError) {
        console.error('Failed to create rep record:', repError);
        throw new Error(`Failed to create rep record: ${repError.message}`);
      }

      // Insert password status record
      await supabaseAdmin.from('user_password_status').insert({
        user_id: newUser.user.id,
        must_change_password: true,
        temporary_password_sent: true,
        first_login_completed: false
      });

      // Send welcome email
      try {
        await supabaseAdmin.functions.invoke('send-welcome-email', {
          body: {
            email: pendingRep.email,
            name: pendingRep.full_name,
            temporaryPassword: temporaryPassword,
            role: pendingRep.role
          }
        });
      } catch (emailErr) {
        console.error('Failed to send welcome email:', emailErr);
      }

      // Update pending request
      const { error: updateError } = await supabaseAdmin
        .from('pending_reps')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          admin_notes: adminNotes
        })
        .eq('id', requestId);

      if (updateError) {
        console.error('Failed to update pending request:', updateError);
        throw new Error(`Failed to update pending request: ${updateError.message}`);
      }

      console.log('Rep approved successfully');

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Representative approved and welcome email sent',
          userId: newUser.user.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'reject') {
      // Update pending request to rejected
      const { error: updateError } = await supabaseAdmin
        .from('pending_reps')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          rejection_reason: rejectionReason,
          admin_notes: adminNotes
        })
        .eq('id', requestId);

      if (updateError) {
        throw new Error(`Failed to reject request: ${updateError.message}`);
      }

      console.log('Rep request rejected');

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Representative request rejected'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      throw new Error('Invalid action');
    }

  } catch (error: any) {
    console.error('Error in approve-pending-rep:', error);
    
    // Log error to database
    try {
      await supabaseAdmin.rpc('log_audit_event', {
        p_action_type: 'edge_function_error',
        p_entity_type: 'approve-pending-rep',
        p_entity_id: requestId,
        p_details: {
          error_message: error.message,
          error_stack: error.stack,
          function_name: 'approve-pending-rep',
          request_data: { requestId, action, adminNotes },
          rep_email: pendingRep?.email
        }
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});