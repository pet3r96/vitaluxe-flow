import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrphanedPharmacy {
  id: string;
  name: string;
  contact_email: string;
  address: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  states_serviced: string[];
  priority_map: Record<string, number> | null;
}

function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(x => chars[x % chars.length]).join('');
}

async function fixOrphanedPharmacy(
  supabaseAdmin: any,
  pharmacy: OrphanedPharmacy
): Promise<{ success: boolean; userId?: string; tempPassword?: string; error?: string }> {
  
  console.log(`Fixing orphaned pharmacy: ${pharmacy.name} (${pharmacy.contact_email})`);
  
  // Generate temporary password
  const tempPassword = generateSecurePassword();
  
  // Create auth user
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: pharmacy.contact_email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name: pharmacy.name }
  });
  
  if (authError || !authUser) {
    console.error(`Auth creation failed for ${pharmacy.name}:`, authError);
    return { success: false, error: authError?.message || 'Failed to create auth user' };
  }
  
  console.log(`Created auth user for ${pharmacy.name}: ${authUser.user.id}`);
  
  // Use create_user_with_role to set up profile and role
  const { data: roleData, error: roleError } = await supabaseAdmin.rpc(
    'create_user_with_role',
    {
      p_user_id: authUser.user.id,
      p_name: pharmacy.name,
      p_email: pharmacy.contact_email,
      p_role: 'pharmacy',
      p_parent_id: null,
      p_role_data: {
        contactEmail: pharmacy.contact_email,
        statesServiced: pharmacy.states_serviced || [],
        address: pharmacy.address || null
      }
    }
  );
  
  if (roleError) {
    console.error(`Role creation failed for ${pharmacy.name}:`, roleError);
    // Rollback: delete the created user
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
    return { success: false, error: roleError.message };
  }
  
  console.log(`Created profile and role for ${pharmacy.name}`);
  
  // Update the orphaned pharmacy record with the new user_id
  const { error: updateError } = await supabaseAdmin
    .from('pharmacies')
    .update({ user_id: authUser.user.id })
    .eq('id', pharmacy.id);
  
  if (updateError) {
    console.error(`Pharmacy update failed for ${pharmacy.name}:`, updateError);
    // Rollback: delete the created user (this will cascade to profile and roles)
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
    return { success: false, error: updateError.message };
  }
  
  console.log(`Successfully fixed orphaned pharmacy: ${pharmacy.name}`);
  
  return { 
    success: true, 
    userId: authUser.user.id,
    tempPassword
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate requesting user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin user authenticated, searching for orphaned pharmacies...');

    // Find all orphaned pharmacies
    const { data: orphanedPharmacies, error: queryError } = await supabaseAdmin
      .from('pharmacies')
      .select('*')
      .is('user_id', null)
      .eq('active', true);

    if (queryError) {
      console.error('Query error:', queryError);
      return new Response(
        JSON.stringify({ error: queryError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!orphanedPharmacies || orphanedPharmacies.length === 0) {
      console.log('No orphaned pharmacies found');
      return new Response(
        JSON.stringify({ 
          message: 'No orphaned pharmacies found',
          fixed: 0,
          results: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${orphanedPharmacies.length} orphaned pharmacies`);

    // Fix each orphaned pharmacy
    const results = [];
    for (const pharmacy of orphanedPharmacies) {
      const result = await fixOrphanedPharmacy(supabaseAdmin, pharmacy);
      results.push({
        pharmacyId: pharmacy.id,
        pharmacyName: pharmacy.name,
        email: pharmacy.contact_email,
        ...result
      });
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Successfully fixed ${successCount} of ${results.length} orphaned pharmacies`);

    return new Response(
      JSON.stringify({ 
        message: `Fixed ${successCount} of ${results.length} orphaned pharmacies`,
        fixed: successCount,
        total: results.length,
        results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in fix-orphaned-pharmacy function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
