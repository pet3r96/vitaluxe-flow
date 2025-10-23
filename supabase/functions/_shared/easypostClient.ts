// EasyPost API Client for Supabase Edge Functions
// Provides utilities for address verification, shipment creation, and tracking

interface EasyPostAddress {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
}

interface EasyPostParcel {
  length: number;
  width: number;
  height: number;
  weight: number;
}

interface EasyPostShipment {
  id: string;
  tracking_code: string;
  carrier: string;
  service: string;
  status: string;
  label_url: string;
  tracking_url: string;
  rate: number;
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
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
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
    suggested_city?: string;
    suggested_state?: string;
    confidence: number;
    verification_source: string;
  }> {
    try {
      const response = await this.makeRequest('/addresses/verify', 'POST', {
        address: address
      });

      const verified = response.address;
      const confidence = verified.verifications?.delivery?.confidence || 0;
      const isDeliverable = verified.verifications?.delivery?.success || false;

      // Format address
      const formatted = `${verified.street1}${verified.street2 ? ', ' + verified.street2 : ''}, ${verified.city}, ${verified.state} ${verified.zip}`;

      return {
        is_valid: isDeliverable,
        status: isDeliverable ? 'verified' : 'invalid',
        formatted_address: formatted,
        suggested_city: verified.city,
        suggested_state: verified.state,
        confidence,
        verification_source: 'easypost'
      };
    } catch (error) {
      console.error('Address verification failed:', error);
      // Return invalid status on error
      return {
        is_valid: false,
        status: 'invalid',
        formatted_address: `${address.street1}, ${address.city}, ${address.state} ${address.zip}`,
        confidence: 0,
        verification_source: 'easypost_error'
      };
    }
  }

  /**
   * Create a shipment using EasyPost API
   */
  async createShipment(
    fromAddress: EasyPostAddress,
    toAddress: EasyPostAddress,
    parcel: EasyPostParcel,
    carrierAccounts?: string[]
  ): Promise<EasyPostShipment> {
    try {
      const shipmentData: any = {
        from_address: fromAddress,
        to_address: toAddress,
        parcel: parcel
      };

      if (carrierAccounts && carrierAccounts.length > 0) {
        shipmentData.carrier_accounts = carrierAccounts;
      }

      const response = await this.makeRequest('/shipments', 'POST', shipmentData);

      return {
        id: response.shipment.id,
        tracking_code: response.shipment.tracking_code,
        carrier: response.shipment.selected_rate?.carrier || 'unknown',
        service: response.shipment.selected_rate?.service || 'unknown',
        status: response.shipment.status,
        label_url: response.shipment.postage_label?.label_url || '',
        tracking_url: response.shipment.tracking_url || '',
        rate: parseFloat(response.shipment.selected_rate?.rate || '0')
      };
    } catch (error) {
      console.error('Shipment creation failed:', error);
      throw error;
    }
  }

  /**
   * Get tracking information for a tracking code
   */
  async getTracking(trackingCode: string): Promise<{
    status: string;
    events: EasyPostTrackingEvent[];
    tracking_url: string;
  }> {
    try {
      const response = await this.makeRequest(`/trackers/${trackingCode}`);

      const events = response.tracker.tracking_details?.map((event: any) => ({
        status: event.status,
        message: event.message,
        description: event.description,
        carrier: response.tracker.carrier,
        tracking_details: event,
        datetime: event.datetime
      })) || [];

      return {
        status: response.tracker.status,
        events,
        tracking_url: response.tracker.public_url || ''
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

  /**
   * Get shipment details by ID
   */
  async getShipment(shipmentId: string): Promise<EasyPostShipment> {
    try {
      const response = await this.makeRequest(`/shipments/${shipmentId}`);

      return {
        id: response.shipment.id,
        tracking_code: response.shipment.tracking_code,
        carrier: response.shipment.selected_rate?.carrier || 'unknown',
        service: response.shipment.selected_rate?.service || 'unknown',
        status: response.shipment.status,
        label_url: response.shipment.postage_label?.label_url || '',
        tracking_url: response.shipment.tracking_url || '',
        rate: parseFloat(response.shipment.selected_rate?.rate || '0')
      };
    } catch (error) {
      console.error('Shipment retrieval failed:', error);
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

/**
 * Helper function to create default parcel for shipments
 */
export function createDefaultParcel(): EasyPostParcel {
  return {
    length: 10, // inches
    width: 8,
    height: 4,
    weight: 1 // ounces
  };
}
