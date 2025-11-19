import { createAuthClient, createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { validateUserOwnsResource } from '../_shared/idValidator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createAuthClient(req.headers.get('Authorization'));

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      edgeLogger.error('[list-providers] Auth error', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    edgeLogger.info('User authenticated', { userId: user.id });

    const supabaseAdmin = createAdminClient();

    // Get user's role and practice using roleChecker
    const { getUserRoles } = await import('../_shared/roleChecker.ts');
    const roles = await getUserRoles(supabaseClient, user.id);
    edgeLogger.info('User roles', { roles });

    let practiceId: string | null = null;
    let practiceIdSource = 'none';

    // Accept practice_id from body (for impersonation) or query string
    const url = new URL(req.url);
    const queryPracticeId = url.searchParams.get('practice_id');
    let bodyPracticeId: string | null = null;
    
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        bodyPracticeId = body.practice_id || null;
      } catch (e) {
        // No body or invalid JSON, that's OK
      }
    }

    if (roles.includes('admin')) {
      // Admins: prefer body practice_id (impersonation), then query param
      practiceId = bodyPracticeId || queryPracticeId;
      practiceIdSource = bodyPracticeId ? 'body' : queryPracticeId ? 'query' : 'none';
      
      // PHASE 3: ID validation for admin accessing specific practice
      if (practiceId) {
        const { valid, error: idError } = await validateUserOwnsResource(
          supabaseAdmin,
          user.id,
          'practice',
          practiceId
        );
        if (!valid && !roles.includes('admin')) {
          edgeLogger.error('ID validation failed', undefined, { error: idError, userId: user.id, practiceId });
          return new Response(
            JSON.stringify({ error: idError || 'Access denied' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } else if (roles.includes('doctor')) {
      // Doctor: their user_id IS the practice_id
      practiceId = user.id;
      practiceIdSource = 'computed-doctor';
    } else if (roles.includes('staff')) {
      // Staff: look up their practice_id from practice_staff table
      const { data: staffData } = await supabaseClient
        .from('practice_staff')
        .select('practice_id')
        .eq('user_id', user.id)
        .eq('active', true)
        .maybeSingle();
      
      edgeLogger.info('Staff lookup', {
        userId: user.id,
        staffData,
        practiceId: staffData?.practice_id
      });
      
      if (!staffData || !staffData.practice_id) {
        edgeLogger.warn('Staff has no active providers record', { userId: user.id });
        return new Response(
          JSON.stringify({ providers: [], error: 'Staff membership not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      
      practiceId = staffData.practice_id;
      practiceIdSource = 'computed-staff';
    } else if (roles.includes('provider')) {
      // Provider: can only see themselves
      const { data: providerData } = await supabaseClient
        .from('providers')
        .select(`
          id,
          user_id,
          practice_id,
          role_type,
          can_order,
          active,
          created_at,
          profiles!providers_user_id_fkey!inner(
            id,
            name,
            full_name,
            prescriber_name,
            email,
            phone,
            address,
            npi,
            dea,
            license_number
          )
        `)
        .eq('user_id', user.id)
        .single();

      if (providerData) {
        edgeLogger.info('Provider role: returning own record only', { userId: user.id });
        return new Response(JSON.stringify({ providers: [providerData] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        edgeLogger.info('Provider not found for user', { userId: user.id });
        return new Response(JSON.stringify({ providers: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      edgeLogger.error('No valid role for user', new Error('No valid role'), { userId: user.id });
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    edgeLogger.info('Practice context', { practiceId, source: practiceIdSource });

    if (!practiceId && !roles.includes('admin')) {
      edgeLogger.error('No practice_id found for user', new Error('Missing practice_id'), { userId: user.id });
      return new Response(JSON.stringify({ providers: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch providers only (role_type = 'provider')
    let providersQuery = supabaseClient
      .from('providers')
      .select(`
        id,
        user_id,
        practice_id,
        role_type,
        can_order,
        active,
        created_at,
        updated_at
      `)
      .eq('role_type', 'provider')
      .order('created_at', { ascending: false });

    if (practiceId) {
      providersQuery = providersQuery.eq('practice_id', practiceId);
    }

    const { data: providersRows, error: providersError } = await providersQuery;

    if (providersError) {
      edgeLogger.error('[list-providers] Query error', providersError);
      return new Response(JSON.stringify({ error: providersError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!providersRows || providersRows.length === 0) {
      edgeLogger.info('No providers found for practice', { practiceId });
      return new Response(JSON.stringify({ providers: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Fetch user profiles for all providers
    const userIds = providersRows.map(p => p.user_id);
    const practiceIds = [...new Set(providersRows.map(p => p.practice_id))];

    // Defensive logging: Verify caller's practice_staff membership for staff users
    if (roles.includes('staff') && practiceId) {
      const { data: staffMembership } = await supabaseClient
        .from('practice_staff')
        .select('id, active')
        .eq('user_id', user.id)
        .eq('practice_id', practiceId)
        .maybeSingle();
      
      if (!staffMembership) {
        edgeLogger.error('CRITICAL: Staff user has no practice_staff record', new Error('Missing practice_staff record'), { userId: user.id, practiceId });
      } else if (!staffMembership.active) {
        edgeLogger.warn('Staff user has inactive practice_staff membership', { userId: user.id, practiceId });
      } else {
        edgeLogger.info('Staff user has valid practice_staff membership', { userId: user.id, practiceId });
      }
    }

    const { data: userProfiles, error: userProfilesError } = await supabaseClient
      .from('profiles')
      .select('id, name, full_name, prescriber_name, email, phone, address, npi, dea, license_number, staff_role_type')
      .in('id', userIds);

    if (userProfilesError) {
      edgeLogger.error('User profiles query error', userProfilesError);
      return new Response(JSON.stringify({ error: userProfilesError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get auth.users emails as fallback for any profiles missing email
    const profilesMap = new Map(userProfiles?.map(p => [p.id, p]) || []);
    
    // For profiles without email, fetch from auth.users
    const profilesNeedingEmail = Array.from(profilesMap.values()).filter(p => !p.email);
    if (profilesNeedingEmail.length > 0) {
      edgeLogger.info('Fetching auth emails for profiles missing email', { 
        count: profilesNeedingEmail.length 
      });
      
      for (const profile of profilesNeedingEmail) {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(profile.id);
        if (authUser?.user?.email) {
          profile.email = authUser.user.email;
          edgeLogger.info('Added auth email to profile', { 
            profileId: profile.id, 
            email: authUser.user.email 
          });
        }
      }
    }

    // Step 3: Fetch practice profiles
    const { data: practiceProfiles, error: practiceProfilesError } = await supabaseClient
      .from('profiles')
      .select('id, name, company')
      .in('id', practiceIds);

    if (practiceProfilesError) {
      edgeLogger.error('Practice profiles query error', practiceProfilesError);
    }

    // Merge profiles onto provider rows
    const userProfilesMap = new Map(userProfiles?.map(p => [p.id, p]) || []);
    const practiceProfilesMap = new Map(practiceProfiles?.map(p => [p.id, p]) || []);
    
    const providers = providersRows.map(p => ({
      ...p,
      profiles: userProfilesMap.get(p.user_id) || null,
      practice: practiceProfilesMap.get(p.practice_id) || null,
    }));

    edgeLogger.info('[list-providers] Found providers', { count: providers.length, practiceId });
    if (providers.length > 0) {
      edgeLogger.info('[list-providers] First provider profile', { hasName: !!providers[0].profiles?.name, hasEmail: !!providers[0].profiles?.email });
    }

    return new Response(JSON.stringify({ providers }), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'X-Function-Version': '2.0-unified'
      },
    });

  } catch (error) {
    edgeLogger.error('Error', error instanceof Error ? error : new Error(String(error)));
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
