import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin access
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { products } = await req.json();

    if (!Array.isArray(products) || products.length === 0) {
      return new Response(JSON.stringify({ error: "No products provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Importing ${products.length} VIOS catalog products...`);

    // Process in batches of 1000
    const batchSize = 1000;
    let inserted = 0;
    let updated = 0;
    let errors = 0;

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize).map((p: any) => ({
        med_id: String(p.med_id || p["Med ID"]),
        product_name: p.product_name || p["Product Name"],
        form: p.form || p["Form"] || null,
        strength: p.strength || p["Strength"] || null,
        units: p.units || p["Units"] || null,
        package: p.package || p["Package"] || null,
        schedule: p.schedule || p["Schedule"] || null,
      })).filter((p: any) => p.med_id && p.product_name);

      const { error } = await supabase
        .from("vios_product_catalog")
        .upsert(batch, { 
          onConflict: "med_id",
          ignoreDuplicates: false 
        });

      if (error) {
        console.error(`Batch error at ${i}:`, error);
        errors += batch.length;
      } else {
        inserted += batch.length;
      }
    }

    console.log(`Import complete: ${inserted} products processed, ${errors} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported: inserted,
        errors 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Import error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
