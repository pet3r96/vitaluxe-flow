import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { getViosToken, VIOS_API_URL } from '../_shared/viosAuth.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * VIOS Allergy response is paginated per OpenAPI spec:
 * AllergyPagedResult { items, totalCount, pageSize, pageNumber, totalPages, hasNextPage }
 */
interface ViosAllergyPagedResult {
  items: ViosAllergyItem[];
  totalCount: number;
  pageSize: number;
  pageNumber: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface ViosAllergyItem {
  name: string;   // Allergy name (lowercase per schema)
  code: number;   // VIOS allergy code (lowercase per schema)
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createAdminClient();

    // Verify the caller is an admin (optional - can be removed for scheduled calls)
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      
      if (authError || !user) {
        edgeLogger.warn("Unauthorized sync attempt");
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user is admin
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || !["admin", "super_admin"].includes(profile.role)) {
        edgeLogger.warn("Non-admin sync attempt", { userId: user.id, role: profile?.role });
        return new Response(
          JSON.stringify({ error: "Admin access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    edgeLogger.info("Starting VIOS allergies sync");

    // Get VIOS OAuth token
    const accessToken = await getViosToken();
    edgeLogger.info("VIOS OAuth token obtained successfully");

    // Fetch all allergies with pagination (per VIOS API docs)
    let pageNumber = 1;
    const pageSize = 100;
    let allAllergies: ViosAllergyItem[] = [];
    let hasNextPage = true;

    while (hasNextPage) {
      edgeLogger.info("Fetching allergies page", { pageNumber, pageSize });
      
      const response = await fetch(
        `${VIOS_API_URL}/api/allergies?PageNumber=${pageNumber}&PageSize=${pageSize}`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        edgeLogger.error("VIOS API error", { status: response.status, error: errorText });
        return new Response(
          JSON.stringify({ error: `VIOS API error: ${response.status}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data: ViosAllergyPagedResult = await response.json();
      
      if (data.items && Array.isArray(data.items)) {
        allAllergies = allAllergies.concat(data.items);
        edgeLogger.info("Fetched allergies page", { 
          pageNumber, 
          itemsInPage: data.items.length,
          totalSoFar: allAllergies.length,
          totalCount: data.totalCount
        });
      }

      hasNextPage = data.hasNextPage === true;
      pageNumber++;

      // Safety limit - max 100 pages (10,000 allergies)
      if (pageNumber > 100) {
        edgeLogger.warn("Reached max page limit for allergy sync");
        break;
      }

      // Add 1 second delay between API calls per VIOS rate limit guidelines
      if (hasNextPage) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    edgeLogger.info("Fetched all allergies from VIOS", { count: allAllergies.length });

    // Upsert allergies into vios_allergies table
    let upsertCount = 0;
    let errorCount = 0;

    // Process in batches of 100
    const batchSize = 100;
    for (let i = 0; i < allAllergies.length; i += batchSize) {
      const batch = allAllergies.slice(i, i + batchSize).map(item => ({
        vios_code: item.code,             // Use lowercase 'code' per OpenAPI schema
        name: item.name,                   // Use lowercase 'name' per OpenAPI schema
        is_active: true,
        updated_at: new Date().toISOString(),
      }));

      const { error: upsertError } = await supabaseAdmin
        .from("vios_allergies")
        .upsert(batch, { 
          onConflict: "vios_code",
          ignoreDuplicates: false 
        });

      if (upsertError) {
        edgeLogger.error("Upsert batch error", { batch: i, error: upsertError.message });
        errorCount += batch.length;
      } else {
        upsertCount += batch.length;
      }
    }

    edgeLogger.info("VIOS allergies sync complete", { upsertCount, errorCount });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Synced ${upsertCount} allergies from VIOS`,
        totalFetched: allAllergies.length,
        upsertCount,
        errorCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    edgeLogger.error("Sync VIOS allergies error", { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
