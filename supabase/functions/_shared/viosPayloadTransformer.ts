/**
 * VIOS Webhook Payload Transformer
 * Converts VIOS prescription webhook payloads to our standard format
 * 
 * KEY POINTS (per VIOS Integration Portal):
 * - Webhooks are sent per prescription (rx), NOT per order
 * - Each webhook contains an array with exactly one item
 * - If an order contains multiple prescriptions and they both get shipped,
 *   you will receive SEPARATE webhook notifications for each prescription
 * - Shipping and tracking information will be populated when available
 * - Always an array format, even for single prescriptions
 * 
 * Reference: VIOS Integration Portal documentation
 */

import { edgeLogger } from './logger.ts';

export interface StandardWebhookPayload {
  pharmacy_order_id?: string;
  order_line_id?: string;
  vitaluxe_order_number?: string;
  status: string;
  status_details?: string;
  tracking_number?: string;
  carrier?: string;
  delivery_service?: string;       // e.g., "UPS Ground"
  service?: string;                // e.g., "Ground"
  estimated_delivery?: string;
  actual_delivery?: string;
  location?: string;
  status_datetime?: string;
  vios_rx_number?: string;
  vios_order_id?: string;
  vios_fill_id?: string;
  raw_vios_data?: any;
}

/**
 * Detects if payload is in VIOS format
 * VIOS webhooks have fields like: rxNumber, rxStatus, pharmacyLocation, referenceId
 */
export function isViosPayload(payload: any): boolean {
  if (!payload || typeof payload !== 'object') return false;
  
  // If it's an array, check the first item
  if (Array.isArray(payload)) {
    if (payload.length === 0) return false;
    const first = payload[0];
    return !!(
      first.rxNumber || 
      first.rxStatus || 
      first.pharmacyLocation ||
      first.foreignRxNumber ||
      first.referenceId
    );
  }
  
  // Check single object for VIOS-specific fields
  return !!(
    payload.rxNumber || 
    payload.rxStatus || 
    payload.pharmacyLocation ||
    payload.foreignRxNumber ||
    payload.referenceId
  );
}

/**
 * Maps VIOS rxStatus to our standard status
 */
function mapViosStatus(rxStatus: string): string {
  const normalized = (rxStatus || '').toLowerCase().trim();
  
  switch (normalized) {
    // Shipping/shipped states
    case 'shipping':
    case 'shipped':
    case 'in transit':
    case 'in_transit':
      return 'shipped';
    
    // Delivered states
    case 'delivered':
    case 'complete':
    case 'completed':
      return 'delivered';
    
    // Processing states
    case 'processing':
    case 'compounding':
    case 'pending':
    case 'received':
    case 'queued':
    case 'verified':
      return 'processing';
    
    // Cancelled states
    case 'cancelled':
    case 'canceled':
    case 'voided':
    case 'rejected':
      return 'cancelled';
    
    // Out for delivery
    case 'out for delivery':
    case 'out_for_delivery':
      return 'shipped';
    
    default:
      // Return as-is if we don't have a mapping
      edgeLogger.warn('Unknown VIOS status, using as-is', { rxStatus: normalized });
      return normalized || 'unknown';
  }
}

/**
 * Normalizes carrier name from VIOS format
 */
function normalizeCarrier(carrier: string | undefined): string | undefined {
  if (!carrier) return undefined;
  
  const normalized = carrier.toLowerCase();
  if (normalized.includes('fedex')) return 'FedEx';
  if (normalized.includes('ups')) return 'UPS';
  if (normalized.includes('usps')) return 'USPS';
  if (normalized.includes('dhl')) return 'DHL';
  
  return carrier;
}

/**
 * Transforms a single VIOS prescription webhook item to our standard format
 * 
 * VIOS payload fields (per Integration Portal docs):
 * - pharmacyLocation: "vioscompounding"
 * - fillId: "100482"
 * - rxNumber: "66692847"
 * - foreignRxNumber: "rx_m8XvL9NdWpR2eTfk" (our reference when submitting)
 * - orderId: "7771349652" (VIOS internal order ID)
 * - referenceId: "rx_n5QwP7BkJmX4rYuL" (our order_line.id)
 * - practiceId, providerId, patientId, lfdrugId
 * - rxStatus: "Shipping"
 * - rxStatusDateTime: "2025-12-12T15:42:33"
 * - deliveryService: "UPS Ground"
 * - service: "Ground"
 * - trackingNumber: "1Z999AA1234567890"
 * - shipCarrier: "UPS"
 * - drugName: "Semaglutide/Methylcobalamin/Glycine (1ml)"
 * - shipAddressLine1, shipAddressLine2, shipAddressLine3
 * - shipCity, shipState, shipZip, shipCountry
 */
export function transformViosPayload(item: any): StandardWebhookPayload {
  // IMPORTANT: referenceId is what we send as ReferenceId to VIOS (our order_line.id)
  // This should be mapped to order_line_id for direct lookup
  // foreignRxNumber is also our reference, but less commonly used
  // VIOS's orderId is their internal ID (stored in our pharmacy_order_id column)
  const ourOrderLineId = item.referenceId || item.foreignRxNumber;
  const viosOrderId = item.orderId;
  
  const transformed: StandardWebhookPayload = {
    // Our order_line.id (from referenceId we sent to VIOS)
    order_line_id: ourOrderLineId,
    // VIOS's internal order ID (what we store in pharmacy_order_id column)
    pharmacy_order_id: viosOrderId,
    status: mapViosStatus(item.rxStatus),
    status_details: item.rxStatus, // Keep original status as details
    tracking_number: item.trackingNumber || undefined,
    carrier: normalizeCarrier(item.shipCarrier),
    delivery_service: item.deliveryService || undefined,  // "UPS Ground"
    service: item.service || undefined,                   // "Ground"
    status_datetime: item.rxStatusDateTime || new Date().toISOString(),
    vios_rx_number: item.rxNumber,
    vios_order_id: viosOrderId,
    vios_fill_id: item.fillId,
    raw_vios_data: item,
  };
  
  // Build location string if shipping info available
  if (item.shipCity && item.shipState) {
    transformed.location = `${item.shipCity}, ${item.shipState}`;
  }
  
  // If delivered, set actual delivery date
  if (transformed.status === 'delivered' && item.rxStatusDateTime) {
    transformed.actual_delivery = item.rxStatusDateTime;
  }
  
  edgeLogger.info('Transformed VIOS payload', {
    orderLineId: transformed.order_line_id,
    pharmacyOrderId: transformed.pharmacy_order_id,
    status: transformed.status,
    originalStatus: item.rxStatus,
    trackingNumber: transformed.tracking_number,
    carrier: transformed.carrier,
    deliveryService: transformed.delivery_service,
    viosRxNumber: transformed.vios_rx_number,
    viosOrderId: transformed.vios_order_id,
  });
  
  return transformed;
}

/**
 * Extracts the first item from a VIOS webhook array
 * VIOS sends one Rx per webhook, but as an array
 */
export function extractViosPayloadItem(payload: any): any {
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      throw new Error('Empty VIOS payload array');
    }
    if (payload.length > 1) {
      edgeLogger.warn('VIOS payload has multiple items, processing first only', {
        itemCount: payload.length
      });
    }
    return payload[0];
  }
  return payload;
}
