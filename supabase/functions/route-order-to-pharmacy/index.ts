import { createAdminClient } from '../_shared/supabaseAdmin.ts';
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

/**
 * Helper function to safely extract priority from priority_map
 * Validates structure and normalizes state code case
 * @param pharmacy - Pharmacy object with priority_map
 * @param state - Two-letter state code
 * @returns Priority number (lower = higher priority, 999 = default/lowest)
 */
function getPriority(pharmacy: any, state: string): number {
  // Validate priority_map exists and is an object
  if (!pharmacy.priority_map || typeof pharmacy.priority_map !== 'object') {
    return 999;
  }
  
  // Try both uppercase and lowercase versions of state code
  const priorityUpper = pharmacy.priority_map[state.toUpperCase()];
  const priorityLower = pharmacy.priority_map[state.toLowerCase()];
  const priority = priorityUpper ?? priorityLower;
  
  // Validate priority is a positive number
  return typeof priority === 'number' && priority > 0 ? priority : 999;
}

/**
 * Routes an order to the best available pharmacy based on:
 * - Product assignment
 * - State servicing
 * - Topline rep scoping
 * - Priority system (lower number = higher priority)
 * - Random selection among same-priority pharmacies for load distribution
 */
async function routeOrderToPharmacy(
  supabase: any,
  product_id: string,
  destination_state: string,
  user_topline_rep_id?: string | null
): Promise<RoutingResult> {
  // Validate destination_state
  if (!destination_state || typeof destination_state !== 'string') {
    return {
      pharmacy_id: null,
      reason: 'Invalid destination state: state is required'
    };
  }

  const trimmedState = destination_state.trim();
  if (trimmedState.length === 0) {
    return {
      pharmacy_id: null,
      reason: 'Invalid destination state: state cannot be empty'
    };
  }

  if (!/^[A-Z]{2}$/.test(trimmedState)) {
    return {
      pharmacy_id: null,
      reason: `Invalid destination state: "${trimmedState}" must be a 2-letter US state code`
    };
  }

  console.log(`Routing order for product ${product_id} to state ${trimmedState}, topline: ${user_topline_rep_id || 'N/A'}`);

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

  console.log(`Product pharmacies query result: ${assignments?.length || 0} assignments found`);
  console.log(`[DIAGNOSTIC] Product: ${product_id}, State: ${trimmedState}, Assignments found: ${assignments?.length || 0}`);
  
  if (!assignments || assignments.length === 0) {
    console.log("No pharmacies assigned to product");
    console.log(`[DIAGNOSTIC] Zero assignments - product_id: ${product_id} has no pharmacies in product_pharmacies table`);
    return { 
      pharmacy_id: null, 
      reason: "No pharmacies assigned to product" 
    };
  }

  // 2. Filter pharmacies that serve the destination state AND are active
  let eligiblePharmacies = assignments
    .map((a: any) => a.pharmacy)
    .filter((p: any) => 
      p && p.active && p.states_serviced?.includes(trimmedState)
    );

  // 3. Apply topline scoping filter if user has a topline (OPTIMIZED QUERY)
  if (user_topline_rep_id) {
    const pharmacyIds = eligiblePharmacies.map((p: any) => p.id);
    
    // Single query to get all scope data
    const { data: scopeData } = await supabase
      .from("pharmacy_rep_assignments")
      .select("pharmacy_id, topline_rep_id")
      .in("pharmacy_id", pharmacyIds);
    
    // Build sets for efficient lookups
    const scopedPharmacyIds = new Set(scopeData?.map((s: any) => s.pharmacy_id) || []);
    const userPharmacyIds = new Set(
      scopeData?.filter((s: any) => s.topline_rep_id === user_topline_rep_id)
        .map((s: any) => s.pharmacy_id) || []
    );
    
    // Filter: include pharmacy if it's global (not scoped) OR user has access
    eligiblePharmacies = eligiblePharmacies.filter((p: any) => 
      !scopedPharmacyIds.has(p.id) || userPharmacyIds.has(p.id)
    );
    
    console.log(`After topline scoping: ${eligiblePharmacies.length} pharmacies available`);
  }

  console.log(`Found ${eligiblePharmacies.length} eligible pharmacies for state ${trimmedState}`);
  console.log(`[DIAGNOSTIC] Eligible count: ${eligiblePharmacies.length}, State: ${trimmedState}, User topline: ${user_topline_rep_id || 'none'}`);

  if (eligiblePharmacies.length === 0) {
    const diagnostics = {
      total_assignments: assignments.length,
      active_pharmacies: assignments.filter((a: any) => a.pharmacy?.active).length,
      pharmacies_serving_state: assignments.filter((a: any) => 
        a.pharmacy?.active && a.pharmacy?.states_serviced?.includes(trimmedState)
      ).length,
      filtered_by_topline: user_topline_rep_id ? true : false
    };
    console.log(`[DIAGNOSTIC] No eligible pharmacies - breakdown:`, diagnostics);
    
    await supabase.from("order_routing_log").insert({
      product_id,
      destination_state: trimmedState,
      user_topline_rep_id,
      eligible_pharmacies: [],
      selected_pharmacy_id: null,
      selected_pharmacy_name: null,
      selection_reason: `No active pharmacies serve state: ${trimmedState}. Diagnostics: ${JSON.stringify(diagnostics)}`,
      priority_used: null
    });
    
    return { 
      pharmacy_id: null, 
      reason: `No active pharmacies serve state: ${trimmedState}` 
    };
  }

  // 4. Single pharmacy match
  if (eligiblePharmacies.length === 1) {
    const selectedPharmacy = eligiblePharmacies[0];
    const priority = getPriority(selectedPharmacy, trimmedState);
    
    console.log(`Single pharmacy match: ${selectedPharmacy.name}`);
    
    await supabase.from("order_routing_log").insert({
      product_id,
      destination_state: trimmedState,
      user_topline_rep_id,
      eligible_pharmacies: [{
        id: selectedPharmacy.id,
        name: selectedPharmacy.name,
        priority
      }],
      selected_pharmacy_id: selectedPharmacy.id,
      selected_pharmacy_name: selectedPharmacy.name,
      selection_reason: `Single pharmacy match: ${selectedPharmacy.name}`,
      priority_used: priority
    });
    
    return { 
      pharmacy_id: selectedPharmacy.id, 
      reason: `Single pharmacy match: ${selectedPharmacy.name}` 
    };
  }

  // 5. Apply priority routing with validated priority extraction
  const pharmaciesWithPriority = eligiblePharmacies.map((pharmacy: any) => ({
    ...pharmacy,
    priority: getPriority(pharmacy, trimmedState)
  }));

  // Sort by priority (lowest number = highest priority)
  // Tie-breaker: alphabetical by name for consistency
  pharmaciesWithPriority.sort((a: any, b: any) => {
    const priorityDiff = a.priority - b.priority;
    if (priorityDiff !== 0) return priorityDiff;
    return a.name.localeCompare(b.name);
  });

  // Log all eligible pharmacies with their priorities
  console.log(`Eligible pharmacies for ${trimmedState}:`, 
    pharmaciesWithPriority.map((p: any) => ({ 
      name: p.name, 
      priority: p.priority,
      id: p.id 
    }))
  );

  // 6. Random selection within highest priority tier
  const highestPriority = pharmaciesWithPriority[0].priority;
  const topPriorityPharmacies = pharmaciesWithPriority.filter(
    (p: any) => p.priority === highestPriority
  );

  // Random selection for load distribution
  const selectedPharmacy = topPriorityPharmacies[
    Math.floor(Math.random() * topPriorityPharmacies.length)
  ];

  console.log(`Priority routing selected: ${selectedPharmacy.name} (Priority ${selectedPharmacy.priority})`);
  console.log(`Selected from ${topPriorityPharmacies.length} pharmacies with same priority`);
  console.log(`[DIAGNOSTIC] SUCCESS - Pharmacy: ${selectedPharmacy.id} (${selectedPharmacy.name}), Priority: ${selectedPharmacy.priority}, Candidates: ${topPriorityPharmacies.length}`);

  // 7. Audit logging
  await supabase.from("order_routing_log").insert({
    product_id,
    destination_state: trimmedState,
    user_topline_rep_id,
    eligible_pharmacies: pharmaciesWithPriority.map((p: any) => ({
      id: p.id,
      name: p.name,
      priority: p.priority
    })),
    selected_pharmacy_id: selectedPharmacy.id,
    selected_pharmacy_name: selectedPharmacy.name,
    selection_reason: `Priority routing: ${selectedPharmacy.name} (Priority ${selectedPharmacy.priority} for ${trimmedState}, randomly selected from ${topPriorityPharmacies.length} pharmacy(ies) with same priority)`,
    priority_used: selectedPharmacy.priority
  });

  return { 
    pharmacy_id: selectedPharmacy.id, 
    reason: `Priority routing: ${selectedPharmacy.name} (Priority ${selectedPharmacy.priority} for ${trimmedState})` 
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use service role key to bypass RLS for system tables (product_pharmacies, pharmacy_rep_assignments)
    const supabaseClient = createAdminClient();
    // No Authorization header needed - service role bypasses RLS

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
