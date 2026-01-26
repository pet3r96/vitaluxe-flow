import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const VIOS_PHARMACY_ID = "d5e75179-e66c-450f-8cae-1f4df93b097c";

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    // Query products assigned to VIOS pharmacy with their variants
    const { data: productPharmacies, error: ppError } = await supabase
      .from("product_pharmacies")
      .select("product_id")
      .eq("pharmacy_id", VIOS_PHARMACY_ID);

    if (ppError) {
      console.error("Error fetching product-pharmacy assignments:", ppError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch product assignments" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const productIds = productPharmacies?.map(pp => pp.product_id) || [];

    if (productIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "No products assigned to VIOS pharmacy" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch products with their variants
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select(`
        id,
        name,
        product_type,
        dosage_form,
        base_price,
        vios_lf_product_id,
        product_variants (
          id,
          label,
          base_price,
          product_code
        )
      `)
      .in("id", productIds)
      .eq("active", true)
      .order("name");

    if (productsError) {
      console.error("Error fetching products:", productsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch products" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build CSV rows
    const csvRows: string[][] = [];
    
    // Header row
    csvRows.push([
      "product_name",
      "product_type", 
      "dosage_form",
      "variant_dosage",
      "base_price",
      "variant_id",
      "vios_med_id"
    ]);

    // Data rows - one row per variant
    for (const product of products || []) {
      const variants = product.product_variants || [];
      
      if (variants.length === 0) {
        // Product without variants - use product-level data
        csvRows.push([
          escapeCSV(product.name || ""),
          escapeCSV(product.product_type || ""),
          escapeCSV(product.dosage_form || ""),
          "", // No variant dosage
          String(product.base_price || 0),
          product.id,
          product.vios_lf_product_id || "" // Existing Med ID if any
        ]);
      } else {
        // One row per variant
        for (const variant of variants) {
          csvRows.push([
            escapeCSV(product.name || ""),
            escapeCSV(product.product_type || ""),
            escapeCSV(product.dosage_form || ""),
            escapeCSV(variant.label || ""),
            String(variant.base_price || product.base_price || 0),
            variant.id,
            variant.product_code || "" // Existing Med ID if any
          ]);
        }
      }
    }

    // Convert to CSV string
    const csvContent = csvRows.map(row => row.join(",")).join("\n");

    // Return CSV file
    const headers = {
      ...corsHeaders,
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="vios-products-export-${new Date().toISOString().split('T')[0]}.csv"`
    };

    return new Response(csvContent, { headers });

  } catch (error) {
    console.error("Export error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper function to escape CSV values
function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
