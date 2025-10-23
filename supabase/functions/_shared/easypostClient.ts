// EasyPost API Client for Supabase Edge Functions
// Provides utilities for address verification, shipment creation, and tracking

interface EasyPostAddress {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
  name?: string;
  company?: string;
}


interface EasyPostTrackingEvent {
  status: string;
  message: string;
  description: string;
  carrier: string;
  tracking_details: any;
  datetime: string;
}

export class EasyPostClient {
  private apiKey: string;
  private baseUrl: string = 'https://api.easypost.com/v2';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest(endpoint: string, method: string = 'GET', data?: any) {
    const url = `${this.baseUrl}${endpoint}`;
    // EasyPost uses Basic Auth with API key as username and empty password
    const authString = btoa(`${this.apiKey}:`);
    const headers = {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`EasyPost API Error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('EasyPost API request failed:', error);
      throw error;
    }
  }

  /**
   * Verify an address using EasyPost Address Verification API
   */
  async verifyAddress(address: EasyPostAddress): Promise<{
    is_valid: boolean;
    status: 'verified' | 'invalid' | 'suggested';
    formatted_address: string;
    suggested_street?: string;
    suggested_city?: string;
    suggested_state?: string;
    suggested_zip?: string;
    confidence: number;
    verification_source: string;
    error_details?: string[];
  }> {
    try {
      console.log('🔍 EasyPost: Verifying address:', JSON.stringify(address, null, 2));
      
      const response = await this.makeRequest('/addresses', 'POST', {
        address: address,
        verify: ["delivery"]
      });

      console.log('📦 EasyPost: Raw API response:', JSON.stringify(response, null, 2));

      // EasyPost returns address data directly at root level, not nested under .address
      const verified = response;

      // Validate response structure
      if (!verified) {
        console.error('❌ EasyPost returned empty response');
        throw new Error('EasyPost API returned empty response. Check API key permissions.');
      }

      // Check if verifications object exists
      if (!verified.verifications) {
        console.error('❌ EasyPost response missing verifications:', {
          has_address: !!verified,
          address_id: verified.id,
          street1: verified.street1,
          city: verified.city,
          state: verified.state,
          zip: verified.zip
        });
        
        throw new Error(
          'EasyPost API key may be invalid or lacks verification permissions. ' +
          'Verifications object missing from response. ' +
          'Please verify your EASYPOST_API_KEY is correct and has address verification enabled.'
        );
      }

      const deliveryVerification = verified.verifications.delivery;
      
      if (!deliveryVerification) {
        console.error('❌ EasyPost response missing delivery verification:', verified.verifications);
        throw new Error('EasyPost response missing delivery verification data');
      }

      console.log('✅ EasyPost: Verification successful', {
        success: deliveryVerification.success,
        confidence: deliveryVerification.confidence,
        errors: deliveryVerification.errors
      });

      const confidence = deliveryVerification.confidence || 0;
      const isDeliverable = deliveryVerification.success || false;

      // Format address
      const formatted = `${verified.street1}${verified.street2 ? ', ' + verified.street2 : ''}, ${verified.city}, ${verified.state} ${verified.zip}`;

      // Collect error details if address was corrected
      const errorDetails: string[] = [];
      if (address.street1 !== verified.street1) {
        errorDetails.push(`Street corrected: ${address.street1} → ${verified.street1}`);
      }
      if (address.city?.toLowerCase() !== verified.city?.toLowerCase()) {
        errorDetails.push(`City corrected: ${address.city} → ${verified.city}`);
      }
      if (address.state !== verified.state) {
        errorDetails.push(`State corrected: ${address.state} → ${verified.state}`);
      }
      if (address.zip !== verified.zip) {
        errorDetails.push(`ZIP corrected: ${address.zip} → ${verified.zip}`);
      }

      // Add delivery verification errors if any
      if (deliveryVerification.errors && deliveryVerification.errors.length > 0) {
        deliveryVerification.errors.forEach((err: any) => {
          if (err.message) errorDetails.push(err.message);
        });
      }

      return {
        is_valid: isDeliverable,
        status: isDeliverable ? 'verified' : 'invalid',
        formatted_address: formatted,
        suggested_street: verified.street1,
        suggested_city: verified.city,
        suggested_state: verified.state,
        suggested_zip: verified.zip,
        confidence,
        verification_source: 'easypost',
        error_details: errorDetails.length > 0 ? errorDetails : undefined
      };
    } catch (error) {
      console.error('❌ Address verification failed:', error);
      
      // Return invalid status on error with helpful message
      return {
        is_valid: false,
        status: 'invalid',
        formatted_address: `${address.street1}, ${address.city}, ${address.state} ${address.zip}`,
        confidence: 0,
        verification_source: 'easypost_error',
        error_details: [(error as Error).message]
      };
    }
  }


  /**
   * Get tracking information for a tracking code
   */
  async getTracking(trackingCode: string): Promise<{
    status: string;
    events: EasyPostTrackingEvent[];
    tracking_url: string;
    carrier?: string;
    est_delivery_date?: string;
    signed_by?: string;
    weight?: number;
    carrier_detail?: any;
  }> {
    try {
      // Create a tracker first (EasyPost requires this for new tracking codes)
      const response = await this.makeRequest('/trackers', 'POST', {
        tracking_code: trackingCode
      });

      const tracker = response;
      const events = tracker.tracking_details?.map((event: any) => ({
        status: event.status,
        message: event.message,
        description: event.description,
        carrier: tracker.carrier,
        tracking_details: event,
        datetime: event.datetime
      })) || [];

      return {
        status: tracker.status,
        events,
        tracking_url: tracker.public_url || '',
        carrier: tracker.carrier,
        est_delivery_date: tracker.est_delivery_date,
        signed_by: tracker.signed_by,
        weight: tracker.weight,
        carrier_detail: tracker.carrier_detail
      };
    } catch (error) {
      console.error('Tracking retrieval failed:', error);
      throw error;
    }
  }

  /**
   * Create a tracker for a tracking code
   */
  async createTracker(trackingCode: string, carrier: string): Promise<{
    id: string;
    status: string;
    tracking_url: string;
  }> {
    try {
      const response = await this.makeRequest('/trackers', 'POST', {
        tracking_code: trackingCode,
        carrier: carrier
      });

      return {
        id: response.tracker.id,
        status: response.tracker.status,
        tracking_url: response.tracker.public_url || ''
      };
    } catch (error) {
      console.error('Tracker creation failed:', error);
      throw error;
    }
  }

}

/**
 * Create EasyPost client instance with API key from environment
 */
export function createEasyPostClient(): EasyPostClient {
  const apiKey = Deno.env.get('EASYPOST_API_KEY');
  if (!apiKey) {
    throw new Error('EASYPOST_API_KEY environment variable is not set');
  }
  return new EasyPostClient(apiKey);
}

/**
 * Helper function to format address for EasyPost API
 */
export function formatAddressForEasyPost(
  street: string,
  city: string,
  state: string,
  zip: string,
  country: string = 'US'
): EasyPostAddress {
  return {
    street1: street,
    city: city,
    state: state,
    zip: zip,
    country: country
  };
}

