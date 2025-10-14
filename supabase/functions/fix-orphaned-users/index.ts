import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { generateSecurePassword } from "../_shared/passwordGenerator.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to get all auth user IDs with pagination
async function getAllAuthUserIds(supabaseAdmin: any): Promise<Set<string>> {
  const allUserIds = new Set<string>();
  let page = 0;
  const perPage = 1000; // Max allowed by Supabase
  
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });
    
    if (error) {
      console.error('Error fetching auth users:', error);
      throw error;
    }
    
    if (!data.users || data.users.length === 0) break;
    
    data.users.forEach((u: any) => allUserIds.add(u.id));
    
    if (data.users.length < perPage) break; // Last page
    page++;
  }
  
  console.log(`Fetched ${allUserIds.size} total auth users`);
  return allUserIds;
}

interface OrphanedPharmacy {
  id: string;
  name: string;
  contact_email: string;
  address?: string;
  states_serviced?: string[];
}

interface OrphanedPractice {
  id: string;
  name: string;
  email: string;
  practice_address?: string;
  npi?: string;
  dea?: string;
}

interface OrphanedRep {
  id: string;
  user_id: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  role: string;
  assigned_topline_id?: string;
}

interface OrphanedProvider {
  id: string;
  user_id: string;
  name: string;
  email: string;
  npi?: string;
  license_number?: string;
  practice_id: string;
}

interface FixResult {
  roleType: 'pharmacy' | 'practice' | 'topline' | 'downline' | 'provider';
  entityId: string;
  entityName: string;
  email: string;
  success: boolean;
  userId?: string;
  tempPassword?: string;
  error?: string;
}

interface RoleSummary {
  fixed: number;
  total: number;
}

async function fixOrphanedPharmacy(
  supabaseAdmin: any,
  pharmacy: OrphanedPharmacy
): Promise<FixResult> {
  const tempPassword = generateSecurePassword();
  let createdUserId: string | null = null;

  try {
    console.log(`Creating user for pharmacy: ${pharmacy.name} (${pharmacy.contact_email})`);

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: pharmacy.contact_email,
      password: tempPassword,
      email_confirm: true,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create user');

    createdUserId = authData.user.id;
    console.log(`Created auth user: ${createdUserId}`);

    // Call RPC to create profile and assign role
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('create_user_with_role', {
      p_user_id: createdUserId,
      p_name: pharmacy.name,
      p_email: pharmacy.contact_email,
      p_role: 'pharmacy',
      p_role_data: {
        contactEmail: pharmacy.contact_email,
        address: pharmacy.address,
        statesServiced: pharmacy.states_serviced || [],
      },
    });

    if (rpcError) throw rpcError;
    console.log(`RPC result:`, rpcData);

    // Update pharmacy record with user_id
    const { error: updateError } = await supabaseAdmin
      .from('pharmacies')
      .update({ user_id: createdUserId })
      .eq('id', pharmacy.id);

    if (updateError) throw updateError;

    console.log(`Successfully fixed pharmacy: ${pharmacy.name}`);

    return {
      roleType: 'pharmacy',
      entityId: pharmacy.id,
      entityName: pharmacy.name,
      email: pharmacy.contact_email,
      success: true,
      userId: createdUserId || undefined,
      tempPassword,
    };
  } catch (error: any) {
    console.error(`Failed to fix pharmacy ${pharmacy.name}:`, error);

    // Rollback: delete created auth user if exists
    if (createdUserId) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        console.log(`Rolled back auth user: ${createdUserId}`);
      } catch (rollbackError) {
        console.error(`Failed to rollback user ${createdUserId}:`, rollbackError);
      }
    }

    return {
      roleType: 'pharmacy',
      entityId: pharmacy.id,
      entityName: pharmacy.name,
      email: pharmacy.contact_email,
      success: false,
      error: error.message,
    };
  }
}

