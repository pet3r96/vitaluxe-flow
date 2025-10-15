import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validatePlaidExchangeRequest } from "../_shared/requestValidators.ts";
import { validateCSRFToken } from "../_shared/csrfValidator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse JSON with error handling
    let requestData;
    try {
      requestData = await req.json();
    } catch (error) {
      console.error('Invalid JSON in request body:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input
    const validation = validatePlaidExchangeRequest(requestData);
    if (!validation.valid) {
      console.warn('Validation failed:', validation.errors);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request data', 
          details: validation.errors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate CSRF token
    const { csrf_token, public_token, practice_id } = requestData;
    const csrfValidation = await validateCSRFToken(supabaseClient, user.id, csrf_token);
    if (!csrfValidation.valid) {
      console.warn(`CSRF validation failed for user ${user.email}:`, csrfValidation.error);
      return new Response(
        JSON.stringify({ error: "Security validation failed" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const PLAID_CLIENT_ID = Deno.env.get("PLAID_CLIENT_ID");
    const PLAID_SECRET = Deno.env.get("PLAID_SECRET");
    const PLAID_ENV = "sandbox";

    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      throw new Error("Plaid credentials not configured");
    }

    // Exchange public token for access token
    const exchangeResponse = await fetch(`https://${PLAID_ENV}.plaid.com/item/public_token/exchange`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PLAID-CLIENT-ID": PLAID_CLIENT_ID,
        "PLAID-SECRET": PLAID_SECRET,
      },
      body: JSON.stringify({
        public_token,
      }),
    });

    const exchangeData = await exchangeResponse.json();

    if (!exchangeResponse.ok) {
      console.error("Plaid exchange error:", exchangeData);
      throw new Error(exchangeData.error_message || "Failed to exchange token");
    }

    const { access_token, item_id } = exchangeData;

    // Get account details
    const authResponse = await fetch(`https://${PLAID_ENV}.plaid.com/auth/get`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PLAID-CLIENT-ID": PLAID_CLIENT_ID,
        "PLAID-SECRET": PLAID_SECRET,
      },
      body: JSON.stringify({
        access_token,
      }),
    });

    const authData = await authResponse.json();

    if (!authResponse.ok) {
      console.error("Plaid auth error:", authData);
      throw new Error(authData.error_message || "Failed to get account details");
    }

    // Get the first account (you can modify this to handle multiple accounts)
    const account = authData.accounts[0];

    // Check if this is the first payment method for this practice
    const { data: existingMethods } = await supabaseClient
      .from("practice_payment_methods")
      .select("id")
      .eq("practice_id", practice_id);

    const isFirstMethod = !existingMethods || existingMethods.length === 0;

    // Store in database
    const { error: insertError } = await supabaseClient
      .from("practice_payment_methods")
      .insert({
        practice_id,
        plaid_access_token: access_token,
        plaid_account_id: account.account_id,
        account_name: account.name,
        account_mask: account.mask,
        bank_name: authData.item.institution_id,
        is_default: isFirstMethod, // Set as default if it's the first one
      });

    if (insertError) {
      console.error("Database insert error:", insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        account_id: account.account_id,
        account_name: account.name,
        account_mask: account.mask,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error exchanging token:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
