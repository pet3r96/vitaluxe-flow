import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { validatePhone, validateNPI, validateDEA, generateSecurePassword } from '../_shared/validators.ts';
import { validateCreateAccountRequest } from '../_shared/requestValidators.ts';
import { RateLimiter, RATE_LIMITS, getClientIP } from '../_shared/rateLimiter.ts';
import { validateCSRFToken } from '../_shared/csrfValidator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
};

function isTrustedOrigin(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return host === 'app.vitaluxeservices.com'
      || host.endsWith('.lovableproject.com')
      || host.endsWith('.lovable.app')
      || host.endsWith('.lovable.dev');
  } catch {
    return false;
  }
}

interface SignupRequest {
  email: string;
  password?: string; // Optional - will be generated if not provided
  name: string;
  fullName?: string;
  prescriberName?: string;
  role: 'admin' | 'doctor' | 'practice' | 'pharmacy' | 'topline' | 'downline' | 'provider' | 'staff';
  parentId?: string;
  csrfToken?: string; // Optional - fallback if header is stripped
  isSelfSignup?: boolean; // Flag for self-signup flow
  isAdminCreated?: boolean; // Flag for admin-created user flow
  createdBy?: string; // Admin user ID who created this user
  roleData: {
    // Doctor/Practice fields
    licenseNumber?: string;
    npi?: string;
    practiceNpi?: string;
    dea?: string;
    phone?: string;
    company?: string;
    address?: string;
    address_street?: string;
    address_city?: string;
    address_state?: string;
    address_zip?: string;
    // Pharmacy fields
    contactEmail?: string;
    statesServiced?: string[];
    priorityMap?: Record<string, number>;
    // Downline fields
    linkedToplineId?: string;
    // Provider fields
    practiceId?: string;
    // Staff fields
    roleType?: string;
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

    // Rate limiting to prevent abuse
    const limiter = new RateLimiter();
    const clientIP = getClientIP(req);
    const { allowed } = await limiter.checkLimit(
      supabaseAdmin,
      clientIP,
      'assign-user-role',
      RATE_LIMITS.AUTH_SIGN_UP // 3 signups per hour per IP
    );

    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many signup attempts. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate JSON
    let signupData: SignupRequest;
    try {
      signupData = await req.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Basic validation for required signup fields
    const basicValidation = validateCreateAccountRequest({
      role: signupData.role,
      name: signupData.name,
      email: signupData.email
    });
    
    if (!basicValidation.valid) {
      console.warn('Basic validation failed:', basicValidation.errors);
      return new Response(
        JSON.stringify({ error: 'Invalid request data', details: basicValidation.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize role: "practice" → "doctor" for backward compatibility
    // Frontend may send "practice", but database uses "doctor" for practice accounts
    if (signupData.role === "practice") {
      signupData.role = "doctor";
    }

    // Validate phone numbers, NPI, and DEA
    if (signupData.roleData.phone) {
      const phoneResult = validatePhone(signupData.roleData.phone);
      if (!phoneResult.valid) {
        console.error('Phone validation failed:', phoneResult.error);
        return new Response(
          JSON.stringify({ error: `Phone validation: ${phoneResult.error}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (signupData.roleData.npi) {
      const npiResult = validateNPI(signupData.roleData.npi);
      if (!npiResult.valid) {
        console.error('NPI validation failed:', npiResult.error);
        return new Response(
          JSON.stringify({ error: `NPI validation: ${npiResult.error}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (signupData.roleData.dea) {
      const deaResult = validateDEA(signupData.roleData.dea);
      if (!deaResult.valid) {
        console.error('DEA validation failed:', deaResult.error);
        return new Response(
          JSON.stringify({ error: `DEA validation: ${deaResult.error}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }


    // Get authorization header to check if caller is authenticated and their role
    const authHeader = req.headers.get('Authorization');
    let callerUserId: string | null = null;
    let isAdminCaller = false;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      
      if (error) {
        console.error('❌ Failed to get user from token:', error.message);
      }
      
      if (user) {
        callerUserId = user.id;

        // Validate CSRF token for authenticated requests
        // Accept token from header OR body (fallback if header is stripped by browser/proxy)
        const headerToken = req.headers.get('x-csrf-token') || undefined;
        const bodyToken = signupData.csrfToken || undefined;
        const effectiveToken = headerToken || bodyToken;

        // Diagnostics: log header names and body keys (no values)
        try {
          const headerNames = Array.from(req.headers.keys());
          console.log('Headers received:', headerNames);
          console.log('Body keys:', Object.keys(signupData || {}));
        } catch (_) {}
        
        console.log(`CSRF token source: ${headerToken ? 'header' : bodyToken ? 'body' : 'none'}`);
        
        if (effectiveToken) {
          const csrfValidation = await validateCSRFToken(supabaseAdmin, user.id, effectiveToken);
          if (!csrfValidation.valid) {
            console.error('CSRF validation failed:', csrfValidation.error);
            return new Response(
              JSON.stringify({ error: csrfValidation.error || 'Invalid CSRF token' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          const originHeader = req.headers.get('origin') || '';
          const refererHeader = req.headers.get('referer') || '';
          const trusted = isTrustedOrigin(originHeader || refererHeader);
          if (trusted) {
            console.warn('No CSRF token; proceeding due to trusted origin and bearer auth', { origin: originHeader, referer: refererHeader });
          } else {
            console.error('CSRF validation failed: CSRF token is required');
            return new Response(
              JSON.stringify({ error: 'CSRF token is required' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
        
        // Check if caller is an admin
        const { data: callerRoles } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', callerUserId);
        
        isAdminCaller = callerRoles?.some(r => r.role === 'admin') || false;
      }
    }

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

    // Validate required fields (password is optional - will be generated if not provided)
    if (!signupData.email || !signupData.name || !signupData.role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, name, or role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Generate password if not provided
    const initialPassword = signupData.password || generateSecurePassword();
    console.log(`Password ${signupData.password ? 'provided' : 'generated'} for user creation`);

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
    } else if (signupData.role === 'staff') {
      if (!signupData.roleData.practiceId) {
        return new Response(
          JSON.stringify({ error: 'Staff members must be linked to a practice' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (!signupData.roleData.roleType) {
        return new Response(
          JSON.stringify({ error: 'Staff members must have a role type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if user already exists by email
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUser?.users?.some(u => u.email?.toLowerCase() === signupData.email.toLowerCase());
    
    if (userExists) {
      console.warn('User already exists with email:', signupData.email);
      return new Response(
        JSON.stringify({ error: 'A user with this email already exists. Please use a different email address.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for orphaned provider records before creating auth user
    if (signupData.role === 'provider' && signupData.roleData?.practiceId) {
      console.log('🔍 Checking for orphaned provider records for practice:', signupData.roleData.practiceId);
      
      const { data: orphanedProviders, error: orphanCheckError } = await supabaseAdmin
        .from('providers')
        .select('id, user_id')
        .eq('practice_id', signupData.roleData.practiceId);
      
      if (!orphanCheckError && orphanedProviders && orphanedProviders.length > 0) {
        console.log(`Found ${orphanedProviders.length} existing provider record(s) for this practice`);
        
        // Check if any are orphaned (user_id exists but auth user doesn't)
        for (const provider of orphanedProviders) {
          if (provider.user_id) {
            const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(provider.user_id);
            if (!authUser.user) {
              console.log(`🧹 Cleaning up orphaned provider record: ${provider.id} with invalid user_id: ${provider.user_id}`);
              await supabaseAdmin.from('providers').delete().eq('id', provider.id);
            }
          }
        }
      }
    }

    // Determine user status and email confirmation based on flow
    const isSelfSignup = signupData.isSelfSignup === true;
    const isAdminCreated = signupData.isAdminCreated === true || isAdminCaller;
    const userStatus = isSelfSignup ? 'pending_verification' : 'active';
    const requiresTempPassword = isAdminCreated && !isSelfSignup;

    // Create user using admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: signupData.email,
      password: initialPassword,
      email_confirm: isAdminCreated, // Auto-confirm for admin-created, require verification for self-signup
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

    // Build roleData for RPC
    const roleDataForRpc: any = { ...signupData.roleData };
    
    // Map linkedToplineId to parentId for database function compatibility
    if (signupData.role === 'downline' && roleDataForRpc.linkedToplineId) {
      // linkedToplineId is a user_id, but we need the rep_id
      const { data: parentRep, error: repLookupError } = await supabaseAdmin
        .from('reps')
        .select('id')
        .eq('user_id', roleDataForRpc.linkedToplineId)
        .eq('role', 'topline')
        .single();
      
      if (repLookupError || !parentRep) {
        console.error('Failed to find parent topline rep:', repLookupError);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return new Response(
          JSON.stringify({ error: 'Invalid parent topline representative. Please select a valid topline rep.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      roleDataForRpc.parentId = parentRep.id; // Use rep_id, not user_id
      delete roleDataForRpc.linkedToplineId; // Remove user_id to prevent RPC from using wrong field
      console.log(`Downline creation: mapped user_id to rep_id ${parentRep.id}, linkedToplineId removed`);
    }
    
    // For toplines, ensure no parentId/linkedToplineId is sent
    if (signupData.role === 'topline') {
      delete roleDataForRpc.parentId;
      delete roleDataForRpc.linkedToplineId;
      console.log('Topline creation: ensuring no parentId is sent to RPC');
    }

    // Log RPC args keys for debugging
    console.log('RPC args keys:', Object.keys({ 
      p_user_id: userId, 
      p_email: signupData.email, 
      p_name: signupData.name, 
      p_role: signupData.role, 
      p_role_data: roleDataForRpc 
    }));

    // Use atomic function to create user with role (with new Phase 2 parameters)
    const { data: creationResult, error: creationError } = await supabaseAdmin.rpc(
      'create_user_with_role',
      {
        p_user_id: userId,
        p_email: signupData.email,
        p_name: signupData.name,
        p_role: signupData.role,
        p_role_data: roleDataForRpc,
        p_status: userStatus,
        p_created_by: signupData.createdBy || callerUserId,
        p_temp_password: requiresTempPassword
      }
    );

    if (creationError || !creationResult?.success) {
      console.error('❌ User creation RPC failed:', {
        error: creationError,
        result: creationResult,
        role: signupData.role,
        roleDataSent: roleDataForRpc,
        userId: userId,
        errorCode: creationError?.code,
        errorDetails: creationError?.details,
        errorMessage: creationError?.message
      });
      
      // Check if it's a duplicate key constraint violation
      const isDuplicateKey = creationError?.code === '23505' || 
                            creationError?.message?.includes('duplicate key');
      
      // Specific check for provider-related constraint violations
      const isProviderDuplicate = isDuplicateKey && (
        creationError?.message?.includes('providers_user_id_key') ||
        creationError?.details?.includes('providers_user_id_key')
      );
      
      // Clean up: delete the auth user if profile/role creation fails
      console.log('Cleaning up auth user due to profile creation failure...');
      await supabaseAdmin.auth.admin.deleteUser(userId);
      console.log('Auth user cleanup complete');
      
      // Provide specific error messages
      let errorMessage: string;
      let statusCode: number;
      
      if (isProviderDuplicate) {
        errorMessage = 'A provider account already exists for this practice. Please contact support if you need to add another provider.';
        statusCode = 409;
      } else if (isDuplicateKey) {
        errorMessage = 'A profile with this information already exists. Please contact support if you believe this is an error.';
        statusCode = 409;
      } else {
        errorMessage = creationResult?.error || creationError?.message || 'Failed to create user profile and role';
        statusCode = 500;
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sync practice address to provider if this is a provider creation
    if (signupData.role === 'provider' && signupData.roleData?.practiceId) {
      console.log('🔄 Syncing practice address to new provider...');
      
      const { error: syncError } = await supabaseAdmin.rpc(
        'sync_practice_address_to_providers',
        { p_practice_id: signupData.roleData.practiceId }
      );
      
      if (syncError) {
        console.error('⚠️ Failed to sync practice address:', syncError);
        // Don't fail the whole operation, just log it
      } else {
        console.log('✅ Practice address synced to provider successfully');
      }
    }

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

    // Handle address data - support both old (single string) and new (structured) format
    const getAddressFields = (roleData: any) => {
      if (roleData.address_street) {
        // New structured format (preferred)
        return {
          address_street: roleData.address_street,
          address_city: roleData.address_city,
          address_state: roleData.address_state,
          address_zip: roleData.address_zip,
        };
      } else if (roleData.address) {
        // Old single-string format (backward compatibility)
        return { address: roleData.address };
      }
      return {};
    };

    if (signupData.role === 'doctor') {
      profileUpdate.license_number = signupData.roleData.licenseNumber;
      profileUpdate.npi = signupData.roleData.npi;
      profileUpdate.practice_npi = signupData.roleData.practiceNpi;
      profileUpdate.dea = signupData.roleData.dea;
      profileUpdate.phone = signupData.roleData.phone;
      profileUpdate.company = signupData.roleData.company;
      profileUpdate.linked_topline_id = signupData.roleData.linkedToplineId;
      Object.assign(profileUpdate, getAddressFields(signupData.roleData));
    } else if (signupData.role === 'downline') {
      profileUpdate.linked_topline_id = signupData.roleData.linkedToplineId;
      profileUpdate.phone = signupData.roleData.phone;
      profileUpdate.company = signupData.roleData.company;
      Object.assign(profileUpdate, getAddressFields(signupData.roleData));
    } else if (signupData.role === 'topline') {
      profileUpdate.phone = signupData.roleData.phone;
      profileUpdate.company = signupData.roleData.company;
      Object.assign(profileUpdate, getAddressFields(signupData.roleData));
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

    // Create rep_practice_links for doctor (practice) role
    if (signupData.role === 'doctor' && signupData.roleData.linkedToplineId) {
      // Determine if the linked rep is a downline or topline
      const { data: linkedRepData } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', signupData.roleData.linkedToplineId)
        .limit(1)
        .maybeSingle();
      
      const isLinkedRepDownline = linkedRepData?.role === 'downline';
      
      if (isLinkedRepDownline) {
        // Scenario: Downline created the practice
        // Get downline's rep record
        const { data: downlineRepRecord } = await supabaseAdmin
          .from('reps')
          .select('id, assigned_topline_id')
          .eq('user_id', signupData.roleData.linkedToplineId)
          .single();
        
        if (downlineRepRecord) {
          // Link 1: Direct downline rep → practice
          const { error: link1Error } = await supabaseAdmin
            .from('rep_practice_links')
            .insert({
              rep_id: downlineRepRecord.id,
              practice_id: userId,
              assigned_topline_id: downlineRepRecord.assigned_topline_id
            });
          
          if (link1Error) {
            console.error('Failed to create downline rep_practice_link:', link1Error);
          }
          
          // Link 2: Topline rep → practice (if downline has a topline)
          if (downlineRepRecord.assigned_topline_id) {
            const { error: link2Error } = await supabaseAdmin
              .from('rep_practice_links')
              .insert({
                rep_id: downlineRepRecord.assigned_topline_id,
                practice_id: userId,
                assigned_topline_id: downlineRepRecord.assigned_topline_id
              });
            
            if (link2Error) {
              console.error('Failed to create topline rep_practice_link:', link2Error);
            }
          }
        }
      } else {
        // Scenario: Topline created the practice directly
        const { data: toplineRepRecord } = await supabaseAdmin
          .from('reps')
          .select('id')
          .eq('user_id', signupData.roleData.linkedToplineId)
          .single();
        
        if (toplineRepRecord) {
          const { error: linkError } = await supabaseAdmin
            .from('rep_practice_links')
            .insert({
              rep_id: toplineRepRecord.id,
              practice_id: userId,
              assigned_topline_id: null
            });
          
          if (linkError) {
            console.error('Failed to create topline rep_practice_link:', linkError);
          }
        }
      }
    }

    // Topline rep record is already created by the RPC function
    if (signupData.role === 'topline') {
      console.log('Topline rep already created by RPC, skipping manual insert');
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

      // Upsert the downline rep record to ensure assigned_topline_id is set correctly
      const { error: repError } = await supabaseAdmin
        .from('reps')
        .upsert(
          {
            user_id: userId,
            role: 'downline',
            assigned_topline_id: toplineRepsId,
            active: true
          },
          { onConflict: 'user_id' }
        );

      if (repError) {
        console.error('Rep creation/update error:', repError);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return new Response(
          JSON.stringify({ error: 'Failed to create or link rep record' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }


    // For pharmacy role, update priority_map if provided
    if (signupData.role === 'pharmacy' && signupData.roleData.priorityMap) {
      const { error: priorityMapError } = await supabaseAdmin
        .from('pharmacies')
        .update({
          priority_map: signupData.roleData.priorityMap,
        })
        .eq('user_id', userId);

      if (priorityMapError) {
        console.error('Priority map update error:', priorityMapError);
        console.warn('Priority map update failed but user was created successfully');
      }
    }


    // Handle email sending based on flow type
    if (isSelfSignup) {
      // Self-signup: Send verification email
      console.log(`Self-signup: sending verification email to ${signupData.email}`);
      
      try {
        const { error: emailError } = await supabaseAdmin.functions.invoke('send-verification-email', {
          body: {
            userId: userId,
            email: signupData.email,
            name: signupData.name
          }
        });

        if (emailError) {
          console.error('Error sending verification email:', emailError);
        }
      } catch (emailErr) {
        console.error('Failed to invoke send-verification-email function:', emailErr);
      }
    } else if (isAdminCreated && signupData.role !== 'admin') {
      // Admin-created: Send temp password email and set password status
      console.log(`Admin-created account: sending temp password email to ${signupData.email}`);
      
      // Insert password status record for forced password change
      const { error: statusError } = await supabaseAdmin
        .from('user_password_status')
        .insert({
          user_id: userId,
          must_change_password: true,
          temporary_password_sent: true,
          first_login_completed: false
        });

      if (statusError) {
        console.error('Error creating password status:', statusError);
      }

      // Send temp password email with userId for token generation
      try {
        const authHeader = req.headers.get('Authorization');
        const { error: emailError } = await supabaseAdmin.functions.invoke('send-temp-password-email', {
          body: {
            email: signupData.email,
            name: signupData.name,
            temporaryPassword: initialPassword,
            role: signupData.role,
            userId: userId  // CRITICAL: Pass userId so token can be created
          },
          headers: authHeader ? {
            Authorization: authHeader
          } : {}
        });

        if (emailError) {
          console.error('Error sending temp password email:', emailError);
          console.error('Email error details:', JSON.stringify(emailError));
        } else {
          console.log('✅ Temporary password email sent successfully to:', signupData.email);
        }
      } catch (emailErr) {
        console.error('Failed to invoke send-temp-password-email function:', emailErr);
        console.error('Email invocation error details:', emailErr);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: isSelfSignup
          ? 'Account created successfully! Please check your email to verify your address.'
          : isAdminCreated
          ? 'Account created successfully! A welcome email with login credentials has been sent.'
          : 'Account created successfully! You can now sign in.',
        userId: userId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Unexpected error in assign-user-role:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing the request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
