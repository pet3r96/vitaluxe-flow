import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import { validatePhone, generateSecurePassword } from '../_shared/validators.ts';
import { validateApprovePendingRepRequest } from '../_shared/requestValidators.ts';
import { validateCSRFToken } from '../_shared/csrfValidator.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { requireAdmin } from '../_shared/roleChecker.ts';

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
      edgeLogger.warn('Validation failed', { errors: validation.errors });
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
    await requireAdmin(supabaseAdmin, user.id, 'Unauthorized - Admin access required');

    // Validate CSRF token
    const csrfToken = req.headers.get('x-csrf-token') || undefined;
    const csrfValidation = await validateCSRFToken(supabaseAdmin, user.id, csrfToken);
    if (!csrfValidation.valid) {
      edgeLogger.error('CSRF validation failed', new Error(csrfValidation.error || 'Invalid CSRF'), { userId: user.id });
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
        // Check if this is an "already registered" error with comprehensive error detection
        const errorMsg = createUserError.message?.toLowerCase() || '';
        const errorCode = createUserError.code;
        const isAlreadyRegistered = 
          // Check multiple status codes that Supabase Auth might use
          ([422, 400, 409, 23505].includes(createUserError.status) || errorCode === '23505') &&
          (
            errorMsg.includes('already registered') || 
            errorMsg.includes('already been registered') || 
            errorMsg.includes('user with this email') ||
            (errorMsg.includes('email') && errorMsg.includes('exist')) ||
            (errorMsg.includes('email') && errorMsg.includes('unique')) ||
            errorMsg.includes('duplicate')
          );
        
        if (isAlreadyRegistered) {
          edgeLogger.info('User already exists, fetching ID via SQL helper with retry', { emailDomain: pendingRep.email?.split('@')[1] });
          
          // Fetch existing user ID using SQL helper with retry logic
          let existingUserIdData, fetchIdError;
          for (let attempt = 1; attempt <= 2; attempt++) {
            const result = await supabaseAdmin
              .rpc('get_auth_user_id_by_email', { p_email: pendingRep.email });
            
            existingUserIdData = result.data;
            fetchIdError = result.error;
            
            if (!fetchIdError && existingUserIdData) {
              break; // Success
            }
            
            if (attempt === 1) {
              edgeLogger.warn('Failed to fetch user ID on first attempt, retrying...', { 
                emailDomain: pendingRep.email?.split('@')[1],
                error: fetchIdError?.message 
              });
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            }
          }
          
          if (fetchIdError || !existingUserIdData) {
            edgeLogger.error('Failed to fetch existing user ID after retry', fetchIdError, {
              emailDomain: pendingRep.email?.split('@')[1],
              attempts: 2
            });
            throw new Error('User already registered but could not resolve account. Please contact administrator.');
          }
          
          newUserId = existingUserIdData;
          userAlreadyExisted = true;
          temporaryPassword = null; // Don't expose password for existing users
          
          edgeLogger.info('Resolved existing user ID, ensuring records complete', { userId: newUserId });
          
        } else {
          // Non-recoverable error - log detailed info for debugging
          edgeLogger.error('Failed to create user (non-recoverable)', createUserError, {
            errorStatus: createUserError.status,
            errorCode: createUserError.code,
            errorMessage: createUserError.message,
            emailDomain: pendingRep.email?.split('@')[1]
          });
          throw new Error(`Failed to create user: ${createUserError.message}`);
        }
      } else if (newUser?.user) {
        newUserId = newUser.user.id;
        edgeLogger.info('Created new user', { userId: newUserId });
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
          edgeLogger.error('Failed to create profile', profileError);
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
          edgeLogger.error('Failed to update profile topline assignment', profileUpdateError);
        } else {
          edgeLogger.info('Updated existing profile topline assignment', { userId: newUserId });
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
          edgeLogger.error('Failed to add role', roleError);
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
            edgeLogger.warn('Topline rep record not found', { toplineUserId: pendingRep.assigned_topline_user_id });
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
          edgeLogger.error('Failed to create rep record', repError);
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
            edgeLogger.error('Failed to update rep topline assignment', repUpdateError);
          } else {
            edgeLogger.info('Updated existing rep topline assignment', { toplineRepId: toplineRep.id });
          }
        } else {
          edgeLogger.warn('Topline rep record not found - cannot update assignment', { toplineUserId: pendingRep.assigned_topline_user_id });
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
          const emailResult = await supabaseAdmin.functions.invoke('send-welcome-email', {
            body: {
              userId: newUserId,
              email: pendingRep.email,
              name: pendingRep.full_name,
              role: pendingRep.role
            }
          });
          
          if (emailResult.error) {
            edgeLogger.error('Error sending welcome email', emailResult.error);
          } else {
            edgeLogger.info('Welcome email sent successfully', { emailDomain: pendingRep.email?.split('@')[1] });
          }
        } catch (emailErr) {
          edgeLogger.error('Failed to send welcome email', emailErr);
        }
      }

      // Update pending request status
      const { error: updateError } = await supabaseAdmin
        .from('pending_reps')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by_user_id: user.id,
          admin_notes: adminNotes
        })
        .eq('id', requestId);

      if (updateError) {
        edgeLogger.error('Failed to update pending request', updateError);
        throw new Error(`Failed to update pending request: ${updateError.message}`);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: userAlreadyExisted 
            ? 'Representative request completed (user already existed)' 
            : 'Representative approved and welcome email sent',
          userId: newUserId
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
          reviewed_by_user_id: user.id,
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

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    edgeLogger.error('Error in approve-pending-rep', error, { requestId, action });
    
    // Log error to database
    try {
      await supabaseAdmin.rpc('log_audit_event', {
        p_action_type: 'edge_function_error',
        p_entity_type: 'approve-pending-rep',
        p_entity_id: requestId,
        p_details: {
          error_message: errorMessage,
          error_stack: errorStack,
          function_name: 'approve-pending-rep',
          request_data: { requestId, action, adminNotes },
          rep_email: pendingRep?.email
        }
      });
    } catch (logError) {
      edgeLogger.error('Failed to log error', logError);
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