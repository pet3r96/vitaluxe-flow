import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendNotificationEmail } from '../_shared/notificationEmailSender.ts';
import { sendNotificationSms } from '../_shared/notificationSmsSender.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to normalize phone to E.164
function normalizePhoneToE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (phone.startsWith('+')) return phone;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

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
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve effectivePracticeId robustly with impersonation and role checks
    let effectivePracticeId: string | null = null;

    // Check active impersonation
    const { data: impersonationSession, error: impErr } = await supabaseAdmin
      .from('active_impersonation_sessions')
      .select('impersonated_user_id, impersonated_role, expires_at')
      .eq('admin_user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (impErr) {
      console.error('Impersonation lookup error:', impErr);
    }

    if (impersonationSession?.impersonated_user_id) {
      const role = (impersonationSession as any).impersonated_role;
      const impersonatedId = impersonationSession.impersonated_user_id as string;
      console.log('Impersonation active:', { role, impersonatedId });

      if (role === 'patient') {
        const { data: patientAccount, error: paErr } = await supabaseAdmin
          .from('patient_accounts')
          .select('practice_id')
          .eq('user_id', impersonatedId)
          .maybeSingle();
        if (paErr) console.error('Patient account lookup error:', paErr);
        effectivePracticeId = patientAccount?.practice_id ?? null;
        console.log('Resolved practice from patient impersonation:', effectivePracticeId);
      } else {
        // Treat impersonated user as the practice account (doctor/practice)
        effectivePracticeId = impersonatedId;
        console.log('Using impersonated practice:', effectivePracticeId);
      }
    }

    // If no impersonation-derived practice, resolve from current user context
    if (!effectivePracticeId) {
      // Is the user a practice/doctor?
      const { data: doctorRole } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'doctor')
        .maybeSingle();

      if (doctorRole) {
        effectivePracticeId = user.id;
        console.log('Resolved practice as doctor account:', effectivePracticeId);
      } else {
        // Provider linkage
        const { data: providerRow } = await supabaseAdmin
          .from('providers')
          .select('practice_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (providerRow?.practice_id) {
          effectivePracticeId = providerRow.practice_id as string;
          console.log('Resolved practice via providers table:', effectivePracticeId);
        } else {
          // Practice staff linkage (if exists)
          const { data: staffRow } = await supabaseAdmin
            .from('practice_staff')
            .select('practice_id')
            .eq('user_id', user.id)
            .maybeSingle();
          if (staffRow?.practice_id) {
            effectivePracticeId = staffRow.practice_id as string;
            console.log('Resolved practice via practice_staff table:', effectivePracticeId);
          }
        }
      }
    }

    if (!effectivePracticeId) {
      console.error('No practice context could be resolved for user', user.id);
      return new Response(
        JSON.stringify({ error: 'No practice context', code: 'no_practice_context' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { documentId, patientIds, message } = await req.json();

    console.log('Assign document request:', { documentId, patientIds, message, effectivePracticeId });

    if (!documentId || !patientIds || !Array.isArray(patientIds) || patientIds.length === 0) {
      console.error('Invalid request parameters:', { documentId, patientIds });
      return new Response(
        JSON.stringify({ error: 'documentId and patientIds (array) are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify document belongs to this practice
    const { data: docCheck } = await supabaseAdmin
      .from('provider_documents')
      .select('practice_id')
      .eq('id', documentId)
      .single();

    if (!docCheck || docCheck.practice_id !== effectivePracticeId) {
      console.error('Document access denied:', { docCheck, effectivePracticeId });
      return new Response(
        JSON.stringify({ error: 'Document not found or access denied', code: 'document_access_denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve and verify patient IDs - accept either patients.id or patient_accounts.id
    const resolvedPatientIds: string[] = [];
    const patientIdLog: Array<{incoming: string, resolved: string | null}> = [];

    for (const incomingId of patientIds) {
      // Try direct lookup in patient_accounts table
      const { data: directMatch } = await supabaseAdmin
        .from('patient_accounts')
        .select('id, practice_id')
        .eq('id', incomingId)
        .maybeSingle();

      if (directMatch) {
        if (directMatch.practice_id === effectivePracticeId) {
          resolvedPatientIds.push(directMatch.id);
          patientIdLog.push({ incoming: incomingId, resolved: directMatch.id });
        } else {
          console.error('Patient belongs to different practice:', { incomingId, directMatch, effectivePracticeId });
          return new Response(
            JSON.stringify({ error: 'Access denied to one or more patients' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // Try resolving via patient_accounts.id (already unified, this is now just a direct lookup)
        const { data: resolvedMatch } = await supabaseAdmin
          .from('patient_accounts')
          .select('id, practice_id, user_id')
          .eq('id', incomingId)
          .maybeSingle();

        if (resolvedMatch && resolvedMatch.practice_id === effectivePracticeId) {
          resolvedPatientIds.push(resolvedMatch.id);
          patientIdLog.push({ incoming: incomingId, resolved: resolvedMatch.id });
          console.log('Resolved patient_account_id to patients.id:', { 
            patient_account_id: incomingId, 
            patients_id: resolvedMatch.id 
          });
        } else {
          console.error('Could not resolve patient ID:', { incomingId, resolvedMatch });
          return new Response(
            JSON.stringify({ error: 'One or more patients not found' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    console.log('Patient ID resolution:', patientIdLog);
    console.log('Resolved patient IDs:', resolvedPatientIds);

    // Get document info
    const { data: document } = await supabaseAdmin
      .from('provider_documents')
      .select('document_name, practice_id')
      .eq('id', documentId)
      .single();

    // Insert assignments into junction table using resolved patients.id
    const assignments = resolvedPatientIds.map(patientId => ({
      document_id: documentId,
      patient_id: patientId,
      assigned_by: user.id,
      message,
    }));

    const { error: assignError } = await supabaseAdmin
      .from('provider_document_patients')
      .insert(assignments);

    if (assignError) {
      console.error('Error assigning document:', assignError);
      return new Response(
        JSON.stringify({ error: assignError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get patient accounts for notifications using resolved IDs
    // Since tables are merged, patient_accounts.id is the patient ID
    const { data: patientAccountsLookup } = await supabaseAdmin
      .from('patient_accounts')
      .select('id, user_id')
      .in('id', resolvedPatientIds);

    // Extract user_ids for patients who have portal access (for notifications)
    const accountIds = patientAccountsLookup?.map(p => p.user_id).filter(Boolean) || [];
    
    // Get full patient account details for notifications
    const { data: patientAccounts } = await supabaseAdmin
      .from('patient_accounts')
      .select('id, user_id, email, phone, first_name, last_name')
      .in('id', resolvedPatientIds);

    // Create notifications for each patient
    if (patientAccounts && patientAccounts.length > 0) {
      for (const account of patientAccounts) {
        const notificationTitle = 'New Document Available';
        const notificationMessage = message || `"${document?.document_name}" has been assigned to you`;
        
        if (account.user_id) {
          // Patient has portal account - standard notification pipeline
          await supabaseAdmin.functions.invoke('handleNotifications', {
            body: {
              user_id: account.user_id,
              notification_type: 'document_assigned',
              title: notificationTitle,
              message: notificationMessage,
              action_url: '/documents',
              entity_type: 'provider_document',
              entity_id: documentId,
              metadata: {
                document_id: documentId,
                practice_id: effectivePracticeId
              }
            }
          });
          console.log(`[assign-document-to-patient] Notification sent for patient ${account.id}`);
        } else {
          // Patient has no portal account - direct email/SMS fallback
          console.log(`[assign-document-to-patient] Fallback: Patient ${account.id} has no user_id`);
          
          if (account.email) {
            const recipientName = `${account.first_name || ''} ${account.last_name || ''}`.trim() || 'Valued Patient';
            const emailResult = await sendNotificationEmail({
              to: account.email,
              recipientName,
              subject: notificationTitle,
              title: notificationTitle,
              message: notificationMessage,
              actionUrl: undefined
            });
            console.log('[assign-document-to-patient] Fallback email:', emailResult.success ? 'sent' : 'failed');
          }
          
          if (account.phone) {
            const normalizedPhone = normalizePhoneToE164(account.phone);
            const smsMessage = `${notificationTitle}\n\n${notificationMessage}`;
            const smsResult = await sendNotificationSms({
              phoneNumber: normalizedPhone,
              message: smsMessage,
              metadata: { document_id: documentId, practice_id: effectivePracticeId }
            });
            console.log('[assign-document-to-patient] Fallback SMS:', smsResult.success ? 'sent' : 'failed');
          }
        }
      }
    }

    // Create audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action_type: 'document_assigned',
      entity_type: 'provider_document',
      entity_id: documentId,
      details: {
        document_name: document?.document_name,
        patient_ids: resolvedPatientIds,
        patient_count: resolvedPatientIds.length,
        incoming_ids: patientIds,
        id_resolution: patientIdLog,
        message,
        effective_practice_id: effectivePracticeId,
      },
    });

    console.log(`Document ${documentId} assigned to ${resolvedPatientIds.length} patients by practice ${effectivePracticeId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Document assigned to ${resolvedPatientIds.length} patient${resolvedPatientIds.length === 1 ? '' : 's'} successfully` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in assign-document-to-patient:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
