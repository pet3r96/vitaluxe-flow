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

interface ProductType {
  id: string;
  name: string;
  active: boolean;
  count: number;
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

        const trimmedName = typeName.trim();
        
        if (trimmedName.length === 0) {
          return new Response(
            JSON.stringify({ success: false, error: 'Type name cannot be empty' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (trimmedName.length > 50) {
          return new Response(
            JSON.stringify({ success: false, error: 'Type name must be less than 50 characters' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: insertError } = await supabaseClient
          .from('product_types')
          .insert({ name: trimmedName });

        if (insertError) {
          if (insertError.code === '23505') { // Unique constraint violation
            return new Response(
              JSON.stringify({ success: false, error: 'A product type with this name already exists' }),
              { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          throw insertError;
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        if (!typeName) {
          throw new Error('Type name is required');
        }

        // Find the product type ID
        const { data: productType, error: typeError } = await supabaseClient
          .from('product_types')
          .select('id')
          .eq('name', typeName)
          .single();

        if (typeError || !productType) {
          return new Response(
            JSON.stringify({ success: false, error: 'Product type not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if type is in use
        const { count } = await supabaseClient
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('product_type_id', productType.id);

        if (count && count > 0) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Cannot delete product type that is in use by ${count} product(s)` 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Delete the product type
        const { error: deleteError } = await supabaseClient
          .from('product_types')
          .delete()
          .eq('id', productType.id);

        if (deleteError) {
          throw deleteError;
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        if (!oldTypeName || !newTypeName) {
          throw new Error('Both old and new type names are required');
        }

        const trimmedNewName = newTypeName.trim();

        if (trimmedNewName.length === 0) {
          return new Response(
            JSON.stringify({ success: false, error: 'New type name cannot be empty' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (trimmedNewName.length > 50) {
          return new Response(
            JSON.stringify({ success: false, error: 'Type name must be less than 50 characters' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if new name already exists (and it's not the same as the old one)
        if (trimmedNewName !== oldTypeName) {
          const { data: existing } = await supabaseClient
            .from('product_types')
            .select('id')
            .eq('name', trimmedNewName)
            .single();

          if (existing) {
            return new Response(
              JSON.stringify({ success: false, error: 'A product type with this name already exists' }),
              { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // Update the product type
        const { error: updateError } = await supabaseClient
          .from('product_types')
          .update({ name: trimmedNewName, updated_at: new Date().toISOString() })
          .eq('name', oldTypeName);

        if (updateError) {
          throw updateError;
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getUsage': {
        // Get all product types with usage counts
        const { data: productTypes, error: typesError } = await supabaseClient
          .from('product_types')
          .select('id, name, active');

        if (typesError) {
          throw typesError;
        }

        // Get usage counts
        const { data: products, error: productsError } = await supabaseClient
          .from('products')
          .select('product_type_id');

        if (productsError) {
          throw productsError;
        }

        // Count products per type
        const counts: Record<string, number> = {};
        products?.forEach((product) => {
          if (product.product_type_id) {
            counts[product.product_type_id] = (counts[product.product_type_id] || 0) + 1;
          }
        });

        // Build response with counts
        const usage: ProductType[] = (productTypes || []).map(type => ({
          id: type.id,
          name: type.name,
          active: type.active,
          count: counts[type.id] || 0
        }));

        return new Response(
          JSON.stringify({ success: true, usage }),
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
