import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { validateManageProductTypeRequest } from '../_shared/requestValidators.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  operation: 'add' | 'delete' | 'update' | 'getUsage';
  typeName?: string;
  oldTypeName?: string;
  newTypeName?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin access
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: userRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!userRole) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    const validation = validateManageProductTypeRequest(requestData);
    if (!validation.valid) {
      console.warn('Validation failed:', validation.errors);
      return new Response(
        JSON.stringify({ error: 'Invalid request data', details: validation.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { operation, typeName, oldTypeName, newTypeName } = requestData;

    console.log('Product type operation:', operation, { typeName, oldTypeName, newTypeName });

    switch (operation) {
      case 'add': {
        if (!typeName) {
          throw new Error('Type name is required');
        }

        // Note: Adding enum values requires a database migration
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Adding new product types requires a database migration. Please contact an administrator to add new product types to the system.' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        if (!typeName) {
          throw new Error('Type name is required');
        }

        // Check if type is in use
        const { count } = await supabaseClient
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('product_type', typeName);

        if (count && count > 0) {
          throw new Error(`Cannot delete product type that is in use by ${count} product(s)`);
        }

        // Note: PostgreSQL doesn't support DROP VALUE for enums
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Direct deletion of enum values is not supported in PostgreSQL. The type will remain in the database but can be left unused.' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        if (!oldTypeName || !newTypeName) {
          throw new Error('Both old and new type names are required');
        }

        // Note: Renaming enum values requires adding the new value via migration first
        // For now, we'll just inform the user this isn't supported through the UI
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Renaming product types requires a database migration. Please contact an administrator to rename product types.' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getUsage': {
        const { data, error } = await supabaseClient
          .from('products')
          .select('product_type');

        if (error) {
          throw error;
        }

        const counts: Record<string, number> = {};
        data?.forEach((product) => {
          if (product.product_type) {
            counts[product.product_type] = (counts[product.product_type] || 0) + 1;
          }
        });

        return new Response(
          JSON.stringify({ success: true, usage: counts }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error('Invalid operation');
    }
  } catch (error) {
    console.error('Error in manage-product-type function:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing the request' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
