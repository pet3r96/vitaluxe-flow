import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { validateManageStatusConfigRequest } from '../_shared/requestValidators.ts';
import { handleError, createErrorResponse } from '../_shared/errorHandler.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    }
  );

  let requestData: any;

  try {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return createErrorResponse('Unauthorized', 401, null, undefined, corsHeaders);
    }

    // Check if user is admin
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || roleData.role !== 'admin') {
      return createErrorResponse('Admin access required', 403, null, undefined, corsHeaders);
    }

    // Parse request body
    try {
      requestData = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return createErrorResponse('Invalid JSON in request body', 400, null, undefined, corsHeaders);
    }

    // Validate input
    const validation = validateManageStatusConfigRequest(requestData);
    if (!validation.valid) {
      console.error('Status config validation failed:', validation.errors);
      return createErrorResponse(
        'Invalid status configuration data',
        400,
        null,
        validation.errors,
        corsHeaders
      );
    }

    const { operation, statusConfig, statusConfigId } = requestData;

    let result;

    switch (operation) {
      case 'create': {
        if (!statusConfig?.status_key || !statusConfig?.display_name || !statusConfig?.color_class || !statusConfig?.sort_order) {
          return createErrorResponse('Missing required fields for create operation', 400, null, undefined, corsHeaders);
        }

        const { data, error } = await supabaseClient
          .from('order_status_configs')
          .insert({
            status_key: statusConfig.status_key,
            display_name: statusConfig.display_name,
            description: statusConfig.description || null,
            color_class: statusConfig.color_class,
            icon_name: statusConfig.icon_name || null,
            sort_order: statusConfig.sort_order,
            is_active: statusConfig.is_active !== false,
            is_system_default: false,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) {
          console.error('Failed to create status config:', error.message);
          return handleError(
            supabaseClient,
            error,
            'manage-status-configs',
            'database',
            corsHeaders,
            { operation: 'create', status_key: statusConfig.status_key }
          );
        }

        result = data;
        break;
      }

      case 'update': {
        if (!statusConfig?.id) {
          return createErrorResponse('Missing status config ID for update operation', 400, null, undefined, corsHeaders);
        }

        const updateData: any = {
          updated_at: new Date().toISOString(),
        };

        if (statusConfig.display_name) updateData.display_name = statusConfig.display_name;
        if (statusConfig.description !== undefined) updateData.description = statusConfig.description;
        if (statusConfig.color_class) updateData.color_class = statusConfig.color_class;
        if (statusConfig.icon_name !== undefined) updateData.icon_name = statusConfig.icon_name;
        if (statusConfig.sort_order !== undefined) updateData.sort_order = statusConfig.sort_order;
        if (statusConfig.is_active !== undefined) updateData.is_active = statusConfig.is_active;

        const { data, error } = await supabaseClient
          .from('order_status_configs')
          .update(updateData)
          .eq('id', statusConfig.id)
          .select()
          .single();

        if (error) {
          console.error('Failed to update status config:', error.message);
          return handleError(
            supabaseClient,
            error,
            'manage-status-configs',
            'database',
            corsHeaders,
            { operation: 'update', status_config_id: statusConfig.id }
          );
        }

        result = data;
        break;
      }

      case 'delete': {
        if (!statusConfig?.id) {
          return createErrorResponse('Missing status config ID for delete operation', 400, null, undefined, corsHeaders);
        }

        // Check if it's a system default
        const { data: existingConfig } = await supabaseClient
          .from('order_status_configs')
          .select('is_system_default')
          .eq('id', statusConfig.id)
          .single();

        if (existingConfig?.is_system_default) {
          return createErrorResponse('Cannot delete system default status', 400, null, undefined, corsHeaders);
        }

        // Soft delete by setting is_active to false
        const { error } = await supabaseClient
          .from('order_status_configs')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', statusConfig.id);

        if (error) {
          console.error('Failed to deactivate status config:', error.message);
          return handleError(
            supabaseClient,
            error,
            'manage-status-configs',
            'database',
            corsHeaders,
            { operation: 'delete', status_config_id: statusConfig.id }
          );
        }

        result = { success: true };
        break;
      }

      default:
        return createErrorResponse('Invalid operation. Must be create, update, or delete', 400, null, undefined, corsHeaders);
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Status config management error:', error);
    return handleError(
      supabaseClient,
      error,
      'manage-status-configs',
      'internal',
      corsHeaders,
      { operation: requestData?.operation }
    );
  }
});
