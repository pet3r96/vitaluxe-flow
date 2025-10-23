import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get the requesting user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin role
    const { data: roleCheck, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleCheck) {
      return new Response(
        JSON.stringify({ error: 'Access denied: admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting data sync...');

    let addedProfiles = 0;
    let addedRoles = 0;
    let repairedPharmacies = 0;
    let repairedProviders = 0;
    let repairedToplines = 0;
    let repairedDownlines = 0;
    let orphanedPharmaciesConverted = 0;
    const errors: string[] = [];

    // Step 1: Scan pharmacies for missing profiles/roles OR orphaned entries
    const { data: pharmacies } = await supabaseAdmin
      .from('pharmacies')
      .select('*');

    if (pharmacies) {
      for (const pharmacy of pharmacies) {
        try {
          // Case A: Pharmacy has no user_id (manually created in database)
          if (!pharmacy.user_id) {
            console.log(`Found orphaned pharmacy: ${pharmacy.name} - creating complete user account`);
            
            try {
              // Step 1: Create auth user
              const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email: pharmacy.contact_email,
                email_confirm: true,
                password: crypto.randomUUID(), // Auto-generated secure password
                user_metadata: {
                  name: pharmacy.name,
                  role: 'pharmacy'
                }
              });

              if (authError || !authUser.user) {
                errors.push(`Failed to create auth user for pharmacy ${pharmacy.name}: ${authError?.message}`);
                continue;
              }

              // Step 2: Create profile (will be created by handle_new_user trigger, but ensure it's there)
              const { data: profile, error: profileError } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .eq('id', authUser.user.id)
                .maybeSingle();

              if (!profile) {
                // Manually create if trigger didn't fire
                const { error: createError } = await supabaseAdmin
                  .from('profiles')
                  .insert({
                    id: authUser.user.id,
                    name: pharmacy.name,
                    email: pharmacy.contact_email,
                    parent_id: pharmacy.parent_id || user.id,
                    active: true
                  });

                if (createError) {
                  errors.push(`Failed to create profile for pharmacy ${pharmacy.name}: ${createError.message}`);
                  continue;
                }
                addedProfiles++;
              }

              // Step 3: Create user role
              const { error: roleError } = await supabaseAdmin
                .from('user_roles')
                .insert({
                  user_id: authUser.user.id,
                  role: 'pharmacy'
                });

              if (roleError) {
                errors.push(`Failed to create role for pharmacy ${pharmacy.name}: ${roleError.message}`);
              } else {
                addedRoles++;
              }

              // Step 4: Link pharmacy to the new user
              const { error: updateError } = await supabaseAdmin
                .from('pharmacies')
                .update({ 
                  user_id: authUser.user.id,
                  parent_id: pharmacy.parent_id || user.id
                })
                .eq('id', pharmacy.id);

              if (updateError) {
                errors.push(`Failed to link pharmacy ${pharmacy.name} to user: ${updateError.message}`);
              } else {
                orphanedPharmaciesConverted++;
                repairedPharmacies++;
                console.log(`Successfully converted orphaned pharmacy: ${pharmacy.name}`);
              }
            } catch (err: any) {
              errors.push(`Error processing orphaned pharmacy ${pharmacy.name}: ${err.message}`);
            }
            
            continue;
          }

          // Case B: Pharmacy has user_id - check if profile exists
          if (pharmacy.user_id) {
            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('id')
              .eq('id', pharmacy.user_id)
              .maybeSingle();

            if (!profile) {
              // Create missing profile
              const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .insert({
                  id: pharmacy.user_id,
                  name: pharmacy.name,
                  email: pharmacy.contact_email,
                  parent_id: pharmacy.parent_id || user.id,
                  active: pharmacy.active
                });

              if (!profileError) {
                addedProfiles++;
              } else {
                errors.push(`Failed to create profile for pharmacy ${pharmacy.name}: ${profileError.message}`);
              }
            }

            // Check if user_role exists
            const { data: role } = await supabaseAdmin
              .from('user_roles')
              .select('id')
              .eq('user_id', pharmacy.user_id)
              .eq('role', 'pharmacy')
              .maybeSingle();

            if (!role) {
              const { error: roleError } = await supabaseAdmin
                .from('user_roles')
                .insert({
                  user_id: pharmacy.user_id,
                  role: 'pharmacy'
                });

              if (!roleError) {
                addedRoles++;
              } else {
                errors.push(`Failed to create role for pharmacy ${pharmacy.name}: ${roleError.message}`);
              }
            }

            repairedPharmacies++;
          }
        } catch (error: any) {
          errors.push(`Error processing pharmacy ${pharmacy.name}: ${error.message}`);
        }
      }
    }

    // Step 2: Check all profiles for missing user_roles
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        name,
        email,
        user_roles(role)
      `);

    if (profiles) {
      for (const profile of profiles) {
        try {
          if (!profile.user_roles || profile.user_roles.length === 0) {
            // Try to determine role from related tables
            const { data: pharmacy } = await supabaseAdmin
              .from('pharmacies')
              .select('id')
              .eq('user_id', profile.id)
              .maybeSingle();

            if (pharmacy) {
              const { error: roleError } = await supabaseAdmin
                .from('user_roles')
                .insert({
                  user_id: profile.id,
                  role: 'pharmacy'
                });

              if (!roleError) {
                addedRoles++;
                repairedPharmacies++;
              }
            } else {
              // Default to admin if no role can be determined
              console.log(`Profile ${profile.name} has no role - skipping`);
            }
          }
        } catch (error: any) {
          errors.push(`Error checking roles for profile ${profile.name}: ${error.message}`);
        }
      }
    }

    // Step 3: Backfill missing rep_practice_links for approved practices
    // Now handles BOTH toplines AND downlines as owners
    let repLinksAdded = 0;
    let doctorRolesAdded = 0;

    const { data: practicesWithTopline } = await supabaseAdmin
      .from('profiles')
      .select('id, name, linked_topline_id')
      .not('linked_topline_id', 'is', null)
      .eq('active', true);

    if (practicesWithTopline) {
      for (const practice of practicesWithTopline) {
        try {
          // Look up the rep in 'reps' table - could be topline OR downline
          // Priority: downline first, then topline (downlines are more specific)
          let repRecord = null;
          
          const { data: downlineRep } = await supabaseAdmin
            .from('reps')
            .select('id, role')
            .eq('user_id', practice.linked_topline_id)
            .eq('role', 'downline')
            .maybeSingle();

          if (downlineRep) {
            repRecord = downlineRep;
          } else {
            const { data: toplineRep } = await supabaseAdmin
              .from('reps')
              .select('id, role')
              .eq('user_id', practice.linked_topline_id)
              .eq('role', 'topline')
              .maybeSingle();
            
            if (toplineRep) {
              repRecord = toplineRep;
            }
          }

          if (repRecord) {
            // Upsert rep_practice_link (works for both toplines and downlines)
            const { error: linkError } = await supabaseAdmin
              .from('rep_practice_links')
              .upsert({
                rep_id: repRecord.id,
                practice_id: practice.id
              }, { onConflict: 'rep_id,practice_id' });

            if (!linkError) {
              repLinksAdded++;
              console.log(`Linked practice ${practice.name} to ${repRecord.role} rep ${repRecord.id}`);
            } else {
              errors.push(`Failed to link practice ${practice.name}: ${linkError.message}`);
            }
          } else {
            console.log(`No rep found for practice ${practice.name} with linked_topline_id ${practice.linked_topline_id}`);
          }

          // Ensure user_roles has 'doctor' (normalize from legacy 'practice' role)
          const { data: existingRole } = await supabaseAdmin
            .from('user_roles')
            .select('role')
            .eq('user_id', practice.id)
            .eq('role', 'doctor')
            .maybeSingle();

          if (!existingRole) {
            const { error: roleError } = await supabaseAdmin
              .from('user_roles')
              .upsert({
                user_id: practice.id,
                role: 'doctor'
              }, { onConflict: 'user_id,role' });

            if (!roleError) {
              doctorRolesAdded++;
            }
          }
        } catch (error: any) {
          errors.push(`Error backfilling links for practice ${practice.name}: ${error.message}`);
        }
      }
    }

    // Step 4: Fix missing parent_id relationships
    const { data: pharmaciesWithoutParent } = await supabaseAdmin
      .from('pharmacies')
      .select('id, user_id, name')
      .is('parent_id', null);

    if (pharmaciesWithoutParent) {
      for (const pharmacy of pharmaciesWithoutParent) {
        const { error } = await supabaseAdmin
          .from('pharmacies')
          .update({ parent_id: user.id })
          .eq('id', pharmacy.id);

        if (error) {
          errors.push(`Failed to set parent for pharmacy ${pharmacy.name}: ${error.message}`);
        }
      }
    }

    const totalRepaired = addedProfiles + addedRoles + repairedPharmacies + repLinksAdded + doctorRolesAdded;

    // Log the sync event
    const summary = {
      addedProfiles,
      addedRoles,
      repairedPharmacies,
      repairedProviders,
      repairedToplines,
      repairedDownlines,
      orphanedPharmaciesConverted,
      repLinksAdded,
      doctorRolesAdded,
      totalRepaired,
      errors: errors.length > 0 ? errors : null
    };

    await supabaseAdmin
      .from('sync_logs')
      .insert({
        admin_id: user.id,
        added_profiles: addedProfiles,
        added_roles: addedRoles,
        repaired_pharmacies: repairedPharmacies,
        repaired_providers: repairedProviders,
        repaired_toplines: repairedToplines,
        repaired_downlines: repairedDownlines,
        orphaned_pharmacies_converted: orphanedPharmaciesConverted,
        total_repaired: totalRepaired,
        summary
      });

    console.log('Data sync completed', summary);

    return new Response(
      JSON.stringify({
        success: true,
        summary
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Unexpected error in sync-user-data:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
