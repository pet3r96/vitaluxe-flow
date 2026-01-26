import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface ImportRow {
  variant_id: string;
  vios_med_id: string;
}

interface ImportResult {
  success: boolean;
  updated: number;
  failed: number;
  errors: string[];
  details: { variant_id: string; status: "updated" | "failed" | "skipped"; message?: string }[];
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user is admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "super_admin"])
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { rows, preview = false } = body as { rows: ImportRow[]; preview?: boolean };

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return new Response(
        JSON.stringify({ error: "No data provided. Expected 'rows' array with variant_id and vios_med_id fields." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate rows format
    const validRows: ImportRow[] = [];
    const validationErrors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      if (!row.variant_id) {
        validationErrors.push(`Row ${i + 1}: Missing variant_id`);
        continue;
      }

      if (!row.vios_med_id) {
        // Skip rows without Med ID - they're intentionally empty
        continue;
      }

      // Validate UUID format for variant_id
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(row.variant_id)) {
        validationErrors.push(`Row ${i + 1}: Invalid variant_id format`);
        continue;
      }

      // Clean up Med ID (remove whitespace)
      const cleanMedId = String(row.vios_med_id).trim();
      if (!cleanMedId) {
        continue;
      }

      validRows.push({
        variant_id: row.variant_id,
        vios_med_id: cleanMedId
      });
    }

    // Verify all variant_ids exist in database
    const variantIds = validRows.map(r => r.variant_id);
    const { data: existingVariants, error: variantError } = await supabase
      .from("product_variants")
      .select("id")
      .in("id", variantIds);

    if (variantError) {
      console.error("Error checking variants:", variantError);
      return new Response(
        JSON.stringify({ error: "Failed to validate variant IDs" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const existingIds = new Set(existingVariants?.map(v => v.id) || []);
    
    // Filter to only valid, existing variants
    const rowsToProcess: ImportRow[] = [];
    const notFoundErrors: string[] = [];

    for (const row of validRows) {
      if (existingIds.has(row.variant_id)) {
        rowsToProcess.push(row);
      } else {
        notFoundErrors.push(`Variant ID not found: ${row.variant_id}`);
      }
    }

    // If preview mode, return what would be updated
    if (preview) {
      return new Response(
        JSON.stringify({
          preview: true,
          totalRows: rows.length,
          validRows: rowsToProcess.length,
          skippedRows: rows.length - validRows.length,
          notFoundCount: notFoundErrors.length,
          validationErrors,
          notFoundErrors,
          rowsToUpdate: rowsToProcess
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Apply updates
    const result: ImportResult = {
      success: true,
      updated: 0,
      failed: 0,
      errors: [...validationErrors, ...notFoundErrors],
      details: []
    };

    for (const row of rowsToProcess) {
      const { error: updateError } = await supabase
        .from("product_variants")
        .update({ 
          product_code: row.vios_med_id,
          updated_at: new Date().toISOString()
        })
        .eq("id", row.variant_id);

      if (updateError) {
        result.failed++;
        result.errors.push(`Failed to update ${row.variant_id}: ${updateError.message}`);
        result.details.push({
          variant_id: row.variant_id,
          status: "failed",
          message: updateError.message
        });
      } else {
        result.updated++;
        result.details.push({
          variant_id: row.variant_id,
          status: "updated"
        });
      }
    }

    result.success = result.failed === 0;

    console.log(`Import complete: ${result.updated} updated, ${result.failed} failed`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Import error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
