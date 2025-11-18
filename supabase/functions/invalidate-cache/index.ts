import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAuthClient } from "../_shared/supabaseAdmin.ts";
import { cacheDelPattern } from "../_shared/cache.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createAuthClient(authHeader);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { patterns } = await req.json();
    
    if (!Array.isArray(patterns) || patterns.length === 0) {
      throw new Error('patterns array is required');
    }

    const results: { pattern: string; deletedCount: number }[] = [];
    
    for (const pattern of patterns) {
      const deletedCount = await cacheDelPattern(pattern);
      results.push({ pattern, deletedCount });
    }

    const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);

    console.log(`Cache invalidation complete: ${totalDeleted} keys deleted across ${patterns.length} patterns`);

    return new Response(
      JSON.stringify({ 
        success: true,
        totalDeleted,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in invalidate-cache:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
