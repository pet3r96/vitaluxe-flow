import { createAuthClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { edgeLogger } from '../_shared/logger.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createAuthClient(req.headers.get('Authorization'));

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { practiceId, blockType, providerId, startTime, endTime, reason, notes } = await req.json();

    // Validation
    if (!practiceId || !blockType || !startTime || !endTime) {
      throw new Error('Missing required fields: practiceId, blockType, startTime, and endTime are required');
    }

    if (blockType === 'provider_unavailable' && !providerId) {
      throw new Error('Provider ID is required for provider unavailable blocks');
    }

    // Validate time range
    if (new Date(endTime) <= new Date(startTime)) {
      throw new Error('End time must be after start time');
    }

    // Check permissions using roleChecker
    const { isAdmin: checkAdmin } = await import('../_shared/roleChecker.ts');
    const isAdmin = await checkAdmin(supabaseClient, user.id);
    const isPracticeOwner = user.id === practiceId;
    
    // Check if user is staff for this practice
    const { data: staffRecord } = await supabaseClient
      .from('practice_staff')
      .select('id')
      .eq('user_id', user.id)
      .eq('practice_id', practiceId)
      .eq('active', true)
      .maybeSingle();
    
    const isStaff = !!staffRecord;

    // Check if user is the provider
    const { data: providerRecord } = providerId ? await supabaseClient
      .from('providers')
      .select('id')
      .eq('id', providerId)
      .eq('user_id', user.id)
      .maybeSingle() : { data: null };
    
    const isOwnProvider = !!providerRecord;

    // Permission check
    if (!isAdmin && !isPracticeOwner && !isStaff && !isOwnProvider) {
      throw new Error('Insufficient permissions to block time');
    }

    // Providers can only block their own time
    if (isOwnProvider && !isPracticeOwner && !isStaff && !isAdmin) {
      if (blockType === 'practice_closure') {
        throw new Error('Providers cannot block the entire practice');
      }
    }

    // Check for conflicting appointments
    const { data: conflicts, error: conflictError } = await supabaseClient
      .rpc('get_appointments_during_blocked_time', {
        p_practice_id: practiceId,
        p_provider_id: blockType === 'provider_unavailable' ? providerId : null,
        p_start_time: startTime,
        p_end_time: endTime
      });

    if (conflictError) {
      edgeLogger.error('Error checking conflicts', conflictError);
    }

    // Create blocked time
    const { data: blockedTime, error: insertError } = await supabaseClient
      .from('practice_blocked_time')
      .insert({
        practice_id: practiceId,
        blocked_by: user.id,
        block_type: blockType,
        provider_id: blockType === 'provider_unavailable' ? providerId : null,
        start_time: startTime,
        end_time: endTime,
        reason,
        notes
      })
      .select()
      .single();

    if (insertError) {
      edgeLogger.error('Failed to insert blocked time', {
        error: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
        practiceId,
        blockType,
        providerId,
        userId: user.id
      });
      throw insertError;
    }

    return successResponse({ 
      blockedTime,
      conflictingAppointments: conflicts || []
    });
  } catch (error: any) {
    edgeLogger.error('Error creating blocked time', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      name: error.name,
      stack: error.stack
    });
    return errorResponse(error.message || 'Failed to create blocked time', 400);
  }
});