async function fixOrphanedPractice(
  supabaseAdmin: any,
  practice: OrphanedPractice
): Promise<FixResult> {
  const tempPassword = generateSecurePassword();
  let createdUserId: string | null = null;

  try {
    console.log(`Creating user for practice: ${practice.name} (${practice.email})`);

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: practice.email,
      password: tempPassword,
      email_confirm: true,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create user');

    createdUserId = authData.user.id;
    console.log(`Created auth user: ${createdUserId}`);

    // Update profile to use this user_id
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ id: createdUserId })
      .eq('id', practice.id);

    if (updateError) throw updateError;

    // Assign doctor role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: createdUserId, role: 'doctor' });

    if (roleError) throw roleError;

    console.log(`Successfully fixed practice: ${practice.name}`);

    return {
      roleType: 'practice',
      entityId: practice.id,
      entityName: practice.name,
      email: practice.email,
      success: true,
      userId: createdUserId || undefined,
      tempPassword,
    };
  } catch (error: any) {
    console.error(`Failed to fix practice ${practice.name}:`, error);

    // Rollback: delete created auth user if exists
    if (createdUserId) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        console.log(`Rolled back auth user: ${createdUserId}`);
      } catch (rollbackError) {
        console.error(`Failed to rollback user ${createdUserId}:`, rollbackError);
      }
    }

    return {
      roleType: 'practice',
      entityId: practice.id,
      entityName: practice.name,
      email: practice.email,
      success: false,
      error: error.message,
    };
  }
}

async function fixOrphanedRep(
  supabaseAdmin: any,
  rep: OrphanedRep
): Promise<FixResult> {
  const tempPassword = generateSecurePassword();
  let createdUserId: string | null = null;

  try {
    console.log(`Creating user for ${rep.role} rep: ${rep.name} (${rep.email})`);

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: rep.email,
      password: tempPassword,
      email_confirm: true,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create user');

    createdUserId = authData.user.id;
    console.log(`Created auth user: ${createdUserId}`);

    // Update profiles table
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: createdUserId,
        name: rep.name,
        email: rep.email,
        company: rep.company,
        phone: rep.phone,
      });

    if (profileError) throw profileError;

    // Assign role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: createdUserId, role: rep.role });

    if (roleError) throw roleError;

    // Update reps table with new user_id
    const { error: updateError } = await supabaseAdmin
      .from('reps')
      .update({ user_id: createdUserId })
      .eq('id', rep.id);

    if (updateError) throw updateError;

    console.log(`Successfully fixed ${rep.role} rep: ${rep.name}`);

    return {
      roleType: rep.role as 'topline' | 'downline',
      entityId: rep.id,
      entityName: rep.name,
      email: rep.email,
      success: true,
      userId: createdUserId || undefined,
      tempPassword,
    };
  } catch (error: any) {
    console.error(`Failed to fix ${rep.role} rep ${rep.name}:`, error);

    // Rollback: delete created auth user if exists
    if (createdUserId) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        console.log(`Rolled back auth user: ${createdUserId}`);
      } catch (rollbackError) {
        console.error(`Failed to rollback user ${createdUserId}:`, rollbackError);
      }
    }

    return {
      roleType: rep.role as 'topline' | 'downline',
      entityId: rep.id,
      entityName: rep.name,
      email: rep.email,
      success: false,
      error: error.message,
    };
  }
}

