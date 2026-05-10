import { createClient } from "npm:@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { email, password, name } = await req.json();
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (createErr) throw createErr;
    const userId = created.user!.id;

    const { error: profErr } = await admin.from('profiles').insert({
      id: userId,
      email,
      name,
      full_name: name,
      status: 'active',
      active: true,
      temp_password: false,
      must_change_password: false,
    });
    if (profErr) throw profErr;

    const { error: roleErr } = await admin.from('user_roles').insert([
      { user_id: userId, role: 'admin' },
      { user_id: userId, role: 'super_admin' },
    ]);
    if (roleErr) throw roleErr;

    return new Response(JSON.stringify({ ok: true, userId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message, details: e }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});