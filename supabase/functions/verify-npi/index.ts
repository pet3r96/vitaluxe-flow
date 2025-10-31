import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NPPESResult {
  number: string;
  enumeration_type: "NPI-1" | "NPI-2";
  basic: {
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    credential?: string;
    status?: string;
    name?: string;
    enumeration_date?: string;
    last_updated?: string;
  };
  taxonomies?: Array<{
    code: string;
    desc: string;
    primary: boolean;
  }>;
}

interface NPPESResponse {
  result_count: number;
  results: NPPESResult[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { npi } = await req.json();

    console.log(`[verify-npi] Verifying NPI: ${npi}`);

    // Basic validation
    if (!npi || !/^\d{10}$/.test(npi)) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: "NPI must be exactly 10 digits" 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Call NPPES API
    const response = await fetch(
      `https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      console.error(`[verify-npi] NPPES API error: ${response.status}`);
      return new Response(
        JSON.stringify({ 
          valid: true, // Allow submission on API failure
          warning: "Could not verify NPI - registry temporarily unavailable" 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data: NPPESResponse = await response.json();

    if (data.result_count === 0 || !data.results || data.results.length === 0) {
      console.log(`[verify-npi] NPI not found: ${npi}`);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: "NPI not found in NPPES registry" 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const provider = data.results[0];
    const isIndividual = provider.enumeration_type === "NPI-1";
    const isOrganization = provider.enumeration_type === "NPI-2";

    let providerName = "";
    if (isIndividual) {
      const parts = [
        provider.basic.first_name,
        provider.basic.middle_name,
        provider.basic.last_name,
        provider.basic.credential,
      ].filter(Boolean);
      providerName = parts.join(" ");
    } else if (isOrganization) {
      providerName = provider.basic.name || "";
    }

    const primaryTaxonomy = provider.taxonomies?.find((t) => t.primary);
    const specialty = primaryTaxonomy?.desc || "";

    const result = {
      valid: true,
      npi,
      type: isIndividual ? "individual" : "organization",
      providerName: providerName.trim(),
      credential: provider.basic.credential,
      specialty,
      status: provider.basic.status,
      enumerationDate: provider.basic.enumeration_date,
      lastUpdated: provider.basic.last_updated,
      warning: provider.basic.status?.toLowerCase() === "deactivated" 
        ? "This NPI has been deactivated in the registry" 
        : undefined,
    };

    console.log(`[verify-npi] Verified: ${providerName} (${provider.enumeration_type})`);

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('[verify-npi] Error:', error);
    return new Response(
      JSON.stringify({ 
        valid: true, // Allow submission on error
        warning: "Could not verify NPI - please verify manually" 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
