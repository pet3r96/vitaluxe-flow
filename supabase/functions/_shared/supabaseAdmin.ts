import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

/**
 * Shared Supabase Admin Client
 * Centralizes admin client creation for all edge functions
 */
export function createAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Create authenticated client from request
 */
export function createAuthClient(authHeader: string | null) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authHeader }
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
