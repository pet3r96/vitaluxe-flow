import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateRouteOrderRequest } from '../_shared/requestValidators.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RoutingInput {
  product_id: string;
  destination_state: string;
}

interface RoutingResult {
  pharmacy_id: string | null;
  reason: string;
}

async function routeOrderToPharmacy(
  supabase: any,
  product_id: string,
  destination_state: string,
  user_topline_rep_id?: string | null
): Promise<RoutingResult> {
  console.log(`Routing order for product ${product_id} to state ${destination_state}, topline: ${user_topline_rep_id || 'N/A'}`);

  // 1. Get all pharmacies assigned to this product
  const { data: assignments, error } = await supabase
    .from("product_pharmacies")
    .select(`
      pharmacy:pharmacies (
        id,
        name,
        states_serviced,
        priority_map,
        active
      )
    `)
    .eq("product_id", product_id);

  if (error) {
    console.error("Error fetching product pharmacies:", error);
    return { 
      pharmacy_id: null, 
      reason: `Database error: ${error.message}` 
    };
  }

  if (!assignments || assignments.length === 0) {
    console.log("No pharmacies assigned to product");
    return { 
      pharmacy_id: null, 
      reason: "No pharmacies assigned to product" 
    };
  }

  // 2. Filter pharmacies that serve the destination state AND are active
  let eligiblePharmacies = assignments
    .map((a: any) => a.pharmacy)
    .filter((p: any) => 
      p && p.active && p.states_serviced?.includes(destination_state)
    );

  // 3. Apply topline scoping filter if user has a topline
  if (user_topline_rep_id) {
    const pharmacyIds = eligiblePharmacies.map((p: any) => p.id);
    
    // Get pharmacy scope assignments
    const { data: scopeData } = await supabase
      .from("pharmacy_rep_assignments")
      .select("pharmacy_id")
      .in("pharmacy_id", pharmacyIds);
    
    // Build sets for efficient lookups
    const scopedPharmacyIds = new Set(scopeData?.map((s: any) => s.pharmacy_id) || []);
    
    // Get user's assigned pharmacies
    const { data: userAssignments } = await supabase
      .from("pharmacy_rep_assignments")
      .select("pharmacy_id")
      .eq("topline_rep_id", user_topline_rep_id);
    
    const userPharmacyIds = new Set(userAssignments?.map((a: any) => a.pharmacy_id) || []);
    
    // Filter: include pharmacy if it's global (not scoped) OR user has access
    eligiblePharmacies = eligiblePharmacies.filter((p: any) => 
      !scopedPharmacyIds.has(p.id) || userPharmacyIds.has(p.id)
    );
    
    console.log(`After topline scoping: ${eligiblePharmacies.length} pharmacies available`);
  }

  console.log(`Found ${eligiblePharmacies.length} eligible pharmacies for state ${destination_state}`);

  if (eligiblePharmacies.length === 0) {
    return { 
      pharmacy_id: null, 
      reason: `No active pharmacies serve state: ${destination_state}` 
    };
  }

  // 3. If only one pharmacy, return it
  if (eligiblePharmacies.length === 1) {
    console.log(`Single pharmacy match: ${eligiblePharmacies[0].name}`);
    return { 
      pharmacy_id: eligiblePharmacies[0].id, 
      reason: `Single pharmacy match: ${eligiblePharmacies[0].name}` 
    };
  }

  // 4. Apply priority routing
  const pharmaciesWithPriority = eligiblePharmacies.map((pharmacy: any) => ({
    ...pharmacy,
    priority: pharmacy.priority_map?.[destination_state] || 999 // Default to lowest
  }));

  // Sort by priority (lowest number = highest priority)
  pharmaciesWithPriority.sort((a: any, b: any) => a.priority - b.priority);

  const selectedPharmacy = pharmaciesWithPriority[0];

  console.log(`Priority routing selected: ${selectedPharmacy.name} (Priority ${selectedPharmacy.priority})`);

  return { 
    pharmacy_id: selectedPharmacy.id, 
    reason: `Priority routing: ${selectedPharmacy.name} (Priority ${selectedPharmacy.priority} for ${destination_state})` 
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Parse and validate JSON
    let requestData;
    try {
      requestData = await req.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = validateRouteOrderRequest(requestData);
    if (!validation.valid) {
      console.warn('Validation failed:', validation.errors);
      return new Response(
        JSON.stringify({ error: 'Invalid request data', details: validation.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { product_id, destination_state, user_topline_rep_id } = requestData;

    if (!product_id || !destination_state) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const result = await routeOrderToPharmacy(
      supabaseClient, 
      product_id, 
      destination_state,
      user_topline_rep_id
    );

    return new Response(
      JSON.stringify(result),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in route-order-to-pharmacy:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'An error occurred processing the request' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
