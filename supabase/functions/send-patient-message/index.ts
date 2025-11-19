import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { sendMessageSchema, validateInput } from '../_shared/zodSchemas.ts';
import { generateNotificationEmailHTML, generateNotificationEmailText } from '../_shared/emailTemplates.ts';
import { sendNotificationSms } from '../_shared/notificationSmsSender.ts';
import { edgeLogger } from '../_shared/logger.ts';

// Helper to normalize phone to E.164
function normalizePhoneToE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (phone.startsWith('+')) return phone;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
  
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    edgeLogger.info('send-patient-message invoked', { ipAddress });
    
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    
    if (!token) {
      edgeLogger.error('Missing authorization token');
      return new Response(JSON.stringify({ error: 'Missing authorization token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create service role client for auth and all operations
    const supabaseAdmin = createAdminClient();

    // Verify user authentication
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      edgeLogger.error('Authentication failed', userError);
      edgeLogger.logOperation({
        ip_address: ipAddress,
        operation: 'send-patient-message',
        success: false,
        duration_ms: Date.now() - startTime,
        metadata: { error: 'Authentication failed' }
      });
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    edgeLogger.info('User authenticated for send message');

    // Parse and validate request body with Zod schema
    const body = await req.json();
    const validation = validateInput(sendMessageSchema, body);
    
    if (!validation.success) {
      throw new Error(`Invalid input: ${validation.errors.join(', ')}`);
    }

    const { subject, message, sender_type, patient_id, parent_message_id } = validation.data;
    const thread_id = body.thread_id; // Optional field not in schema

    // Detect mode: provider reply or patient message
    const isProviderMode = sender_type === 'provider' && patient_id;
    edgeLogger.info('Message mode detected', { mode: isProviderMode ? 'provider' : 'patient' });

    // Check for active impersonation session with detailed logging
    const currentTimestamp = new Date().toISOString();
    edgeLogger.info('Checking impersonation for admin user', { userId: user.id, timestamp: currentTimestamp });
    
    const { data: impersonationSession, error: impersonationError } = await supabaseAdmin
      .from('active_impersonation_sessions')
      .select('impersonated_user_id, impersonated_role, expires_at, created_at')
      .eq('admin_user_id', user.id)
      .gt('expires_at', currentTimestamp)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    const hasActiveImpersonation = !!impersonationSession && !impersonationError;
    
    edgeLogger.info('Impersonation query result', { 
      found: hasActiveImpersonation,
      role: impersonationSession?.impersonated_role,
      impersonated_user_id: impersonationSession?.impersonated_user_id,
      expires_at: impersonationSession?.expires_at,
      current_time: currentTimestamp,
      error: impersonationError
    });

    if (impersonationError) {
      edgeLogger.error('Impersonation check error', impersonationError);
    }

    if (!message?.trim()) {
      edgeLogger.error('Message body is required');
      return new Response(JSON.stringify({ error: 'Message body is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === PROVIDER MODE: Provider replying to patient ===
    if (isProviderMode) {
      edgeLogger.info('PROVIDER MODE - Resolving practice context');
      
      let effectivePracticeId: string | null = null;

      // Resolve practice from impersonation first
      if (impersonationSession?.impersonated_user_id) {
        const role = impersonationSession.impersonated_role;
        const impersonatedId = impersonationSession.impersonated_user_id as string;
        edgeLogger.info('Impersonation active', { role, impersonatedId });

        if (role === 'patient') {
          // Resolve practice via patient account
          const { data: patientAccount, error: paErr } = await supabaseAdmin
            .from('patient_accounts')
            .select('practice_id')
            .eq('user_id', impersonatedId)
            .maybeSingle();
          if (paErr) edgeLogger.error('Patient account lookup error', paErr);
          effectivePracticeId = patientAccount?.practice_id ?? null;
          edgeLogger.info('Resolved practice from patient impersonation', { effectivePracticeId });
        } else {
          // Check if impersonated user is a staff member
          const { data: staffRecord } = await supabaseAdmin
            .from('practice_staff')
            .select('practice_id')
            .eq('user_id', impersonatedId)
            .maybeSingle();
          
          if (staffRecord?.practice_id) {
            effectivePracticeId = staffRecord.practice_id;
            edgeLogger.info('Resolved practice from staff impersonation', { effectivePracticeId });
          } else {
            // Check if impersonated user is a provider
            const { data: providerRecord } = await supabaseAdmin
              .from('providers')
              .select('practice_id')
              .eq('user_id', impersonatedId)
              .maybeSingle();
            
            if (providerRecord?.practice_id) {
              effectivePracticeId = providerRecord.practice_id;
              edgeLogger.info('Resolved practice from provider impersonation', { effectivePracticeId });
            } else {
              // Treat impersonated user as practice owner
              effectivePracticeId = impersonatedId;
              edgeLogger.info('Using impersonated user as practice owner', { effectivePracticeId });
            }
          }
        }
      }

      // If no impersonation, resolve from current user
      if (!effectivePracticeId) {
        // Check if user is doctor (practice owner)
        const { data: doctorRole } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'doctor')
          .maybeSingle();

        if (doctorRole) {
          effectivePracticeId = user.id;
          edgeLogger.info('Resolved practice as doctor', { effectivePracticeId });
        } else {
          // Check provider linkage
          const { data: providerRow } = await supabaseAdmin
            .from('providers')
            .select('practice_id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (providerRow?.practice_id) {
            effectivePracticeId = providerRow.practice_id as string;
            edgeLogger.info('Resolved practice via providers', { effectivePracticeId });
          } else {
            // Check practice staff linkage
            const { data: staffRow } = await supabaseAdmin
              .from('practice_staff')
              .select('practice_id')
              .eq('user_id', user.id)
              .maybeSingle();
            if (staffRow?.practice_id) {
              effectivePracticeId = staffRow.practice_id as string;
              edgeLogger.info('Resolved practice via staff', { effectivePracticeId });
            }
          }
        }
      }

      if (!effectivePracticeId) {
        edgeLogger.error('No practice context for provider mode');
        return new Response(
          JSON.stringify({ error: 'No practice context', code: 'no_practice_context' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate patient belongs to this practice
      const { data: patientValidation, error: pvErr } = await supabaseAdmin
        .from('patient_accounts')
        .select('id, practice_id')
        .eq('id', patient_id)
        .maybeSingle();

      edgeLogger.info('Patient validation', { patientValidation, error: pvErr });

      if (pvErr || !patientValidation || patientValidation.practice_id !== effectivePracticeId) {
        edgeLogger.error('Patient access denied');
        return new Response(
          JSON.stringify({ error: 'Patient not found or access denied', code: 'patient_access_denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

    // Determine thread_id for provider message
    let effectiveThreadId = thread_id;
    
    // If parent_message_id provided but no thread_id, fetch parent's thread_id
    if (!effectiveThreadId && parent_message_id) {
      const { data: parentMsg } = await supabaseAdmin
        .from('patient_messages')
        .select('thread_id, id')
        .eq('id', parent_message_id)
        .maybeSingle();
      
      effectiveThreadId = parentMsg?.thread_id || parentMsg?.id;
      edgeLogger.info('Resolved thread_id from parent', { effectiveThreadId });
    }
    
    const isReply = !!parent_message_id;
    
    const providerPayload = {
      patient_id: patient_id,
      practice_id: effectivePracticeId,
      sender_id: user.id,
      sender_type: 'provider',
      message_body: message,
      subject: subject || 'Provider Message',
      read_at: null,
      ...(effectiveThreadId && { thread_id: effectiveThreadId }),
      ...(parent_message_id && { parent_message_id: parent_message_id })
    };

      edgeLogger.info('Inserting provider message', providerPayload);

      const { data: insertedMessage, error: insertError } = await supabaseAdmin
        .from('patient_messages')
        .insert(providerPayload)
        .select()
        .single();

      if (insertError) {
        edgeLogger.error('Insert error', insertError);
        return new Response(
          JSON.stringify({ error: `Failed to send message: ${insertError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If new thread (not a reply), set thread_id = id
      if (!isReply && insertedMessage) {
        const { error: updateError } = await supabaseAdmin
          .from('patient_messages')
          .update({ thread_id: insertedMessage.id })
          .eq('id', insertedMessage.id);
          
        if (updateError) {
          edgeLogger.error('Failed to set thread_id', updateError);
        }
      }

      // Create notification for the patient
      const { data: patientData } = await supabaseAdmin
        .from('patient_accounts')
        .select('user_id, first_name, last_name, email, phone')
        .eq('id', patient_id)
        .single();

      const { data: practiceData } = await supabaseAdmin
        .from('profiles')
        .select('name')
        .eq('id', effectivePracticeId)
        .single();

      const practiceName = practiceData?.name || 'your provider';
      const messageTitle = `New message from ${practiceName}`;
      const messageBody = subject || 'You have a new message';

      if (patientData?.user_id) {
        // Patient has portal account - use standard notification pipeline
        const { error: notificationError } = await supabaseAdmin.functions.invoke('handleNotifications', {
          body: {
            user_id: patientData.user_id,
            notification_type: 'practice_message_received',
            title: messageTitle,
            message: messageBody,
            metadata: {
              message_id: insertedMessage.id,
              patient_id: patient_id,
              practice_id: effectivePracticeId,
              thread_id: insertedMessage.thread_id || insertedMessage.id
            },
            action_url: '/messages',
            entity_type: 'message',
            entity_id: insertedMessage.id
          }
        });

        if (notificationError) {
          edgeLogger.error('Failed to create patient notification', notificationError);
        } else {
          edgeLogger.info('Patient notification created successfully');
        }
      } else {
        // Patient has no portal account - send email/SMS directly via fallback
        edgeLogger.info('Fallback: Patient has no user_id, sending direct email/SMS');
        
        if (patientData?.email) {
          const recipientName = `${patientData.first_name || ''} ${patientData.last_name || ''}`.trim() || 'Valued Patient';
          const htmlBody = generateNotificationEmailHTML({
            recipientName,
            title: messageTitle,
            message: messageBody,
            actionUrl: undefined
          });
          const textBody = generateNotificationEmailText({
            recipientName,
            title: messageTitle,
            message: messageBody,
            actionUrl: undefined
          });
          
          const { data: emailResult, error: emailError } = await supabaseAdmin.functions.invoke('unified-email-sender', {
            body: {
              type: 'notification',
              to: patientData.email,
              subject: messageTitle,
              htmlBody,
              textBody,
              userId: patientData.user_id,
              eventType: 'new_message'
            }
          });
          
          edgeLogger.info('Fallback email result', { emailResult });
        }
        
        if (patientData?.phone) {
          const normalizedPhone = normalizePhoneToE164(patientData.phone);
          const smsMessage = `${messageTitle}\n\n${messageBody}`;
          
          const smsResult = await sendNotificationSms({
            phoneNumber: normalizedPhone,
            message: smsMessage,
            metadata: { patient_id, practice_id: effectivePracticeId }
          });
          
          edgeLogger.info('Fallback SMS result', { smsResult });
        }
        
        if (!patientData?.email && !patientData?.phone) {
          edgeLogger.warn('No email or phone for patient without user_id - no notification sent');
        }
      }

      edgeLogger.info('Provider message sent successfully');
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === PATIENT MODE: Patient sending message ===
    edgeLogger.info('PATIENT MODE - Resolving patient context');
    
    let effectiveUserId = user.id;
    let isImpersonating = false;

    // Check for impersonation and use impersonated user if available
    if (hasActiveImpersonation && impersonationSession?.impersonated_user_id) {
      effectiveUserId = impersonationSession.impersonated_user_id as string;
      isImpersonating = true;
      edgeLogger.info('Admin impersonating patient user', { adminId: user.id, effectiveUserId });
    } else {
      edgeLogger.info('No impersonation - using direct user', { effectiveUserId });
    }

    edgeLogger.info('Effective user ID', { effectiveUserId, isImpersonating });

    // Get patient account
    const { data: patientAccount, error: patientError } = await supabaseAdmin
      .from('patient_accounts')
      .select('id, practice_id')
      .eq('user_id', effectiveUserId)
      .maybeSingle();

    edgeLogger.info('Patient account lookup', { patientAccount, error: patientError });

    if (patientError || !patientAccount) {
      edgeLogger.error('Patient account not found');
      return new Response(JSON.stringify({ error: 'Patient account not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!patientAccount.practice_id) {
      edgeLogger.error('No practice assigned');
      return new Response(JSON.stringify({ error: 'No practice assigned to your account' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine thread_id for patient message
    let effectiveThreadId = thread_id;
    
    // If parent_message_id provided but no thread_id, fetch parent's thread_id
    if (!effectiveThreadId && parent_message_id) {
      const { data: parentMsg } = await supabaseAdmin
        .from('patient_messages')
        .select('thread_id, id')
        .eq('id', parent_message_id)
        .maybeSingle();
      
      effectiveThreadId = parentMsg?.thread_id || parentMsg?.id;
      edgeLogger.info('Resolved thread_id from parent', { effectiveThreadId });
    }
    
    const isReply = !!parent_message_id;
    
    const patientPayload = {
      patient_id: patientAccount.id,
      practice_id: patientAccount.practice_id,
      sender_id: effectiveUserId,
      sender_type: 'patient',
      message_body: message,
      subject: subject || 'Patient Message',
      read_at: null,
      ...(effectiveThreadId && { thread_id: effectiveThreadId }),
      ...(parent_message_id && { parent_message_id: parent_message_id })
    };

    edgeLogger.info('Inserting patient message', patientPayload);

    const { data: insertedMessage, error: insertError } = await supabaseAdmin
      .from('patient_messages')
      .insert(patientPayload)
      .select()
      .single();

    if (insertError) {
      edgeLogger.error('Insert error', insertError);
      return new Response(
        JSON.stringify({ error: `Failed to send message: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If new thread (not a reply), set thread_id = id
    if (!isReply && insertedMessage) {
      const { error: updateError } = await supabaseAdmin
        .from('patient_messages')
        .update({ thread_id: insertedMessage.id })
        .eq('id', insertedMessage.id);
        
      if (updateError) {
        edgeLogger.error('Failed to set thread_id', updateError);
      }
    }

    // Create notifications for practice team members
    const { data: patientInfo } = await supabaseAdmin
      .from('patient_accounts')
      .select('first_name, last_name')
      .eq('id', patientAccount.id)
      .single();

    // Get all team members (doctor + providers + staff) for this practice
    const { data: practiceTeam } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', patientAccount.practice_id);

    const { data: providers } = await supabaseAdmin
      .from('providers')
      .select('user_id')
      .eq('practice_id', patientAccount.practice_id);

    const { data: staff } = await supabaseAdmin
      .from('practice_staff')
      .select('user_id')
      .eq('practice_id', patientAccount.practice_id);

    // Combine all team member IDs
    const teamMemberIds = [
      ...(practiceTeam?.map(p => p.id) || []),
      ...(providers?.map(p => p.user_id) || []),
      ...(staff?.map(s => s.user_id) || [])
    ].filter(Boolean);

    if (teamMemberIds.length > 0) {
      // Send notification to each team member via unified system
      for (const memberId of teamMemberIds) {
        const { error: notificationError } = await supabaseAdmin.functions.invoke('handleNotifications', {
          body: {
            user_id: memberId,
            notification_type: 'message',
            title: `New message from ${patientInfo?.first_name || ''} ${patientInfo?.last_name || ''}`.trim() || 'Patient',
            message: subject || 'You have a new patient message',
            metadata: {
              message_id: insertedMessage.id,
              patient_id: patientAccount.id,
              practice_id: patientAccount.practice_id,
              thread_id: insertedMessage.thread_id || insertedMessage.id
            },
            action_url: '/messages',
            entity_type: 'message',
            entity_id: insertedMessage.id
          }
        });

        if (notificationError) {
          edgeLogger.error('Failed to create team notification', notificationError);
        }
      }
      
      edgeLogger.info('Created notifications for team members', { count: teamMemberIds.length });
    }

    // Log successful operation
    edgeLogger.logOperation({
      user_id: user.id,
      ip_address: ipAddress,
      operation: 'send-patient-message',
      success: true,
      duration_ms: Date.now() - startTime,
      metadata: {
        thread_id: insertedMessage.thread_id || insertedMessage.id,
        message_id: insertedMessage.id,
        is_provider_mode: false
      }
    });

    edgeLogger.info('Patient message sent successfully');
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    edgeLogger.error('Unexpected error', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
