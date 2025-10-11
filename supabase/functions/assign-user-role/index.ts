import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SignupRequest {
  email: string;
  password: string;
  name: string;
  fullName?: string;
  prescriberName?: string;
  role: 'admin' | 'doctor' | 'pharmacy' | 'topline' | 'downline' | 'provider';
  parentId?: string;
  roleData: {
    // Doctor fields
    licenseNumber?: string;
    npi?: string;
    practiceNpi?: string;
    dea?: string;
    company?: string;
    phone?: string;
    address?: string;
    address_street?: string;
    address_city?: string;
    address_state?: string;
    address_zip?: string;
    // Pharmacy fields
    contactEmail?: string;
    statesServiced?: string[];
    // Downline fields
    linkedToplineId?: string;
    // Provider fields
    practiceId?: string;
  };
  prescriberData?: {
    fullName: string;
    prescriberName: string;
    npi: string;
    dea?: string;
    licenseNumber: string;
    phone?: string;
  };
  contractFile?: {
    name: string;
    data: string; // base64
    mimeType: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const signupData: SignupRequest = await req.json();
    console.log('Signup request received for role:', signupData.role);

    // Get authorization header to check if caller is authenticated
    const authHeader = req.headers.get('Authorization');
    let callerUserId: string | null = null;
    
    console.log('=== TOKEN VALIDATION START ===');
    console.log('Authorization header present:', !!authHeader);
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      console.log('Token extracted (first 20 chars):', token.substring(0, 20) + '...');
      
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      
      if (error) {
        console.error('❌ Failed to get user from token:', error.message);
        console.error('Error details:', JSON.stringify(error, null, 2));
      }
      
      if (user) {
        callerUserId = user.id;
        console.log('✅ Caller user ID extracted:', callerUserId);
      } else {
        console.warn('⚠️ No user found from token (user is null)');
      }
    } else {
      console.warn('⚠️ No Authorization header provided');
    }
    
    console.log('Final callerUserId value:', callerUserId);
    console.log('=== TOKEN VALIDATION END ===');

    // Authorization check for non-admin roles creating practices
    if (callerUserId && signupData.role === 'doctor') {
      const { data: callerRoles } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', callerUserId);

      const hasRepRole = callerRoles?.some(r => r.role === 'topline' || r.role === 'downline');
      const isAdmin = callerRoles?.some(r => r.role === 'admin');

      // If caller is a rep (not admin), ensure they're only assigning practices to themselves
      if (hasRepRole && !isAdmin) {
        if (signupData.roleData.linkedToplineId !== callerUserId) {
          return new Response(
            JSON.stringify({ error: 'Representatives can only assign practices to themselves' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Validate required fields
    if (!signupData.email || !signupData.password || !signupData.name || !signupData.role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, name, or role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate role-specific fields
    if (signupData.role === 'doctor') {
      if (!signupData.roleData.licenseNumber || !signupData.roleData.npi) {
        return new Response(
          JSON.stringify({ error: 'Doctors must provide License Number and NPI' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (signupData.role === 'pharmacy') {
      if (!signupData.roleData.contactEmail || !signupData.roleData.statesServiced?.length) {
        return new Response(
          JSON.stringify({ error: 'Pharmacies must provide Contact Email and States Serviced' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (signupData.role === 'downline') {
      if (!signupData.roleData.linkedToplineId) {
        return new Response(
          JSON.stringify({ error: 'Downline reps must be linked to a Topline rep' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (signupData.role === 'provider') {
      if (!signupData.roleData.practiceId) {
        return new Response(
          JSON.stringify({ error: 'Providers must be linked to a practice' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (!signupData.roleData.licenseNumber || !signupData.roleData.npi) {
        return new Response(
          JSON.stringify({ error: 'Providers must provide License Number and NPI' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (!signupData.fullName || !signupData.prescriberName) {
        return new Response(
          JSON.stringify({ error: 'Providers must provide Full Name and Prescriber Name' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create user using admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: signupData.email,
      password: signupData.password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name: signupData.name
      }
    });

    if (authError) {
      console.error('Auth error:', authError);
      
      // Check if it's a duplicate email error
      const errorMessage = authError.message.toLowerCase().includes('already registered') || 
                          authError.message.toLowerCase().includes('already exists') ||
                          authError.message.toLowerCase().includes('duplicate')
        ? 'A user with this email already exists. Please use a different email address.'
        : authError.message;
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authData.user.id;
    console.log('User created:', userId);

    // Determine parent_id
    const parentId = signupData.parentId || 
      (signupData.role === 'downline' ? signupData.roleData.linkedToplineId : null);

    // Use atomic function to create user with role
    const { data: creationResult, error: creationError } = await supabaseAdmin.rpc(
      'create_user_with_role',
      {
        p_user_id: userId,
        p_name: signupData.name,
        p_email: signupData.email,
        p_role: signupData.role,
        p_parent_id: parentId,
        p_role_data: signupData.roleData
      }
    );

    if (creationError || !creationResult?.success) {
      console.error('User creation error:', creationError || creationResult?.error);
      // Clean up: delete the auth user if profile/role creation fails
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: creationResult?.error || 'Failed to create user profile and role' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User profile and role created:', signupData.role);

    // Upload contract if provided
    let contractUrl = null;
    if (signupData.contractFile) {
      const buffer = Uint8Array.from(atob(signupData.contractFile.data), c => c.charCodeAt(0));
      const fileName = `${userId}/${Date.now()}_${signupData.contractFile.name}`;
      
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('contracts')
        .upload(fileName, buffer, {
          contentType: signupData.contractFile.mimeType,
          upsert: false
        });

      if (!uploadError && uploadData) {
        const { data: urlData } = supabaseAdmin.storage
          .from('contracts')
          .getPublicUrl(uploadData.path);
        contractUrl = urlData.publicUrl;

        // Create document record
        await supabaseAdmin.from('documents').insert({
          user_id: userId,
          document_type: 'contract',
          storage_path: uploadData.path,
          file_name: signupData.contractFile.name,
          mime_type: signupData.contractFile.mimeType,
          verified: false
        });
      }
    }

    // Update profile with additional role-specific data (contract, etc.)
    const profileUpdate: any = {
      contract_url: contractUrl
    };

    if (signupData.role === 'doctor') {
      profileUpdate.license_number = signupData.roleData.licenseNumber;
      profileUpdate.npi = signupData.roleData.npi;
      profileUpdate.practice_npi = signupData.roleData.practiceNpi;
      profileUpdate.dea = signupData.roleData.dea;
      profileUpdate.company = signupData.roleData.company;
      profileUpdate.phone = signupData.roleData.phone;
      profileUpdate.address = signupData.roleData.address;
      profileUpdate.linked_topline_id = signupData.roleData.linkedToplineId;
    } else if (signupData.role === 'downline') {
      profileUpdate.linked_topline_id = signupData.roleData.linkedToplineId;
      profileUpdate.company = signupData.roleData.company;
      profileUpdate.phone = signupData.roleData.phone;
      profileUpdate.address = signupData.roleData.address;
    } else if (signupData.role === 'topline') {
      profileUpdate.company = signupData.roleData.company;
      profileUpdate.phone = signupData.roleData.phone;
      profileUpdate.address = signupData.roleData.address;
    }

    // Only update if there are additional fields
    if (Object.keys(profileUpdate).length > 1 || contractUrl) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdate)
        .eq('id', userId);

      if (profileError) {
        console.error('Profile update error:', profileError);
        console.warn('Profile additional data update failed but user was created successfully');
      }
    }

    // If topline or downline role, create rep record
    if (signupData.role === 'topline') {
      const { error: repError } = await supabaseAdmin
        .from('reps')
        .insert({
          user_id: userId,
          role: 'topline',
          assigned_topline_id: null, // Toplines don't have an assigned topline
          active: true
        });

      if (repError) {
        console.error('Rep creation error:', repError);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return new Response(
          JSON.stringify({ error: 'Failed to create rep record' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (signupData.role === 'downline') {
      const linkedToplineUserId = signupData.roleData.linkedToplineId;
      let toplineRepsId: string | null = null;

      // Try to get the topline's reps.id (not user_id!)
      const { data: toplineRep, error: toplineError } = await supabaseAdmin
        .from('reps')
        .select('id')
        .eq('user_id', linkedToplineUserId)
        .maybeSingle();

      if (toplineRep) {
        toplineRepsId = toplineRep.id;
      } else {
        console.warn('Topline rep not found, creating one on the fly');
        const { error: createToplineRepError } = await supabaseAdmin
          .from('reps')
          .insert({
            user_id: linkedToplineUserId,
            role: 'topline',
            assigned_topline_id: null,
            active: true
          });

        if (createToplineRepError) {
          console.error('Failed creating topline rep record:', createToplineRepError);
        }

        // Re-fetch after attempting creation
        const { data: createdToplineRep, error: refetchError } = await supabaseAdmin
          .from('reps')
          .select('id')
          .eq('user_id', linkedToplineUserId)
          .maybeSingle();

        if (createdToplineRep) {
          toplineRepsId = createdToplineRep.id;
        } else {
          console.error('Topline rep lookup error:', toplineError || refetchError);
          await supabaseAdmin.auth.admin.deleteUser(userId);
          return new Response(
            JSON.stringify({ error: 'Invalid topline rep assignment' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Create the downline rep record
      const { error: repError } = await supabaseAdmin
        .from('reps')
        .insert({
          user_id: userId,
          role: 'downline',
          assigned_topline_id: toplineRepsId,
          active: true
        });

      if (repError) {
        console.error('Rep creation error:', repError);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return new Response(
          JSON.stringify({ error: 'Failed to create rep record' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // If provider role, create provider record
    if (signupData.role === 'provider') {
      // First update the profile with provider-specific data
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({
          full_name: signupData.fullName,
          npi: signupData.roleData.npi,
          dea: signupData.roleData.dea,
          license_number: signupData.roleData.licenseNumber,
          phone: signupData.roleData.phone
        })
        .eq('id', userId);

      if (profileUpdateError) {
        console.error('Provider profile update error:', profileUpdateError);
      }

      // Then create the provider record (linking provider to practice)
      const { error: providerError } = await supabaseAdmin
        .from('providers')
        .insert({
          user_id: userId,
          practice_id: signupData.roleData.practiceId,
          active: true
        });

      if (providerError) {
        console.error('Provider creation error:', providerError);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return new Response(
          JSON.stringify({ error: 'Failed to create provider record' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // If doctor role, create default provider record
    if (signupData.role === 'doctor' && signupData.prescriberData) {
      // Get caller's roles to determine if this is admin-initiated or rep-initiated
      console.log('=== PROVIDER CREATION DECISION START ===');
      console.log('Checking caller roles for user:', callerUserId);
      
      const { data: callerRoles, error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', callerUserId);

      if (rolesError) {
        console.error('❌ Error fetching caller roles:', rolesError);
      }

      console.log('Caller roles:', JSON.stringify(callerRoles, null, 2));

      const isAdmin = callerRoles?.some(r => r.role === 'admin');
      
      console.log('Is admin?', isAdmin);
      console.log('callerUserId is null?', !callerUserId);
      console.log('Condition breakdown:');
      console.log('  - isAdmin:', isAdmin);
      console.log('  - !callerUserId:', !callerUserId);
      
      // ONLY create default provider if caller is an admin
      // Reps creating practices should NOT create provider records
      const shouldCreateDefaultProvider = isAdmin === true;
      
      console.log('🎯 shouldCreateDefaultProvider:', shouldCreateDefaultProvider);
      console.log('=== PROVIDER CREATION DECISION END ===');
      
      if (shouldCreateDefaultProvider) {
        console.log('📝 Taking ADMIN/PUBLIC path: Creating provider record');
        // First update the profile with prescriber-specific data
        const { error: prescriberProfileError } = await supabaseAdmin
          .from('profiles')
          .update({
            full_name: signupData.prescriberData.fullName,
            npi: signupData.prescriberData.npi,
            dea: signupData.prescriberData.dea,
            license_number: signupData.prescriberData.licenseNumber,
            phone: signupData.prescriberData.phone
          })
          .eq('id', userId);

        if (prescriberProfileError) {
          console.error('Default prescriber profile update error:', prescriberProfileError);
        }

        // Create the provider record linking provider to practice
        const { error: providerError } = await supabaseAdmin
          .from('providers')
          .insert({
            user_id: userId,
            practice_id: userId,
            active: true
          });

        if (providerError) {
          console.error('Default provider creation error:', providerError);
          console.warn('Failed to create default provider but practice account created');
        }
        
        // Add provider role as well
        const { error: providerRoleError } = await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: userId,
            role: 'provider'
          });
          
        if (providerRoleError) {
          console.error('Provider role assignment error:', providerRoleError);
        }
      } else {
        console.log('📝 Taking REP path: Storing prescriber data WITHOUT provider record');
        // Rep-created practice: Store prescriber data in profile but DON'T create provider record
        const { error: prescriberProfileError } = await supabaseAdmin
          .from('profiles')
          .update({
            full_name: signupData.prescriberData.fullName,
            npi: signupData.prescriberData.npi,
            dea: signupData.prescriberData.dea,
            license_number: signupData.prescriberData.licenseNumber,
            phone: signupData.prescriberData.phone
          })
          .eq('id', userId);

        if (prescriberProfileError) {
          console.error('Prescriber profile update error:', prescriberProfileError);
        }
      }
    }

    console.log('User signup completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Account created successfully! You can now sign in.',
        userId: userId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Unexpected error in assign-user-role:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
