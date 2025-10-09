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
  role: 'admin' | 'doctor' | 'pharmacy' | 'topline' | 'downline';
  roleData: {
    // Doctor fields
    licenseNumber?: string;
    npi?: string;
    dea?: string;
    company?: string;
    phone?: string;
    address?: string;
    // Pharmacy fields
    contactEmail?: string;
    statesServiced?: string[];
    // Downline fields
    linkedToplineId?: string;
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
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authData.user.id;
    console.log('User created:', userId);

    // Insert role into user_roles table
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role: signupData.role
      });

    if (roleError) {
      console.error('Role assignment error:', roleError);
      // Clean up: delete the user if role assignment fails
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: 'Failed to assign role. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Role assigned:', signupData.role);

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

    // Update profile with role-specific data
    const profileUpdate: any = {
      name: signupData.name,
      email: signupData.email,
      contract_url: contractUrl
    };

    if (signupData.role === 'doctor') {
      profileUpdate.license_number = signupData.roleData.licenseNumber;
      profileUpdate.npi = signupData.roleData.npi;
      profileUpdate.dea = signupData.roleData.dea;
      profileUpdate.company = signupData.roleData.company;
      profileUpdate.phone = signupData.roleData.phone;
      profileUpdate.address = signupData.roleData.address;
    } else if (signupData.role === 'pharmacy') {
      profileUpdate.email = signupData.roleData.contactEmail;
      profileUpdate.address = signupData.roleData.address;
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

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdate)
      .eq('id', userId);

    if (profileError) {
      console.error('Profile update error:', profileError);
      // Don't fail the signup, just log the error
      console.warn('Profile update failed but user was created successfully');
    }

    // If pharmacy, create pharmacy record
    if (signupData.role === 'pharmacy') {
      const { error: pharmacyError } = await supabaseAdmin
        .from('pharmacies')
        .insert({
          name: signupData.name,
          contact_email: signupData.roleData.contactEmail,
          address: signupData.roleData.address,
          states_serviced: signupData.roleData.statesServiced,
          active: true
        });

      if (pharmacyError) {
        console.error('Pharmacy creation error:', pharmacyError);
        console.warn('Pharmacy record creation failed but user was created successfully');
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
