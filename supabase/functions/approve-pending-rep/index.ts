import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import { validatePhone, generateSecurePassword } from '../_shared/validators.ts';
import { validateApprovePendingRepRequest } from '../_shared/requestValidators.ts';
import { validateCSRFToken } from '../_shared/csrfValidator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
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
    // Parse and validate JSON
    let requestData;
    try {
      requestData = await req.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = validateApprovePendingRepRequest(requestData);
    if (!validation.valid) {
      console.warn('Validation failed:', validation.errors);
      return new Response(
        JSON.stringify({ error: 'Invalid request data', details: validation.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    supabaseAdmin = createAdminClient();

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

    // Validate CSRF token
    const csrfToken = req.headers.get('x-csrf-token') || undefined;
    const csrfValidation = await validateCSRFToken(supabaseAdmin, user.id, csrfToken);
    if (!csrfValidation.valid) {
      console.error('CSRF validation failed:', csrfValidation.error);
      return new Response(
        JSON.stringify({ error: csrfValidation.error || 'Invalid CSRF token' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    requestId = requestData.requestId;
    action = requestData.action;
    const rejectionReason = requestData.rejectionReason;
    adminNotes = requestData.adminNotes;

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

    // Idempotency check - if already approved, just return success
    if (pendingRep.status === 'approved') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Request already approved',
          alreadyProcessed: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

      // Create-first approach: try to create user, handle "already exists" gracefully
      let newUserId: string;
      let temporaryPassword: string | null = null;
      let userAlreadyExisted = false;

      temporaryPassword = generateSecurePassword();
      
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

      if (createUserError) {
        // Check if this is an "already registered" error (be flexible with error format)
        const errorMsg = createUserError.message?.toLowerCase() || '';
        const isAlreadyRegistered = 
          (createUserError.status === 422 || createUserError.status === 400) &&
          (errorMsg.includes('already registered') || errorMsg.includes('already been registered') || errorMsg.includes('user with this email'));
        
        if (isAlreadyRegistered) {
          console.log(`User already exists for email: ${pendingRep.email}, fetching ID via SQL helper`);
          
          // Fetch existing user ID using SQL helper
          const { data: existingUserIdData, error: fetchIdError } = await supabaseAdmin
            .rpc('get_auth_user_id_by_email', { p_email: pendingRep.email });
          
          if (fetchIdError || !existingUserIdData) {
            console.error('Failed to fetch existing user ID:', fetchIdError);
            throw new Error('User already registered but could not resolve account. Please contact administrator.');
          }
          
          newUserId = existingUserIdData;
          userAlreadyExisted = true;
          temporaryPassword = null; // Don't expose password for existing users
          
          console.log(`Resolved existing user ID: ${newUserId}, ensuring records are complete`);
          
        } else {
          // Non-recoverable error
          console.error('Failed to create user (non-recoverable):', createUserError);
          throw new Error(`Failed to create user: ${createUserError.message}`);
        }
      } else if (newUser?.user) {
        newUserId = newUser.user.id;
        console.log(`Created new user: ${newUserId}`);
      } else {
        throw new Error('User creation returned no user object');
      }

      // Safety check: ensure we have a userId before proceeding
      if (!newUserId) {
        throw new Error('Could not determine user ID after user creation/resolution');
      }

      // Ensure profile exists (for both new and existing users)
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', newUserId)
        .maybeSingle();
      
      if (!existingProfile) {
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: newUserId,
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
      } else if (pendingRep.role === 'downline' && pendingRep.assigned_topline_user_id) {
        // Update existing profile's topline assignment
        const { error: profileUpdateError } = await supabaseAdmin
          .from('profiles')
          .update({ 
            linked_topline_id: pendingRep.assigned_topline_user_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', newUserId);
        
        if (profileUpdateError) {
          console.error('Failed to update profile topline assignment:', profileUpdateError);
        } else {
          console.log(`Updated existing profile's topline assignment for user ${newUserId}`);
        }
      }

      // Ensure user_roles record exists
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', newUserId)
        .eq('role', pendingRep.role)
        .maybeSingle();
      
      if (!existingRole) {
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: newUserId,
            role: pendingRep.role
          });

        if (roleError) {
          console.error('Failed to add role:', roleError);
          throw new Error(`Failed to add role: ${roleError.message}`);
        }
      }

      // Ensure reps record exists
      const { data: existingRep } = await supabaseAdmin
        .from('reps')
        .select('id')
        .eq('user_id', newUserId)
        .maybeSingle();
      
      if (!existingRep) {
        let assigned_topline_id = null;
        if (pendingRep.role === 'downline' && pendingRep.assigned_topline_user_id) {
          const { data: toplineRep } = await supabaseAdmin
            .from('reps')
            .select('id')
            .eq('user_id', pendingRep.assigned_topline_user_id)
            .eq('role', 'topline')
            .maybeSingle();
          
          assigned_topline_id = toplineRep?.id || null;
          if (!assigned_topline_id) {
            console.warn(`Topline rep record not found for user_id: ${pendingRep.assigned_topline_user_id}`);
          }
        }

        const { error: repError } = await supabaseAdmin
          .from('reps')
          .insert({
            user_id: newUserId,
            role: pendingRep.role,
            assigned_topline_id: assigned_topline_id,
            active: true
          });

        if (repError) {
          console.error('Failed to create rep record:', repError);
          throw new Error(`Failed to create rep record: ${repError.message}`);
        }
      } else if (pendingRep.role === 'downline' && pendingRep.assigned_topline_user_id) {
        // Update existing reps record's topline assignment
        const { data: toplineRep } = await supabaseAdmin
          .from('reps')
          .select('id')
          .eq('user_id', pendingRep.assigned_topline_user_id)
          .eq('role', 'topline')
          .maybeSingle();
        
        if (toplineRep) {
          const { error: repUpdateError } = await supabaseAdmin
            .from('reps')
            .update({ 
              assigned_topline_id: toplineRep.id,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', newUserId);
          
          if (repUpdateError) {
            console.error('Failed to update rep topline assignment:', repUpdateError);
          } else {
            console.log(`Updated existing rep's topline assignment to: ${toplineRep.id}`);
          }
        } else {
          console.warn(`Topline rep record not found for user_id: ${pendingRep.assigned_topline_user_id} - cannot update assignment`);
        }
      }

      // Ensure password status record exists
      const { data: existingPasswordStatus } = await supabaseAdmin
        .from('user_password_status')
        .select('user_id')
        .eq('user_id', newUserId)
        .maybeSingle();
      
      if (!existingPasswordStatus) {
        await supabaseAdmin.from('user_password_status').insert({
          user_id: newUserId,
          must_change_password: true,
          temporary_password_sent: true,
          first_login_completed: false
        });
      }

      // Send welcome email only for newly created users
      if (!userAlreadyExisted && temporaryPassword) {
        try {
          await supabaseAdmin.functions.invoke('send-temp-password-email', {
            body: {
              email: pendingRep.email,
              name: pendingRep.full_name,
              temporaryPassword: temporaryPassword,
              role: pendingRep.role,
              userId: newUserId  // CRITICAL: Pass userId so token can be created
            }
          });
          console.log('✅ Welcome email sent successfully to:', pendingRep.email);
        } catch (emailErr) {
          console.error('Failed to send welcome email:', emailErr);
          console.error('Email error details:', emailErr);
        }
      }

      // Update pending request status
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

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: userAlreadyExisted 
            ? 'Representative request completed (user already existed)' 
            : 'Representative approved and welcome email sent',
          userId: newUserId,
          temporaryPassword: userAlreadyExisted ? null : temporaryPassword
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
      JSON.stringify({ error: 'An error occurred processing the request' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});