import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { sendNotificationEmail } from '../_shared/notificationEmailSender.ts';
import { sendNotificationSms } from '../_shared/notificationSmsSender.ts';

// Helper to normalize phone to E.164
function normalizePhoneToE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (phone.startsWith('+')) return phone;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    console.log('[create-provider-document] Invoked');
    
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    
    if (!token) {
      console.error('[create-provider-document] Missing authorization token');
      return new Response(JSON.stringify({ error: 'Missing authorization token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create service role client
    const supabaseAdmin = createAdminClient();

    // Verify user authentication
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      console.error('[create-provider-document] Authentication failed:', userError);
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[create-provider-document] User authenticated:', user.id);

    // Resolve effectivePracticeId robustly
    let effectivePracticeId: string | null = null;

    // Check active impersonation
    const { data: impersonationSession, error: impErr } = await supabaseAdmin
      .from('active_impersonation_sessions')
      .select('impersonated_user_id, impersonated_role, expires_at')
      .eq('admin_user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (impErr) {
      console.error('[create-provider-document] Impersonation lookup error:', impErr);
    }

    if (impersonationSession?.impersonated_user_id) {
      const role = impersonationSession.impersonated_role;
      const impersonatedId = impersonationSession.impersonated_user_id as string;
      console.log('[create-provider-document] Impersonation active:', { role, impersonatedId });

      if (role === 'patient') {
        const { data: patientAccount, error: paErr } = await supabaseAdmin
          .from('patient_accounts')
          .select('practice_id')
          .eq('user_id', impersonatedId)
          .maybeSingle();
        if (paErr) console.error('[create-provider-document] Patient account lookup error:', paErr);
        effectivePracticeId = patientAccount?.practice_id ?? null;
        console.log('[create-provider-document] Resolved practice from patient impersonation:', effectivePracticeId);
      } else if (role === 'staff') {
        // Look up practice_id for impersonated staff
        const { data: staffRecord, error: staffErr } = await supabaseAdmin
          .from('practice_staff')
          .select('practice_id')
          .eq('user_id', impersonatedId)
          .maybeSingle();
        
        if (staffErr) console.error('[create-provider-document] Staff lookup error:', staffErr);
        
        if (staffRecord?.practice_id) {
          effectivePracticeId = staffRecord.practice_id;
          console.log('[create-provider-document] Resolved practice from staff impersonation:', effectivePracticeId);
        } else {
          console.log('[create-provider-document] No practice_staff record, treating as practice owner');
          effectivePracticeId = impersonatedId;
        }
      } else if (role === 'provider') {
        // Look up practice_id for impersonated provider
        const { data: providerRecord, error: provErr } = await supabaseAdmin
          .from('providers')
          .select('practice_id')
          .eq('user_id', impersonatedId)
          .maybeSingle();
        
        if (provErr) console.error('[create-provider-document] Provider lookup error:', provErr);
        
        if (providerRecord?.practice_id) {
          effectivePracticeId = providerRecord.practice_id;
          console.log('[create-provider-document] Resolved practice from provider impersonation:', effectivePracticeId);
        } else {
          console.log('[create-provider-document] No provider record, treating as practice owner');
          effectivePracticeId = impersonatedId;
        }
      } else {
        // For doctor/practice owner impersonation, use their ID directly
        effectivePracticeId = impersonatedId;
        console.log('[create-provider-document] Using impersonated practice owner:', effectivePracticeId);
      }
    }

    // If no impersonation, resolve from current user
    if (!effectivePracticeId) {
      const { data: doctorRole } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'doctor')
        .maybeSingle();

      if (doctorRole) {
        effectivePracticeId = user.id;
        console.log('[create-provider-document] Resolved practice as doctor:', effectivePracticeId);
      } else {
        const { data: providerRow } = await supabaseAdmin
          .from('providers')
          .select('practice_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (providerRow?.practice_id) {
          effectivePracticeId = providerRow.practice_id as string;
          console.log('[create-provider-document] Resolved practice via providers:', effectivePracticeId);
        } else {
          const { data: staffRow } = await supabaseAdmin
            .from('practice_staff')
            .select('practice_id')
            .eq('user_id', user.id)
            .maybeSingle();
          if (staffRow?.practice_id) {
            effectivePracticeId = staffRow.practice_id as string;
            console.log('[create-provider-document] Resolved practice via staff:', effectivePracticeId);
          }
        }
      }
    }

    if (!effectivePracticeId) {
      console.error('[create-provider-document] No practice context');
      return new Response(
        JSON.stringify({ error: 'No practice context', code: 'no_practice_context' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { document_name, document_type, storage_path, file_size, mime_type, tags, notes, patientIds, is_internal } = await req.json();

    console.log('[create-provider-document] Request:', { document_name, document_type, storage_path, patientIds });

    // Validate storage path belongs to this practice
    const expectedPrefix = `${effectivePracticeId}/documents/`;
    console.log('[create-provider-document] Path validation:', { 
      expectedPrefix, 
      storage_path,
      matches: storage_path?.startsWith(expectedPrefix)
    });
    
    if (!storage_path || !storage_path.startsWith(expectedPrefix)) {
      console.error('[create-provider-document] Invalid storage path');
      return new Response(
        JSON.stringify({ error: 'Invalid storage path', code: 'invalid_storage_path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert provider_documents using service role
    const { data: document, error: insertError } = await supabaseAdmin
      .from('provider_documents')
      .insert({
        practice_id: effectivePracticeId,
        document_name,
        document_type,
        storage_path,
        file_size,
        mime_type,
        tags: tags || [],
        notes: notes || null,
        is_internal: is_internal ?? false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[create-provider-document] Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: `Failed to create document: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[create-provider-document] Document created:', document.id);

    // Handle patient assignments if provided
    if (patientIds && patientIds.length > 0) {
      console.log('[create-provider-document] Assigning to patients:', patientIds);

    // Validate that all patients belong to the determined practice using patient_accounts
    const { data: validPatients, error: validationError } = await supabaseAdmin
      .from('patient_accounts')
      .select('id, practice_id')
      .in('id', patientIds);

      if (validationError) {
        console.error('[create-provider-document] Patient validation error:', validationError);
        return new Response(
          JSON.stringify({ error: 'Patient validation failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const invalidPatients = validPatients.filter(p => p.practice_id !== effectivePracticeId);
      if (invalidPatients.length > 0) {
        console.error('[create-provider-document] Invalid patients:', invalidPatients);
        return new Response(
          JSON.stringify({ error: 'Some patients do not belong to your practice', code: 'invalid_patients' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create assignments
      const assignments = patientIds.map((patientId: string) => ({
        document_id: document.id,
        patient_id: patientId,
      }));

      const { error: assignError } = await supabaseAdmin
        .from('provider_document_patients')
        .insert(assignments);

      if (assignError) {
        console.error('[create-provider-document] Assignment error:', assignError);
        return new Response(
          JSON.stringify({ error: 'Document created but assignment failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update legacy assigned_patient_id for single patient
      if (patientIds.length === 1) {
        await supabaseAdmin
          .from('provider_documents')
          .update({ assigned_patient_id: patientIds[0] })
          .eq('id', document.id);
      }

      // Create notifications for patients about new document
      for (const patientId of patientIds) {
        const { data: patientData } = await supabaseAdmin
          .from('patient_accounts')
          .select('user_id, first_name, last_name, email, phone')
          .eq('id', patientId)
          .single();
        
        const notificationTitle = 'New Document Available';
        const notificationMessage = `A new document "${document_name}" has been shared with you.`;
        
        if (patientData?.user_id) {
          // Patient has portal account - standard notification pipeline
          await supabaseAdmin.functions.invoke('handleNotifications', {
            body: {
              user_id: patientData.user_id,
              notification_type: 'document_assigned',
              title: notificationTitle,
              message: notificationMessage,
              metadata: {
                document_id: document.id,
                document_name: document_name,
                practice_id: effectivePracticeId
              }
            }
          });
          console.log(`[create-provider-document] Notification sent for patient ${patientId}`);
        } else {
          // Patient has no portal account - direct email/SMS fallback
          console.log(`[create-provider-document] Fallback: Patient ${patientId} has no user_id`);
          
          if (patientData?.email) {
            const recipientName = `${patientData.first_name || ''} ${patientData.last_name || ''}`.trim() || 'Valued Patient';
            const emailResult = await sendNotificationEmail({
              to: patientData.email,
              recipientName,
              subject: notificationTitle,
              title: notificationTitle,
              message: notificationMessage,
              actionUrl: undefined
            });
            console.log('[create-provider-document] Fallback email:', emailResult.success ? 'sent' : 'failed');
          }
          
          if (patientData?.phone) {
            const normalizedPhone = normalizePhoneToE164(patientData.phone);
            const smsMessage = `${notificationTitle}\n\n${notificationMessage}`;
            const smsResult = await sendNotificationSms({
              phoneNumber: normalizedPhone,
              message: smsMessage,
              metadata: { document_id: document.id, practice_id: effectivePracticeId }
            });
            console.log('[create-provider-document] Fallback SMS:', smsResult.success ? 'sent' : 'failed');
          }
        }
      }

      // Log audit event
      await supabaseAdmin.from('audit_logs').insert({
        user_id: user.id,
        action_type: 'document_assigned',
        entity_type: 'provider_documents',
        entity_id: document.id,
        details: {
          document_name,
          patient_count: patientIds.length,
          practice_id: effectivePracticeId,
        },
      });

      console.log('[create-provider-document] Assignments completed');
    }

    return new Response(
      JSON.stringify({ success: true, document }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[create-provider-document] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
