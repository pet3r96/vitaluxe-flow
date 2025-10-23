import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { validateValidateAddressRequest } from "../_shared/requestValidators.ts";
import { RateLimiter, RATE_LIMITS, getClientIP } from "../_shared/rateLimiter.ts";
import { createEasyPostClient, formatAddressForEasyPost } from "../_shared/easypostClient.ts";

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
  suggested_street?: string;
  suggested_city?: string;
  suggested_state?: string;
  suggested_zip?: string;
  verification_source?: string;
  status: 'verified' | 'invalid' | 'manual';
  error?: string;
  error_details?: string[];
  raw_response?: any;
  confidence?: number;
}

async function validateAddressWithEasyPost(address: AddressInput): Promise<ValidationResponse> {
  try {
    console.log('🚀 Starting EasyPost validation for:', { 
      street: address.street, 
      city: address.city, 
      state: address.state, 
      zip: address.zip 
    });
    
    // Check if API key is configured
    const apiKey = Deno.env.get('EASYPOST_API_KEY');
    console.log('🔑 EASYPOST_API_KEY configured:', !!apiKey, apiKey ? `(starts with ${apiKey.substring(0, 4)}...)` : '(not set)');
    
    const easyPostClient = createEasyPostClient();
    
    const easyPostAddress = formatAddressForEasyPost(
      address.street || '',
      address.city || '',
      address.state || '',
      address.zip
    );

    const result = await easyPostClient.verifyAddress(easyPostAddress);
    
    console.log('✅ EasyPost validation complete:', {
      is_valid: result.is_valid,
      status: result.status,
      has_error_details: !!result.error_details
    });
    
    // Map EasyPost status to our status type
    let mappedStatus: 'verified' | 'invalid' | 'manual' = 'invalid';
    if (result.status === 'verified') mappedStatus = 'verified';
    else if (result.status === 'suggested') mappedStatus = 'verified';
    
    return {
      is_valid: result.is_valid,
      status: mappedStatus,
      formatted_address: result.formatted_address,
      suggested_street: result.suggested_street,
      suggested_city: result.suggested_city,
      suggested_state: result.suggested_state,
      suggested_zip: result.suggested_zip,
      verification_source: result.verification_source,
      confidence: result.confidence,
      error_details: result.error_details,
      error: result.error_details && result.error_details.length > 0 
        ? result.error_details.join('; ') 
        : undefined
    };
  } catch (error) {
    const errorMsg = (error as Error).message || 'Unknown error';
    console.error('❌ EasyPost address validation error:', errorMsg);
    
    // Provide helpful error messages based on error type
    let userFriendlyError = errorMsg;
    
    if (errorMsg.includes('EASYPOST_API_KEY')) {
      userFriendlyError = '⚠️ EasyPost API key not configured. Please contact administrator.';
    } else if (errorMsg.includes('verifications')) {
      userFriendlyError = '⚠️ EasyPost API key may be invalid or lack permissions. Please verify configuration.';
    } else if (errorMsg.includes('API Error: 401')) {
      userFriendlyError = '⚠️ EasyPost authentication failed. API key is invalid.';
    } else if (errorMsg.includes('API Error: 403')) {
      userFriendlyError = '⚠️ EasyPost API key lacks permission for address verification.';
    }
    
    return {
      is_valid: false,
      status: 'invalid',
      error: userFriendlyError,
      verification_source: 'easypost_error'
    };
  }
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

    const requestValidation = validateValidateAddressRequest(requestData);
    if (!requestValidation.valid) {
      console.warn('Validation failed:', requestValidation.errors);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request data', 
          details: requestValidation.errors 
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

    // Validate we have minimum required data for full address verification
    const hasMinimumData = street && street.trim().length >= 3;

    if (!hasMinimumData) {
      console.log('Insufficient data for EasyPost (missing street), using ZIP-only validation');
      
      // Skip EasyPost and go straight to ZIP-only validation
      const zipValidation = await validateZipCode(zip);
      
      if (!zipValidation.is_valid) {
        return new Response(
          JSON.stringify(zipValidation),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      
      // Return ZIP validation result with note about incomplete data
      return new Response(
        JSON.stringify({
          ...zipValidation,
          verification_source: 'zip_only_incomplete_data'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Try EasyPost first for full address verification
    let addressValidation: ValidationResponse;
    try {
      addressValidation = await validateAddressWithEasyPost({ street, city, state, zip, manual_override });
    } catch (validationError) {
      const errorMessage = (validationError as Error).message || '';
      
      // Don't log as error if it's just incomplete data or unable to verify
      if (errorMessage.includes('Unable to verify address')) {
        console.warn('EasyPost could not verify address, falling back to ZIP validation');
      } else {
        console.error('EasyPost validation failed, falling back to ZIP validation:', validationError);
      }
      // Fallback to ZIP-only validation if EasyPost fails
      const zipValidation = await validateZipCode(zip);
      
      if (!zipValidation.is_valid) {
        return new Response(
          JSON.stringify(zipValidation),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Use ZIP validation logic as fallback
      let status: 'verified' | 'invalid' = 'verified';
      let errorMsg: string | undefined;

      if (city && city.toLowerCase() !== zipValidation.suggested_city?.toLowerCase()) {
        status = 'invalid';
        errorMsg = `City mismatch: ZIP ${zip} is in ${zipValidation.suggested_city}, not ${city}`;
      }

      if (state && state.toUpperCase() !== zipValidation.suggested_state?.toUpperCase()) {
        status = 'invalid';
        errorMsg = `State mismatch: ZIP ${zip} is in ${zipValidation.suggested_state}, not ${state}`;
      }

      const finalCity = city || zipValidation.suggested_city || '';
      const finalState = state || zipValidation.suggested_state || '';
      
      const formatted = formatAddress(street || '', finalCity, finalState, zip);

      addressValidation = {
        is_valid: status === 'verified',
        status,
        formatted_address: formatted,
        suggested_city: zipValidation.suggested_city,
        suggested_state: zipValidation.suggested_state,
        verification_source: zipValidation.verification_source,
        error: errorMsg
      };
    }

    if (manual_override) {
      const formatted = formatAddress(
        street || '',
        city || addressValidation.suggested_city || '',
        state || addressValidation.suggested_state || '',
        zip
      );

      return new Response(
        JSON.stringify({
          is_valid: true,
          status: 'manual',
          formatted_address: formatted,
          suggested_city: addressValidation.suggested_city,
          suggested_state: addressValidation.suggested_state,
          verification_source: 'manual_override'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify(addressValidation),
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
