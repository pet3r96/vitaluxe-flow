import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify admin authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roles) {
      throw new Error('Admin access required');
    }

    const { email, pendingPracticeId } = await req.json();

    console.log('Starting cleanup for:', { email, pendingPracticeId });

    // Step 1: Delete pending practice request
    if (pendingPracticeId) {
      const { error: practiceError } = await supabase
        .from('pending_practices')
        .delete()
        .eq('id', pendingPracticeId);

      if (practiceError) {
        console.error('Error deleting pending practice:', practiceError);
        throw new Error(`Failed to delete pending practice: ${practiceError.message}`);
      }
      console.log('Deleted pending practice request');
    }

    // Step 2: Find and delete the auth user (this will cascade to profiles)
    if (email) {
      const { data: authUser, error: getUserError } = await supabase.auth.admin.listUsers();
      
      if (getUserError) {
        console.error('Error listing users:', getUserError);
        throw new Error(`Failed to list users: ${getUserError.message}`);
      }

      const userToDelete = authUser.users.find(u => u.email === email);
      
      if (userToDelete) {
        const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userToDelete.id);
        
        if (deleteUserError) {
          console.error('Error deleting auth user:', deleteUserError);
          throw new Error(`Failed to delete auth user: ${deleteUserError.message}`);
        }
        console.log('Deleted auth user (profile cascaded)');
      } else {
        console.log('Auth user not found, might already be deleted');
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Cleanup completed successfully',
        deleted: {
          pendingPractice: !!pendingPracticeId,
          authUser: !!email
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Cleanup error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
