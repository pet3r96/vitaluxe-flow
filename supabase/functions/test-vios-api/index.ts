import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VIOS_API_URL = "https://integrationapi.vioscompounding.com";

interface TestResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
  duration?: number;
}

interface TestResults {
  tokenTest: TestResult;
  ordersTest: TestResult;
  allergiesTest: TestResult;
  overallSuccess: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is admin
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claims?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", claims.claims.sub);
    
    const isAdmin = userRoles?.some(r => ["admin", "super_admin"].includes(r.role));
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get VIOS credentials
    const viosClientId = Deno.env.get("VIOS_CLIENT_ID");
    const viosClientSecret = Deno.env.get("VIOS_CLIENT_SECRET");

    if (!viosClientId || !viosClientSecret) {
      return new Response(
        JSON.stringify({
          error: "VIOS credentials not configured",
          tokenTest: { success: false, message: "VIOS_CLIENT_ID or VIOS_CLIENT_SECRET not set" },
          ordersTest: { success: false, message: "Skipped - no token" },
          allergiesTest: { success: false, message: "Skipped - no token" },
          overallSuccess: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: TestResults = {
      tokenTest: { success: false, message: "" },
      ordersTest: { success: false, message: "" },
      allergiesTest: { success: false, message: "" },
      overallSuccess: false,
    };

    // Test 1: Token Authentication
    let accessToken: string | null = null;
    const tokenStart = Date.now();
    try {
      console.log("[VIOS Test] Testing token endpoint...");
      
      const tokenResponse = await fetch(`${VIOS_API_URL}/api/auth/token`, {
        method: "POST",
        headers: {
          "ClientId": viosClientId,
          "ClientSecret": viosClientSecret,
          "Content-Type": "application/json",
        },
      });

      const tokenDuration = Date.now() - tokenStart;

      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        accessToken = tokenData.accessToken || tokenData.access_token;
        
        if (accessToken) {
          results.tokenTest = {
            success: true,
            message: "Authentication successful",
            details: {
              tokenPreview: `${accessToken.substring(0, 20)}...`,
              responseTime: `${tokenDuration}ms`,
            },
            duration: tokenDuration,
          };
        } else {
          results.tokenTest = {
            success: false,
            message: "No access token in response",
            details: { responseKeys: Object.keys(tokenData) },
            duration: tokenDuration,
          };
        }
      } else {
        const errorText = await tokenResponse.text();
        results.tokenTest = {
          success: false,
          message: `HTTP ${tokenResponse.status}: ${tokenResponse.statusText}`,
          details: { error: errorText.substring(0, 200) },
          duration: tokenDuration,
        };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      results.tokenTest = {
        success: false,
        message: `Connection error: ${errorMessage}`,
        duration: Date.now() - tokenStart,
      };
    }

    // Test 2: Orders Endpoint
    if (accessToken) {
      const ordersStart = Date.now();
      try {
        console.log("[VIOS Test] Testing orders endpoint...");
        
        const ordersResponse = await fetch(`${VIOS_API_URL}/api/orders?PageSize=5&PageNumber=1`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });

        const ordersDuration = Date.now() - ordersStart;

        if (ordersResponse.ok) {
          const ordersData = await ordersResponse.json();
          results.ordersTest = {
            success: true,
            message: "Orders endpoint accessible",
            details: {
              totalOrders: ordersData.totalCount ?? ordersData.items?.length ?? 0,
              pageSize: ordersData.pageSize,
              hasData: (ordersData.items?.length ?? 0) > 0,
            },
            duration: ordersDuration,
          };
        } else {
          const errorText = await ordersResponse.text();
          results.ordersTest = {
            success: false,
            message: `HTTP ${ordersResponse.status}: ${ordersResponse.statusText}`,
            details: { error: errorText.substring(0, 200) },
            duration: ordersDuration,
          };
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        results.ordersTest = {
          success: false,
          message: `Connection error: ${errorMessage}`,
          duration: Date.now() - ordersStart,
        };
      }
    } else {
      results.ordersTest = {
        success: false,
        message: "Skipped - authentication failed",
      };
    }

    // Test 3: Allergies Endpoint
    if (accessToken) {
      const allergiesStart = Date.now();
      try {
        console.log("[VIOS Test] Testing allergies endpoint...");
        
        const allergiesResponse = await fetch(`${VIOS_API_URL}/api/allergies?PageSize=10&PageNumber=1`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });

        const allergiesDuration = Date.now() - allergiesStart;

        if (allergiesResponse.ok) {
          const allergiesData = await allergiesResponse.json();
          results.allergiesTest = {
            success: true,
            message: "Allergies endpoint accessible",
            details: {
              totalAllergies: allergiesData.totalCount ?? allergiesData.items?.length ?? 0,
              sampleItems: allergiesData.items?.slice(0, 3).map((a: any) => a.name),
            },
            duration: allergiesDuration,
          };
        } else {
          const errorText = await allergiesResponse.text();
          results.allergiesTest = {
            success: false,
            message: `HTTP ${allergiesResponse.status}: ${allergiesResponse.statusText}`,
            details: { error: errorText.substring(0, 200) },
            duration: allergiesDuration,
          };
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        results.allergiesTest = {
          success: false,
          message: `Connection error: ${errorMessage}`,
          duration: Date.now() - allergiesStart,
        };
      }
    } else {
      results.allergiesTest = {
        success: false,
        message: "Skipped - authentication failed",
      };
    }

    // Overall success
    results.overallSuccess = results.tokenTest.success && 
                             results.ordersTest.success && 
                             results.allergiesTest.success;

    console.log("[VIOS Test] Complete:", results.overallSuccess ? "ALL PASSED" : "SOME FAILED");

    return new Response(
      JSON.stringify(results),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[VIOS Test] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