async function fixOrphanedProvider(
  supabaseAdmin: any,
  provider: OrphanedProvider
): Promise<FixResult> {
  const tempPassword = generateSecurePassword();
  let createdUserId: string | null = null;

  try {
    console.log(`Creating user for provider: ${provider.name} (${provider.email})`);

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: provider.email,
      password: tempPassword,
      email_confirm: true,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create user');

    createdUserId = authData.user.id;
    console.log(`Created auth user: ${createdUserId}`);

    // Update profiles table
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: createdUserId,
        name: provider.name,
        email: provider.email,
        npi: provider.npi,
        license_number: provider.license_number,
      });

    if (profileError) throw profileError;

    // Assign provider role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: createdUserId, role: 'provider' });

    if (roleError) throw roleError;

    // Update providers table with new user_id
    const { error: updateError } = await supabaseAdmin
      .from('providers')
      .update({ user_id: createdUserId })
      .eq('id', provider.id);

    if (updateError) throw updateError;

    console.log(`Successfully fixed provider: ${provider.name}`);

    return {
      roleType: 'provider',
      entityId: provider.id,
      entityName: provider.name,
      email: provider.email,
      success: true,
      userId: createdUserId || undefined,
      tempPassword,
    };
  } catch (error: any) {
    console.error(`Failed to fix provider ${provider.name}:`, error);

    // Rollback: delete created auth user if exists
    if (createdUserId) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        console.log(`Rolled back auth user: ${createdUserId}`);
      } catch (rollbackError) {
        console.error(`Failed to rollback user ${createdUserId}:`, rollbackError);
      }
    }

    return {
      roleType: 'provider',
      entityId: provider.id,
      entityName: provider.name,
      email: provider.email,
      success: false,
      error: error.message,
    };
  }
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

    // Verify admin access
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      throw new Error('Admin access required');
    }

    // Parse request body for optional filters
    const { roleType, entityId } = await req.json().catch(() => ({}));

    const results: FixResult[] = [];
    const summary: Record<string, RoleSummary> = {
      pharmacies: { fixed: 0, total: 0 },
      practices: { fixed: 0, total: 0 },
      topline_reps: { fixed: 0, total: 0 },
      downline_reps: { fixed: 0, total: 0 },
      providers: { fixed: 0, total: 0 },
    };

    // Fix Orphaned Pharmacies
    if (!roleType || roleType === 'pharmacy') {
      const { data: orphanedPharmacies } = await supabaseAdmin
        .from('pharmacies')
        .select('id, name, contact_email, address, states_serviced')
        .is('user_id', null)
        .eq('active', true);

      if (orphanedPharmacies && orphanedPharmacies.length > 0) {
        summary.pharmacies.total = orphanedPharmacies.length;
        console.log(`Found ${orphanedPharmacies.length} orphaned pharmacies`);

        for (const pharmacy of orphanedPharmacies) {
          if (entityId && pharmacy.id !== entityId) continue;
          const result = await fixOrphanedPharmacy(supabaseAdmin, pharmacy);
          results.push(result);
          if (result.success) summary.pharmacies.fixed++;
        }
      }
    }

    // Fix Orphaned Practices - Query user_roles first to find doctor IDs
    if (!roleType || roleType === 'practice') {
      // First, get all doctor user_ids
      const { data: doctorRoles } = await supabaseAdmin
        .from('user_roles')
        .select('user_id')
        .eq('role', 'doctor');

      const doctorIds = doctorRoles?.map(r => r.user_id) || [];

      // Then check which profiles exist with those IDs but aren't in auth.users
      const authUserIds = await getAllAuthUserIds(supabaseAdmin);
      
      const orphanedDoctorIds = doctorIds.filter(id => !authUserIds.has(id));

      if (orphanedDoctorIds.length > 0) {
        const { data: orphanedPractices } = await supabaseAdmin
          .from('profiles')
          .select('id, name, email, practice_address, npi, dea')
          .in('id', orphanedDoctorIds);
        
        if (orphanedPractices && orphanedPractices.length > 0) {
          summary.practices.total = orphanedPractices.length;
          console.log(`Found ${orphanedPractices.length} orphaned practices`);

          for (const practice of orphanedPractices) {
            if (entityId && practice.id !== entityId) continue;
            const result = await fixOrphanedPractice(supabaseAdmin, practice);
            results.push(result);
            if (result.success) summary.practices.fixed++;
          }
        }
      }
    }

    // Fix Orphaned Topline Reps
    if (!roleType || roleType === 'topline') {
      // Get all auth user IDs with pagination
      const authUserIds = await getAllAuthUserIds(supabaseAdmin);

      // Get all topline reps
      const { data: allToplines } = await supabaseAdmin
        .from('reps')
        .select('id, user_id')
        .eq('role', 'topline');

      // Filter to only orphaned ones
      const orphanedToplineIds = allToplines?.filter(r => !authUserIds.has(r.user_id)).map(r => r.id) || [];

      let orphanedToplines: any[] = [];
      if (orphanedToplineIds.length > 0) {
        const { data } = await supabaseAdmin
          .from('reps')
          .select('id, user_id')
          .in('id', orphanedToplineIds);
        
        // Get profile data separately
        if (data) {
          for (const rep of data) {
            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('name, email, company, phone')
              .eq('id', rep.user_id)
              .single();
            
            if (profile) {
              orphanedToplines.push({
                ...rep,
                name: profile.name,
                email: profile.email,
                company: profile.company,
                phone: profile.phone,
              });
            }
          }
        }
      }

      if (orphanedToplines && orphanedToplines.length > 0) {
        summary.topline_reps.total = orphanedToplines.length;
        console.log(`Found ${orphanedToplines.length} orphaned topline reps`);

        for (const rep of orphanedToplines) {
          if (entityId && rep.id !== entityId) continue;
          const result = await fixOrphanedRep(supabaseAdmin, {
            ...rep,
            role: 'topline',
          });
          results.push(result);
          if (result.success) summary.topline_reps.fixed++;
        }
      }
    }

    // Fix Orphaned Downline Reps
    if (!roleType || roleType === 'downline') {
      // Get all auth user IDs with pagination
      const authUserIds = await getAllAuthUserIds(supabaseAdmin);

      // Get all downline reps
      const { data: allDownlines } = await supabaseAdmin
        .from('reps')
        .select('id, user_id, assigned_topline_id')
        .eq('role', 'downline');

      // Filter to only orphaned ones
      const orphanedDownlineIds = allDownlines?.filter(r => !authUserIds.has(r.user_id)).map(r => r.id) || [];

      let orphanedDownlines: any[] = [];
      if (orphanedDownlineIds.length > 0) {
        const { data } = await supabaseAdmin
          .from('reps')
          .select('id, user_id, assigned_topline_id')
          .in('id', orphanedDownlineIds);
        
        // Get profile data separately
        if (data) {
          for (const rep of data) {
            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('name, email, company, phone')
              .eq('id', rep.user_id)
              .single();
            
            if (profile) {
              orphanedDownlines.push({
                ...rep,
                name: profile.name,
                email: profile.email,
                company: profile.company,
                phone: profile.phone,
              });
            }
          }
        }
      }

      if (orphanedDownlines && orphanedDownlines.length > 0) {
        summary.downline_reps.total = orphanedDownlines.length;
        console.log(`Found ${orphanedDownlines.length} orphaned downline reps`);

        for (const rep of orphanedDownlines) {
          if (entityId && rep.id !== entityId) continue;
          const result = await fixOrphanedRep(supabaseAdmin, {
            ...rep,
            role: 'downline',
          });
          results.push(result);
          if (result.success) summary.downline_reps.fixed++;
        }
      }
    }

    // Fix Orphaned Providers
    if (!roleType || roleType === 'provider') {
      // Get all auth user IDs with pagination
      const authUserIds = await getAllAuthUserIds(supabaseAdmin);

      // Get all providers
      const { data: allProviders } = await supabaseAdmin
        .from('providers')
        .select('id, user_id, npi, license_number, practice_id');

      // Filter to only orphaned ones
      const orphanedProviderIds = allProviders?.filter(p => !authUserIds.has(p.user_id)).map(p => p.id) || [];

      let orphanedProviders: any[] = [];
      if (orphanedProviderIds.length > 0) {
        const { data } = await supabaseAdmin
          .from('providers')
          .select('id, user_id, npi, license_number, practice_id')
          .in('id', orphanedProviderIds);
        
        // Get profile data separately
        if (data) {
          for (const provider of data) {
            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('name, email')
              .eq('id', provider.user_id)
              .single();
            
            if (profile) {
              orphanedProviders.push({
                ...provider,
                name: profile.name,
                email: profile.email,
              });
            }
          }
        }
      }

      if (orphanedProviders && orphanedProviders.length > 0) {
        summary.providers.total = orphanedProviders.length;
        console.log(`Found ${orphanedProviders.length} orphaned providers`);

        for (const provider of orphanedProviders) {
          if (entityId && provider.id !== entityId) continue;
          const result = await fixOrphanedProvider(supabaseAdmin, provider);
          results.push(result);
          if (result.success) summary.providers.fixed++;
        }
      }
    }

    const totalFixed = Object.values(summary).reduce((sum, s) => sum + s.fixed, 0);
    const totalOrphaned = Object.values(summary).reduce((sum, s) => sum + s.total, 0);

    return new Response(
      JSON.stringify({
        message: totalFixed === 0
          ? 'No orphaned users found'
          : `Fixed ${totalFixed} of ${totalOrphaned} orphaned users`,
        summary,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in fix-orphaned-users:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
