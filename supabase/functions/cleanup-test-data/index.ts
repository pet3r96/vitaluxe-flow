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

        // Start comprehensive cleanup process
        const cleanupDetails: any = {};
        
        console.log(`Starting cascade deletion for user ${userId}`);

        // STEP 0: Check if this is a PATIENT user (has patient_accounts with user_id)
        const { data: patientAccount } = await supabaseAdmin
          .from('patient_accounts')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        if (patientAccount) {
          console.log(`🩺 Detected PATIENT account: ${targetEmail}`);
          
          // Delete patient-specific medical vault data
          await supabaseAdmin.from('patient_medications').delete().eq('patient_account_id', patientAccount.id);
          await supabaseAdmin.from('patient_conditions').delete().eq('patient_account_id', patientAccount.id);
          await supabaseAdmin.from('patient_allergies').delete().eq('patient_account_id', patientAccount.id);
          await supabaseAdmin.from('patient_vitals').delete().eq('patient_account_id', patientAccount.id);
          await supabaseAdmin.from('patient_immunizations').delete().eq('patient_account_id', patientAccount.id);
          await supabaseAdmin.from('patient_surgeries').delete().eq('patient_account_id', patientAccount.id);
          await supabaseAdmin.from('patient_pharmacies').delete().eq('patient_account_id', patientAccount.id);
          await supabaseAdmin.from('patient_emergency_contacts').delete().eq('patient_account_id', patientAccount.id);
          await supabaseAdmin.from('patient_documents').delete().eq('patient_account_id', patientAccount.id);
          
          // Delete patient appointments (uses patient_id, not patient_account_id)
          await supabaseAdmin.from('patient_appointments').delete().eq('patient_id', patientAccount.id);
          
          // Delete the patient_accounts record itself
          await supabaseAdmin.from('patient_accounts').delete().eq('id', patientAccount.id);
          
          cleanupDetails.patient_account_deleted = true;
          console.log(`✓ Deleted patient account and medical vault data`);
        }

        // STEP 1: Delete medical vault data (for patient_accounts linked to this practice)
        const { data: patientAccounts } = await supabaseAdmin
          .from('patient_accounts')
          .select('id')
          .eq('practice_id', userId);

        if (patientAccounts && patientAccounts.length > 0) {
          const patientAccountIds = patientAccounts.map(p => p.id);
          console.log(`Deleting medical vault data for ${patientAccountIds.length} patient accounts`);

          await supabaseAdmin.from('patient_medications').delete().in('patient_account_id', patientAccountIds);
          await supabaseAdmin.from('patient_conditions').delete().in('patient_account_id', patientAccountIds);
          await supabaseAdmin.from('patient_allergies').delete().in('patient_account_id', patientAccountIds);
          await supabaseAdmin.from('patient_vitals').delete().in('patient_account_id', patientAccountIds);
          await supabaseAdmin.from('patient_immunizations').delete().in('patient_account_id', patientAccountIds);
          await supabaseAdmin.from('patient_surgeries').delete().in('patient_account_id', patientAccountIds);
          await supabaseAdmin.from('patient_pharmacies').delete().in('patient_account_id', patientAccountIds);
          await supabaseAdmin.from('patient_emergency_contacts').delete().in('patient_account_id', patientAccountIds);
          
          cleanupDetails.medical_vault_deleted = patientAccountIds.length;
        }

        // STEP 2: Delete appointments and blocked times
        const { data: appointments } = await supabaseAdmin
          .from('patient_appointments')
          .select('id')
          .eq('practice_id', userId);
        
        if (appointments && appointments.length > 0) {
          await supabaseAdmin
            .from('patient_appointments')
            .delete()
            .eq('practice_id', userId);
          cleanupDetails.appointments_deleted = appointments.length;
        }

        await supabaseAdmin
          .from('patient_blocked_times')
          .delete()
          .eq('practice_id', userId);

        // STEP 3: Delete order dependencies
        const { data: orders } = await supabaseAdmin
          .from('orders')
          .select('id')
          .eq('doctor_id', userId);

        if (orders && orders.length > 0) {
          const orderIds = orders.map(o => o.id);
          console.log(`Deleting ${orderIds.length} orders and their dependencies`);

          await supabaseAdmin.from('order_profits').delete().in('order_id', orderIds);
          await supabaseAdmin.from('order_lines').delete().in('order_id', orderIds);
          await supabaseAdmin.from('order_status_history').delete().in('order_id', orderIds);
          await supabaseAdmin.from('shipping_audit_logs').delete().in('order_id', orderIds);
          await supabaseAdmin.from('orders').delete().in('id', orderIds);
          
          cleanupDetails.orders_deleted = orderIds.length;
        }

        // STEP 4: Delete cart dependencies (fix: use cart_id, not doctor_id)
        const { data: carts } = await supabaseAdmin
          .from('cart')
          .select('id')
          .eq('doctor_id', userId);

        if (carts && carts.length > 0) {
          const cartIds = carts.map(c => c.id);
          await supabaseAdmin
            .from('cart_lines')
            .delete()
            .in('cart_id', cartIds);
          
          await supabaseAdmin
            .from('cart')
            .delete()
            .eq('doctor_id', userId);
          
          cleanupDetails.carts_deleted = carts.length;
        }

        // STEP 5: Delete patient_accounts data (not the old patients table)
        const { data: practicePatients } = await supabaseAdmin
          .from('patient_accounts')
          .select('id')
          .eq('practice_id', userId);

        if (practicePatients && practicePatients.length > 0) {
          const patientIds = practicePatients.map(p => p.id);
          
          await supabaseAdmin.from('patient_follow_ups').delete().in('patient_id', patientIds);
          await supabaseAdmin.from('patient_accounts').delete().eq('practice_id', userId);
          
          cleanupDetails.patients_deleted = patientIds.length;
        }

        // STEP 6: Delete provider dependencies (optional - may not exist)
        try {
          const { data: providers } = await supabaseAdmin
            .from('providers')
            .select('id')
            .eq('user_id', userId);

          if (providers && providers.length > 0) {
            const providerIds = providers.map(p => p.id);
            
            await supabaseAdmin.from('provider_documents').delete().in('provider_id', providerIds);
            await supabaseAdmin.from('providers').delete().eq('user_id', userId);
            
            cleanupDetails.providers_deleted = providerIds.length;
            console.log(`✓ Deleted ${providers.length} provider records`);
          } else {
            console.log('ℹ No provider records found (this is OK)');
            cleanupDetails.providers_deleted = 0;
          }

          // Also delete if user is a provider under another practice
          await supabaseAdmin.from('providers').delete().eq('user_id', userId);
        } catch (error: any) {
          console.warn(`Warning deleting provider data for ${targetEmail}:`, error.message);
          cleanupDetails.provider_deletion_warning = error.message;
        }

        // Delete practice staff (optional)
        try {
          await supabaseAdmin.from('practice_staff').delete().eq('user_id', userId);
          await supabaseAdmin.from('practice_staff').delete().eq('practice_id', userId);
          console.log('✓ Deleted practice staff records');
        } catch (error: any) {
          console.warn(`Warning deleting practice staff for ${targetEmail}:`, error.message);
        }

        // STEP 7: Delete rep dependencies (optional - may not exist)
        try {
          const { data: reps } = await supabaseAdmin
            .from('reps')
            .select('id')
            .eq('user_id', userId);

          if (reps && reps.length > 0) {
            const repIds = reps.map(r => r.id);
            
            await supabaseAdmin
              .from('rep_practice_links')
              .delete()
              .in('rep_id', repIds);
            
            await supabaseAdmin
              .from('reps')
              .delete()
              .eq('user_id', userId);
            
            cleanupDetails.reps_deleted = repIds.length;
            console.log(`✓ Deleted ${reps.length} rep records`);
          } else {
            console.log('ℹ No rep records found (this is OK)');
            cleanupDetails.reps_deleted = 0;
          }
        } catch (error: any) {
          console.warn(`Warning deleting rep data for ${targetEmail}:`, error.message);
          cleanupDetails.rep_deletion_warning = error.message;
        }

        // STEP 8: Delete user metadata (CRITICAL - must succeed)
        try {
          await supabaseAdmin.from('active_sessions').delete().eq('user_id', userId);
          await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
          await supabaseAdmin.from('user_password_status').delete().eq('user_id', userId);
          await supabaseAdmin.from('pending_reps').delete().eq('created_by_user_id', userId);
          console.log('✓ Deleted user metadata (sessions, roles, password status)');
        } catch (error: any) {
          console.error(`❌ CRITICAL: Failed to delete user metadata for ${targetEmail}:`, error.message);
          throw new Error(`Failed to delete critical user metadata: ${error.message}`);
        }

        // Nullify references in profiles
        await supabaseAdmin
          .from('profiles')
          .update({ parent_id: null })
          .eq('parent_id', userId);

        await supabaseAdmin
          .from('profiles')
          .update({ linked_topline_id: null })
          .eq('linked_topline_id', userId);

        // STEP 9: Delete auth user (will cascade to profiles)
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
