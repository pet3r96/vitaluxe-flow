import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validatePhone, validateNPI, validateDEA } from '../_shared/validators.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
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

    const { requestId, action, rejectionReason, adminNotes, updatedData } = await req.json();

    console.log('Processing pending practice request:', { requestId, action });

    // Get pending request
    const { data: pendingPractice, error: fetchError } = await supabaseAdmin
      .from('pending_practices')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !pendingPractice) {
      throw new Error('Pending request not found');
    }

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

      // Generate secure password
      const password = crypto.randomUUID();

      console.log('Creating practice account for:', practiceData.email);

      // Create user with admin client
      const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: practiceData.email,
        password: password,
        email_confirm: true,
        user_metadata: {
          name: practiceData.practice_name,
          phone: practiceData.phone,
          company: practiceData.company
        }
      });

      if (createUserError || !newUser.user) {
        console.error('Failed to create user:', createUserError);
        throw new Error(`Failed to create user: ${createUserError?.message}`);
      }

      console.log('User created:', newUser.user.id);

      // Upload contract file if provided
      let contract_url = null;
      if (practiceData.contract_file) {
        try {
          const contractData = practiceData.contract_file;
          const fileName = `${newUser.user.id}/${Date.now()}_contract.pdf`;
          
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

      // Create profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: newUser.user.id,
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
          active: true
        });

      if (profileError) {
        console.error('Failed to create profile:', profileError);
        throw new Error(`Failed to create profile: ${profileError.message}`);
      }

      // Add doctor role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: newUser.user.id,
          role: 'doctor'
        });

      if (roleError) {
        console.error('Failed to add role:', roleError);
        throw new Error(`Failed to add role: ${roleError.message}`);
      }

      // Create default provider
      const { error: providerError } = await supabaseAdmin
        .from('providers')
        .insert({
          user_id: newUser.user.id,
          practice_id: newUser.user.id,
          active: true
        });

      if (providerError) {
        console.error('Failed to create provider:', providerError);
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
          message: 'Practice approved and account created',
          userId: newUser.user.id,
          tempPassword: password
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

      console.log('Practice request rejected');

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
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});