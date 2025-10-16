import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { validateValidateAddressRequest } from "../_shared/requestValidators.ts";
import { RateLimiter, RATE_LIMITS, getClientIP } from "../_shared/rateLimiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AddressInput {
  street?: string;
  city?: string;
  state?: string;
  zip: string;
  manual_override?: boolean;
}

interface ValidationResponse {
  is_valid: boolean;
  formatted_address?: string;
  suggested_city?: string;
  suggested_state?: string;
  verification_source?: string;
  status: 'verified' | 'invalid' | 'manual';
  error?: string;
  raw_response?: any;
}

async function validateZipCode(zip: string): Promise<ValidationResponse> {
  try {
    const cleanZip = zip.replace(/\D/g, '').slice(0, 5);
    
    if (cleanZip.length !== 5) {
      return {
        is_valid: false,
        status: 'invalid',
        error: 'ZIP code must be 5 digits'
      };
    }

    const response = await fetch(`https://api.zippopotam.us/us/${cleanZip}`);
    
    if (!response.ok) {
      return {
        is_valid: false,
        status: 'invalid',
        error: 'Invalid ZIP code - not found in database'
      };
    }

    const data = await response.json();
    const place = data.places[0];
    const suggestedCity = place['place name'];
    const suggestedState = place['state abbreviation'];

    return {
      is_valid: true,
      status: 'verified',
      suggested_city: suggestedCity,
      suggested_state: suggestedState,
      verification_source: 'zippopotam.us',
      raw_response: data
    };
  } catch (error) {
    console.error('ZIP validation error:', error);
    return {
      is_valid: false,
      status: 'invalid',
      error: (error as Error).message || 'Failed to validate ZIP code'
    };
  }
}

function formatAddress(street: string, city: string, state: string, zip: string): string {
  const formatTitleCase = (str: string) => 
    str.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

  const formattedStreet = formatTitleCase(street.trim());
  const formattedCity = formatTitleCase(city.trim());
  const formattedState = state.trim().toUpperCase();
  const formattedZip = zip.replace(/\D/g, '').slice(0, 5);

  return `${formattedStreet}, ${formattedCity}, ${formattedState} ${formattedZip}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting
    const limiter = new RateLimiter();
    const clientIP = getClientIP(req);
    const { allowed } = await limiter.checkLimit(
      null,
      clientIP,
      'validate-address',
      { maxRequests: 100, windowSeconds: 3600 } // 100 per hour
    );

    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
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

    const validation = validateValidateAddressRequest(requestData);
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

    const { street, city, state, zip, manual_override }: AddressInput = requestData;

    if (!zip) {
      return new Response(
        JSON.stringify({ 
          is_valid: false, 
          status: 'invalid',
          error: 'ZIP code is required' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const zipValidation = await validateZipCode(zip);

    if (!zipValidation.is_valid) {
      return new Response(
        JSON.stringify(zipValidation),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (manual_override) {
      const formatted = formatAddress(
        street || '',
        city || zipValidation.suggested_city || '',
        state || zipValidation.suggested_state || '',
        zip
      );

      return new Response(
        JSON.stringify({
          is_valid: true,
          status: 'manual',
          formatted_address: formatted,
          suggested_city: zipValidation.suggested_city,
          suggested_state: zipValidation.suggested_state,
          verification_source: 'manual_override'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    let status: 'verified' | 'invalid' = 'verified';
    let error: string | undefined;

    if (city && city.toLowerCase() !== zipValidation.suggested_city?.toLowerCase()) {
      status = 'invalid';
      error = `City mismatch: ZIP ${zip} is in ${zipValidation.suggested_city}, not ${city}`;
    }

    if (state && state.toUpperCase() !== zipValidation.suggested_state?.toUpperCase()) {
      status = 'invalid';
      error = `State mismatch: ZIP ${zip} is in ${zipValidation.suggested_state}, not ${state}`;
    }

    const finalCity = city || zipValidation.suggested_city || '';
    const finalState = state || zipValidation.suggested_state || '';
    
    const formatted = formatAddress(street || '', finalCity, finalState, zip);

    return new Response(
      JSON.stringify({
        is_valid: status === 'verified',
        status,
        formatted_address: formatted,
        suggested_city: zipValidation.suggested_city,
        suggested_state: zipValidation.suggested_state,
        verification_source: zipValidation.verification_source,
        error
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Address validation error:', error);
    return new Response(
      JSON.stringify({ 
        is_valid: false,
        status: 'invalid',
        error: (error as Error).message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
