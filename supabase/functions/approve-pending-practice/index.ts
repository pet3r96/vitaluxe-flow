import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validatePhone, validateNPI, validateDEA, generateSecurePassword } from '../_shared/validators.ts';
import { validateApprovePendingPracticeRequest } from '../_shared/requestValidators.ts';

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
  let pendingPractice: any;

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

    const validation = validateApprovePendingPracticeRequest(requestData);
    if (!validation.valid) {
      console.warn('Validation failed:', validation.errors);
      return new Response(
        JSON.stringify({ error: 'Invalid request data', details: validation.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    requestId = requestData.requestId;
    action = requestData.action;
    const rejectionReason = requestData.rejectionReason;
    adminNotes = requestData.adminNotes;
    const updatedData = requestData.updatedData;

    // Get pending request
    const { data: fetchedPractice, error: fetchError } = await supabaseAdmin
      .from('pending_practices')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !fetchedPractice) {
      throw new Error('Pending request not found');
    }

    pendingPractice = fetchedPractice;

    if (pendingPractice.status !== 'pending') {
      throw new Error('Request already processed');
    }

    if (action === 'approve') {
      // Use updated data if provided, otherwise use original
      const practiceData = updatedData || pendingPractice;

      // Validate data before creating account
      if (practiceData.phone) {
        const phoneResult = validatePhone(practiceData.phone);
        if (!phoneResult.valid) {
          throw new Error(`Phone validation: ${phoneResult.error}`);
        }
      }

      if (practiceData.npi) {
        const npiResult = validateNPI(practiceData.npi);
        if (!npiResult.valid) {
          throw new Error(`NPI validation: ${npiResult.error}`);
        }
      }

      if (practiceData.dea) {
        const deaResult = validateDEA(practiceData.dea);
        if (!deaResult.valid) {
          throw new Error(`DEA validation: ${deaResult.error}`);
        }
      }

      if (practiceData.prescriber_npi) {
        const result = validateNPI(practiceData.prescriber_npi);
        if (!result.valid) {
          throw new Error(`Prescriber NPI validation: ${result.error}`);
        }
      }

      if (practiceData.prescriber_dea) {
        const result = validateDEA(practiceData.prescriber_dea);
        if (!result.valid) {
          throw new Error(`Prescriber DEA validation: ${result.error}`);
        }
      }

      if (practiceData.prescriber_phone) {
        const result = validatePhone(practiceData.prescriber_phone);
        if (!result.valid) {
          throw new Error(`Prescriber phone validation: ${result.error}`);
        }
      }

      // Generate secure temporary password
      const temporaryPassword = generateSecurePassword();

      // Create user with admin client (handle existing users)
      let userId: string;
      let isNewUser = false;
      
      try {
        const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
          email: practiceData.email,
          password: temporaryPassword,
          email_confirm: true,
          user_metadata: {
            name: practiceData.practice_name,
            phone: practiceData.phone,
            company: practiceData.company
          }
        });

        if (createUserError) {
          // Check if user already exists
          if (createUserError.message?.includes('already registered') || 
              createUserError.message?.includes('duplicate')) {
            const { data: existingUser, error: fetchError } = await supabaseAdmin.auth.admin
              .listUsers();
            
            const foundUser = existingUser?.users?.find((u: any) => u.email === practiceData.email);
            if (!foundUser) {
              throw new Error(`Failed to create or find user: ${createUserError.message}`);
            }
            userId = foundUser.id;
          } else {
            throw new Error(`Failed to create user: ${createUserError.message}`);
          }
        } else if (!newUser?.user) {
          throw new Error('Failed to create user: No user data returned');
        } else {
          userId = newUser.user.id;
          isNewUser = true;
        }
      } catch (error: any) {
        console.error('Error handling user creation:', error);
        throw error;
      }

      // Upload contract file if provided
      let contract_url = null;
      if (practiceData.contract_file) {
        try {
          const contractData = practiceData.contract_file;
          const fileName = `${userId}/${Date.now()}_contract.pdf`;
          
          const { error: uploadError } = await supabaseAdmin.storage
            .from('contracts')
            .upload(fileName, contractData, {
              contentType: 'application/pdf'
            });

          if (!uploadError) {
            const { data: urlData } = supabaseAdmin.storage
              .from('contracts')
              .getPublicUrl(fileName);
            contract_url = urlData.publicUrl;
          }
        } catch (uploadError) {
          console.error('Failed to upload contract:', uploadError);
        }
      }

      // Upsert profile (idempotent)
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          name: practiceData.practice_name,
          email: practiceData.email,
          phone: practiceData.phone,
          company: practiceData.company,
          npi: practiceData.npi,
          license_number: practiceData.license_number,
          dea: practiceData.dea,
          address_street: practiceData.address_street,
          address_city: practiceData.address_city,
          address_state: practiceData.address_state,
          address_zip: practiceData.address_zip,
          contract_url: contract_url,
          linked_topline_id: practiceData.assigned_rep_user_id,
          active: true,
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        });

      if (profileError) {
        console.error('Failed to upsert profile:', profileError);
        throw new Error(`Failed to upsert profile: ${profileError.message}`);
      }

      // Upsert doctor role (idempotent)
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: 'doctor'
        }, { 
          onConflict: 'user_id,role',
          ignoreDuplicates: false 
        });

      if (roleError) {
        console.error('Failed to upsert role:', roleError);
        throw new Error(`Failed to upsert role: ${roleError.message}`);
      }

      // Upsert default provider (idempotent)
      const { error: providerError } = await supabaseAdmin
        .from('providers')
        .upsert({
          user_id: userId,
          practice_id: userId,
          active: true,
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'user_id',
          ignoreDuplicates: false 
        });

      if (providerError) {
        console.error('Failed to upsert provider:', providerError);
      }

      // Upsert password status record (idempotent)
      await supabaseAdmin.from('user_password_status').upsert({
        user_id: userId,
        must_change_password: true,
        temporary_password_sent: true,
        first_login_completed: false
      }, { 
        onConflict: 'user_id',
        ignoreDuplicates: false 
      });

      // Send welcome email only for new users
      if (isNewUser) {
        try {
          await supabaseAdmin.functions.invoke('send-welcome-email', {
            body: {
              email: practiceData.email,
              name: practiceData.practice_name,
              temporaryPassword: temporaryPassword,
              role: 'doctor'
            }
          });
        } catch (emailErr) {
          console.error('Failed to send welcome email:', emailErr);
        }
      } else {
        console.log('Skipping welcome email for existing user');
      }

      // Update pending request
      const { error: updateError } = await supabaseAdmin
        .from('pending_practices')
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

      console.log('Practice approved successfully');

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: isNewUser ? 'Practice approved and welcome email sent' : 'Practice approval completed',
          userId: userId,
          isNewUser: isNewUser
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'reject') {
      // Update pending request to rejected
      const { error: updateError } = await supabaseAdmin
        .from('pending_practices')
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
          message: 'Practice request rejected'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      throw new Error('Invalid action');
    }

  } catch (error: any) {
    console.error('Error in approve-pending-practice:', error);
    
    // Log error to database
    try {
      await supabaseAdmin.rpc('log_audit_event', {
        p_action_type: 'edge_function_error',
        p_entity_type: 'approve-pending-practice',
        p_entity_id: requestId,
        p_details: {
          error_message: error.message,
          error_stack: error.stack,
          function_name: 'approve-pending-practice',
          request_data: { requestId, action, adminNotes },
          practice_email: pendingPractice?.email
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