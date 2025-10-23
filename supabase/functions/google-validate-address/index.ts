import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AddressInput {
  street: string;
  city: string;
  state: string;
  zip: string;
}

interface ValidationResponse {
  is_valid: boolean;
  formatted_address?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  verification_source: string;
  error?: string;
  suggestions?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    formatted_address?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { street, city, state, zip, manual_override } = await req.json() as AddressInput & { manual_override?: boolean };
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');

    if (!GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY not configured');
    }

    console.log('📍 Google Address Validation: Processing address:', { street, city, state, zip });

    // If manual override, skip validation
    if (manual_override) {
      return new Response(
        JSON.stringify({
          is_valid: true,
          formatted_address: `${street}, ${city}, ${state} ${zip}`,
          street,
          city,
          state,
          zip,
          verification_source: 'manual',
        } as ValidationResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build address for Google API
    const addressLines = [street, `${city}, ${state} ${zip}`].filter(Boolean);

    // Call Google Address Validation API
    const response = await fetch(
      `https://addressvalidation.googleapis.com/v1:validateAddress?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: {
            regionCode: 'US',
            addressLines,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Google API error:', response.status, errorText);
      throw new Error(`Google API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('📦 Google API response:', JSON.stringify(data, null, 2));

    const result = data.result;
    const verdict = result?.verdict;
    const address = result?.address;

    // Check validation quality
    const hasUnconfirmedComponents = verdict?.hasUnconfirmedComponents || false;
    const hasInferredComponents = verdict?.hasInferredComponents || false;
    const validationGranularity = verdict?.validationGranularity || 'GRANULARITY_UNSPECIFIED';

    // Extract address components
    const postalAddress = address?.postalAddress;
    const addressComponents = address?.addressComponents || [];

    let validatedStreet = '';
    let validatedCity = '';
    let validatedState = '';
    let validatedZip = '';

    // Parse address components
    for (const component of addressComponents) {
      const componentType = component.componentType;
      const value = component.componentName?.text || '';

      if (componentType === 'street_number' || componentType === 'route') {
        validatedStreet = validatedStreet ? `${validatedStreet} ${value}` : value;
      } else if (componentType === 'locality') {
        validatedCity = value;
      } else if (componentType === 'administrative_area_level_1') {
        validatedState = value;
      } else if (componentType === 'postal_code') {
        validatedZip = value;
      }
    }

    // Use postalAddress as fallback
    if (!validatedStreet && postalAddress?.addressLines?.[0]) {
      validatedStreet = postalAddress.addressLines[0];
    }
    if (!validatedCity && postalAddress?.locality) {
      validatedCity = postalAddress.locality;
    }
    if (!validatedState && postalAddress?.administrativeArea) {
      validatedState = postalAddress.administrativeArea;
    }
    if (!validatedZip && postalAddress?.postalCode) {
      validatedZip = postalAddress.postalCode;
    }

    const formattedAddress = address?.formattedAddress || `${validatedStreet}, ${validatedCity}, ${validatedState} ${validatedZip}`;

    // Determine if address is valid
    const isHighQuality = validationGranularity === 'PREMISE' || validationGranularity === 'SUB_PREMISE';
    const isValid = isHighQuality && !hasUnconfirmedComponents;

    if (isValid) {
      // Address is valid
      return new Response(
        JSON.stringify({
          is_valid: true,
          formatted_address: formattedAddress,
          street: validatedStreet,
          city: validatedCity,
          state: validatedState,
          zip: validatedZip,
          verification_source: 'google_places',
        } as ValidationResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (hasInferredComponents || hasUnconfirmedComponents) {
      // Address has corrections/suggestions
      return new Response(
        JSON.stringify({
          is_valid: false,
          formatted_address: formattedAddress,
          verification_source: 'google_places',
          suggestions: {
            street: validatedStreet,
            city: validatedCity,
            state: validatedState,
            zip: validatedZip,
            formatted_address: formattedAddress,
          },
          error: 'Address has unconfirmed or inferred components. Please review the suggested corrections.',
        } as ValidationResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Address is invalid
      return new Response(
        JSON.stringify({
          is_valid: false,
          verification_source: 'google_places',
          error: 'Unable to validate address. Please check the address and try again.',
        } as ValidationResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('❌ Error in google-validate-address:', error);
    return new Response(
      JSON.stringify({
        is_valid: false,
        verification_source: 'google_places',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      } as ValidationResponse),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
