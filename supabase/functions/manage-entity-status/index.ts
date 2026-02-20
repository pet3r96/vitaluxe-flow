import { createAuthClient, createAdminClient } from '../_shared/supabaseAdmin.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { edgeLogger } from '../_shared/logger.ts';

import { validateRequestSize } from '../_shared/requestSizeValidator.ts';
import { isAdmin as checkAdmin } from '../_shared/roleChecker.ts';

/**
 * Consolidated Entity Status Management Endpoint
 * Actions: provider-status, staff-status, practice-room, status-configs
 */

Deno.serve(async (req) => {
  const startTime = Date.now();
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // PHASE 3: Request size validation
    const sizeValidation = validateRequestSize(req, 'manage-entity-status', corsHeaders);
    if (sizeValidation) return sizeValidation;

    const authHeader = req.headers.get('Authorization');
    const supabaseClient = createAuthClient(authHeader);
    const supabaseAdmin = createAdminClient();

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      edgeLogger.logOperation({
        user_id: user?.id,
        ip_address: ipAddress,
        operation: 'manage-entity-status',
        success: false,
        duration_ms: Date.now() - startTime,
        metadata: { error: 'Authentication failed' }
      });
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action } = body;

    edgeLogger.info('[manage-entity-status] Action', { action, userId: user.id });

    switch (action) {
      case 'provider-status': {
        // From manage-provider-status
        const { providerId, active } = body;

        if (!providerId) {
          return new Response(
            JSON.stringify({ error: 'providerId required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: roleData } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();
        
        const role = roleData?.role;
        const isDoctor = role === 'doctor';
        const isAdmin = role === 'admin';
        
        if (!isDoctor && !isAdmin) {
          return new Response(
            JSON.stringify({ error: 'Only practices or admins can manage provider status' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }



        let providerQuery = supabaseClient
          .from('providers')
          .select('user_id, practice_id')
          .eq('id', providerId);
        
        if (isDoctor) {
          providerQuery = providerQuery.eq('practice_id', user.id);
        }
        
        const { data: providerData, error: fetchError } = await providerQuery.single();

        if (fetchError || !providerData) {
          return new Response(
            JSON.stringify({ error: 'Provider not found or access denied' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let updateQuery = supabaseClient
          .from('providers')
          .update({ active, updated_at: new Date().toISOString() })
          .eq('id', providerId);
        
        if (isDoctor) {
          updateQuery = updateQuery.eq('practice_id', user.id);
        }
        
        const { error: updateError } = await updateQuery;
        if (updateError) throw updateError;

        const { error: profileUpdateError } = await supabaseAdmin
          .from('profiles')
          .update({ active, updated_at: new Date().toISOString() })
          .eq('id', providerData.user_id);

        if (profileUpdateError) throw profileUpdateError;

        edgeLogger.logOperation({
          user_id: user.id,
          ip_address: ipAddress,
          operation: 'manage-entity-status:provider-status',
          success: true,
          duration_ms: Date.now() - startTime,
          metadata: { provider_id: providerId, active }
        });
        
        return new Response(
          JSON.stringify({ success: true, message: active ? 'Provider activated' : 'Provider deactivated' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'staff-status': {
        // From manage-staff-status
        const { staffId, active, canOrder } = body;

        if (!staffId) {
          return new Response(
            JSON.stringify({ error: 'Staff ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: roles } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        const userRoles = roles?.map(r => r.role) || [];
        const isAdmin = userRoles.includes('admin');
        const isDoctor = userRoles.includes('doctor');

        if (!isAdmin && !isDoctor) {
          return new Response(
            JSON.stringify({ error: 'Forbidden: Only admins and practice owners can manage staff' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Enforce IP check for non-practice owners
        if (!isDoctor) {
          const ipCheckResponse = await enforceAdminIP(req, supabaseAdmin, 'manage-entity-status:staff-status');
          if (ipCheckResponse) return ipCheckResponse;
        }

        const updateData: any = { updated_at: new Date().toISOString() };
        if (active !== undefined) updateData.active = active;
        if (canOrder !== undefined) updateData.can_order = canOrder;

        const { data, error } = await supabaseAdmin
          .from('practice_staff')
          .update(updateData)
          .eq('user_id', staffId)
          .select()
          .maybeSingle();

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'practice-room': {
        // From manage-practice-room
        const { practiceId, roomId, name, description, color, active, capacity, operation } = body;

        if (!operation || !practiceId) {
          throw new Error('Operation and practice ID are required');
        }

        // Log auth context for debugging
        edgeLogger.info('Room operation attempt', {
          operation,
          practiceId,
          authUserId: user.id,
          userEmail: user.email,
          roomId,
          name
        });

        // Check if user has permission
        const isAdmin = await checkAdmin(supabaseClient, user.id);
        
        // Check if user owns the practice
        const { data: practiceData } = await supabaseClient
          .from('practices')
          .select('owner_id')
          .eq('id', practiceId)
          .single();
        const isPracticeOwner = practiceData?.owner_id === user.id;
        
        // Check if user is staff for this practice
        const { data: staffRecord } = await supabaseClient
          .from('practice_staff')
          .select('id, practice_id')
          .eq('user_id', user.id)
          .eq('practice_id', practiceId)
          .eq('active', true)
          .maybeSingle();
        
        const isStaff = !!staffRecord;

        if (!isAdmin && !isPracticeOwner && !isStaff) {
          edgeLogger.warn('Room operation permission denied', {
            operation,
            practiceId,
            authUserId: user.id,
            isAdmin,
            isPracticeOwner,
            isStaff
          });
          
          return new Response(
            JSON.stringify({ 
              error: 'Permission denied',
              details: 'You must be an admin, practice owner, or active staff member to manage rooms'
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let result;

        if (operation === 'create') {
          if (!name) throw new Error('Room name is required');

          edgeLogger.info('Creating room', {
            practiceId,
            name,
            authUserId: user.id,
            isPracticeOwner,
            isStaff,
            isAdmin
          });

          const { data, error } = await supabaseAdmin
            .from('practice_rooms')
            .insert({
              practice_id: practiceId,
              name,
              description: description || null,
              color: color || '#3B82F6',
              active: active !== undefined ? active : true,
              capacity: capacity || 1,
            })
            .select()
            .single();

          if (error) {
            edgeLogger.error('Failed to create room', {
              error: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint,
              practiceId,
              authUserId: user.id,
              isPracticeOwner,
              isStaff
            });
            
            if (error.code === '42501' || error.message?.includes('policy')) {
              throw new Error('Permission denied: RLS policy violation. Please check that you have permission to manage rooms for this practice.');
            }
            throw error;
          }
          result = { success: true, data };
        } else if (operation === 'update') {
          if (!roomId) throw new Error('Room ID is required for update');

          const updateData: any = { updated_at: new Date().toISOString() };
          if (name !== undefined) updateData.name = name;
          if (description !== undefined) updateData.description = description;
          if (color !== undefined) updateData.color = color;
          if (active !== undefined) updateData.active = active;
          if (capacity !== undefined) updateData.capacity = capacity;

          const { data, error } = await supabaseAdmin
            .from('practice_rooms')
            .update(updateData)
            .eq('id', roomId)
            .eq('practice_id', practiceId)
            .select()
            .single();

          if (error) {
            edgeLogger.error('Failed to update room', {
              error: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint,
              roomId,
              practiceId,
              authUserId: user.id
            });
            
            if (error.code === '42501' || error.message?.includes('policy')) {
              throw new Error('Permission denied: RLS policy violation. Please check that you have permission to manage rooms for this practice.');
            }
            throw error;
          }
          result = { success: true, data };
        } else if (operation === 'delete') {
          if (!roomId) throw new Error('Room ID is required for delete');

          const { error } = await supabaseAdmin
            .from('practice_rooms')
            .delete()
            .eq('id', roomId)
            .eq('practice_id', practiceId);

          if (error) {
            edgeLogger.error('Failed to delete room', {
              error: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint,
              roomId,
              practiceId,
              authUserId: user.id
            });
            
            if (error.code === '42501' || error.message?.includes('policy')) {
              throw new Error('Permission denied: RLS policy violation. Please check that you have permission to manage rooms for this practice.');
            }
            throw error;
          }
          result = { success: true };
        }

        edgeLogger.info('Room operation successful', {
          operation,
          practiceId,
          roomId,
          authUserId: user.id
        });

        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'status-configs': {
        // From manage-status-configs (simplified)
        const { operation, statusConfig } = body;

        const { data: roleData } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (!roleData || roleData.role !== 'admin') {
          return new Response(
            JSON.stringify({ error: 'Admin access required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Enforce IP check for admin-only operations
        const ipCheckResponse = await enforceAdminIP(req, supabaseAdmin, 'manage-entity-status:status-configs');
        if (ipCheckResponse) return ipCheckResponse;

        let result;

        if (operation === 'create') {
          const { data, error } = await supabaseClient
            .from('order_status_configs')
            .insert({
              status_key: statusConfig.status_key,
              display_name: statusConfig.display_name,
              description: statusConfig.description || null,
              color_class: statusConfig.color_class,
              sort_order: statusConfig.sort_order,
              is_active: statusConfig.is_active !== false,
              is_system_default: false,
              created_by: user.id,
            })
            .select()
            .single();

          if (error) throw error;
          result = data;
        } else if (operation === 'update') {
          const updateData: any = { updated_at: new Date().toISOString() };
          if (statusConfig.display_name) updateData.display_name = statusConfig.display_name;
          if (statusConfig.description !== undefined) updateData.description = statusConfig.description;
          if (statusConfig.color_class) updateData.color_class = statusConfig.color_class;
          if (statusConfig.sort_order !== undefined) updateData.sort_order = statusConfig.sort_order;
          if (statusConfig.is_active !== undefined) updateData.is_active = statusConfig.is_active;

          const { data, error } = await supabaseClient
            .from('order_status_configs')
            .update(updateData)
            .eq('id', statusConfig.id)
            .select()
            .single();

          if (error) throw error;
          result = data;
        } else if (operation === 'delete') {
          const { error } = await supabaseClient
            .from('order_status_configs')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', statusConfig.id);

          if (error) throw error;
          result = { success: true };
        }

        return new Response(
          JSON.stringify({ success: true, data: result }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'pharmacy-staff-status': {
        const { staffId, active: staffActive } = body;

        if (!staffId || staffActive === undefined) {
          return new Response(
            JSON.stringify({ error: 'staffId and active are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify the staff member exists and get their pharmacy_id and user_id
        const { data: staffData, error: staffFetchError } = await supabaseAdmin
          .from('pharmacy_staff')
          .select('id, pharmacy_id, user_id')
          .eq('id', staffId)
          .single();

        if (staffFetchError || !staffData) {
          return new Response(
            JSON.stringify({ error: 'Staff member not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify the caller is the pharmacy owner
        const { data: pharmacyData, error: pharmacyError } = await supabaseAdmin
          .from('pharmacies')
          .select('user_id')
          .eq('id', staffData.pharmacy_id)
          .single();

        if (pharmacyError || !pharmacyData || pharmacyData.user_id !== user.id) {
          return new Response(
            JSON.stringify({ error: 'Only the pharmacy owner can manage staff status' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update pharmacy_staff.active
        const { error: staffUpdateError } = await supabaseAdmin
          .from('pharmacy_staff')
          .update({ active: staffActive, updated_at: new Date().toISOString() })
          .eq('id', staffId);

        if (staffUpdateError) throw staffUpdateError;

        // Update profiles.active (controls login ability)
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({ active: staffActive, updated_at: new Date().toISOString() })
          .eq('id', staffData.user_id);

        if (profileError) throw profileError;

        edgeLogger.logOperation({
          user_id: user.id,
          ip_address: ipAddress,
          operation: 'manage-entity-status:pharmacy-staff-status',
          success: true,
          duration_ms: Date.now() - startTime,
          metadata: { staff_id: staffId, active: staffActive }
        });

        return new Response(
          JSON.stringify({ success: true, message: staffActive ? 'Staff account activated' : 'Staff account deactivated' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Invalid action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error: any) {
    edgeLogger.error('Error in manage-entity-status', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
