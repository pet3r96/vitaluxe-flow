import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { requireAdmin } from '../_shared/roleChecker.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createAdminClient();

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
    try {
      await requireAdmin(supabaseAdmin, user.id, 'Access denied: admin role required');
    } catch (err) {
      const error = err as Error;
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    edgeLogger.info('[sync-user-data] Starting data sync');

    let addedProfiles = 0;
    let addedRoles = 0;
    let repairedPharmacies = 0;
    const repairedProviders = 0;
    const repairedToplines = 0;
    const repairedDownlines = 0;
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
            edgeLogger.info('[sync-user-data] Found orphaned pharmacy, creating user account');
            
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
                errors.push(`Failed to create auth user for pharmacy: ${authError?.message}`);
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
                edgeLogger.info('[sync-user-data] Successfully converted orphaned pharmacy');
              }
            } catch (err: any) {
              edgeLogger.error('[sync-user-data] Error processing orphaned pharmacy', err);
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

    // Step 2: Sync patient_accounts to profiles and roles
    let addedPatientProfiles = 0;
    let addedPatientRoles = 0;
    
    const { data: patientAccounts } = await supabaseAdmin
      .from('patient_accounts')
      .select('user_id, first_name, last_name');
    
    if (patientAccounts) {
      for (const patientAccount of patientAccounts) {
        try {
          const fullName = `${patientAccount.first_name} ${patientAccount.last_name}`.trim();
          
          // Only sync profiles and roles for patients with auth accounts
          if (patientAccount.user_id) {
            // Check if profile needs name update
            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('name')
              .eq('id', patientAccount.user_id)
              .maybeSingle();
            
            if (profile && (profile.name === 'New User' || !profile.name || profile.name === '')) {
              const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .update({ name: fullName, updated_at: new Date().toISOString() })
                .eq('id', patientAccount.user_id);
              
              if (!updateError) {
                addedPatientProfiles++;
              } else {
                errors.push(`Failed to update patient profile name for ${fullName}: ${updateError.message}`);
              }
            }
            
            // Ensure patient role exists
            const { data: existingRole } = await supabaseAdmin
              .from('user_roles')
              .select('id')
              .eq('user_id', patientAccount.user_id)
              .eq('role', 'patient')
              .maybeSingle();
            
            if (!existingRole) {
              const { error: roleError } = await supabaseAdmin
                .from('user_roles')
                .insert({
                  user_id: patientAccount.user_id,
                  role: 'patient'
                });
              
              if (!roleError) {
                addedPatientRoles++;
              } else {
                errors.push(`Failed to add patient role for ${fullName}: ${roleError.message}`);
              }
            }
          }
          // Note: Patients without user_id (no portal account) are skipped - this is expected behavior
        } catch (error: any) {
          errors.push(`Error syncing patient account ${patientAccount.first_name}: ${error.message}`);
        }
      }
    }

    // Step 3: Check all profiles for missing user_roles
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
              edgeLogger.info('[sync-user-data] Profile has no role - skipping', {
                hasProfile: !!profile.name
              });
            }
          }
        } catch (error: any) {
          errors.push(`Error checking roles for profile ${profile.name}: ${error.message}`);
        }
      }
    }

    // Step 4: Backfill missing linked_topline_id for approved practices
    let repLinksAdded = 0;
    let doctorRolesAdded = 0;

    const { data: practicesWithRepAssigned } = await supabaseAdmin
      .from('profiles')
      .select('id, assigned_rep_user_id, linked_topline_id')
      .eq('role', 'doctor')
      .eq('active', true)
      .not('assigned_rep_user_id', 'is', null)
      .is('linked_topline_id', null);

    if (practicesWithRepAssigned && practicesWithRepAssigned.length > 0) {
      for (const practice of practicesWithRepAssigned) {
        try {
          const { error: linkError } = await supabaseAdmin
            .from('profiles')
            .update({
              linked_topline_id: practice.assigned_rep_user_id,
              updated_at: new Date().toISOString()
            })
            .eq('id', practice.id);

          if (!linkError) {
            repLinksAdded++;
            edgeLogger.info('[sync-user-data] Set linked_topline_id for practice', {
              hasPracticeId: !!practice.id
            });
          } else {
            errors.push(`Failed to set linked_topline_id for practice ${practice.id}: ${linkError.message}`);
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
          errors.push(`Error backfilling links for practice ${practice.id}: ${error.message}`);
        }
      }
    }

    // Step 5: Fix missing parent_id relationships
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
      addedPatientProfiles,
      addedPatientRoles,
      repairedPharmacies,
      repairedProviders,
      repairedToplines,
      repairedDownlines,
      orphanedPharmaciesConverted,
      repLinksAdded,
      doctorRolesAdded,
      totalRepaired: totalRepaired + addedPatientProfiles + addedPatientRoles,
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

    edgeLogger.info('Data sync completed', { 
      addedProfiles, 
      addedRoles, 
      repairedPharmacies,
      orphanedPharmaciesConverted
    });

    return new Response(
      JSON.stringify({
        success: true,
        summary
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    edgeLogger.error('Unexpected error in sync-user-data', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
