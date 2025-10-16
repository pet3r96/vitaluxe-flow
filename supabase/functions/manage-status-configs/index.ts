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

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || roleData.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { operation, statusConfig } = await req.json();

    if (!operation) {
      return new Response(JSON.stringify({ error: 'Missing operation' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let result;

    switch (operation) {
      case 'create': {
        if (!statusConfig?.status_key || !statusConfig?.display_name || !statusConfig?.color_class || !statusConfig?.sort_order) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
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
          console.error('Failed to create status config:', error);
          return new Response(JSON.stringify({ error: 'Failed to create status' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        result = data;
        break;
      }

      case 'update': {
        if (!statusConfig?.id) {
          return new Response(JSON.stringify({ error: 'Missing status config ID' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
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
          console.error('Failed to update status config:', error);
          return new Response(JSON.stringify({ error: 'Failed to update status' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        result = data;
        break;
      }

      case 'delete': {
        if (!statusConfig?.id) {
          return new Response(JSON.stringify({ error: 'Missing status config ID' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Check if it's a system default
        const { data: existingConfig } = await supabaseClient
          .from('order_status_configs')
          .select('is_system_default')
          .eq('id', statusConfig.id)
          .single();

        if (existingConfig?.is_system_default) {
          return new Response(JSON.stringify({ error: 'Cannot delete system default status' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Soft delete by setting is_active to false
        const { error } = await supabaseClient
          .from('order_status_configs')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', statusConfig.id);

        if (error) {
          console.error('Failed to deactivate status config:', error);
          return new Response(JSON.stringify({ error: 'Failed to delete status' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        result = { success: true };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid operation' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in manage-status-configs:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});