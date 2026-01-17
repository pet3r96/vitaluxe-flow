/**
 * VIOS/ShipStation Payload Transformer
 * Converts ShipStation webhook payloads to our standard format
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
  estimated_delivery?: string;
  actual_delivery?: string;
  location?: string;
  status_datetime?: string;
  raw_shipstation_data?: any;
}

/**
 * Detects if payload is in ShipStation format
 */
export function isShipStationPayload(payload: any): boolean {
  if (!payload || typeof payload !== 'object') return false;
  
  // ShipStation webhooks typically have these fields
  return !!(
    payload.resource_type ||
    payload.resourceType ||
    payload.order_key ||
    payload.orderKey ||
    (payload.resource_url && payload.resource_url.includes('shipstation'))
  );
}

/**
 * Maps ShipStation resource_type to our standard status
 */
function mapShipStationStatus(resourceType: string, payload: any): string {
  const normalizedType = (resourceType || '').toUpperCase().replace(/-/g, '_');
  
  switch (normalizedType) {
    // Shipping events
    case 'SHIP_NOTIFY':
    case 'FULFILLMENT_SHIPPED':
    case 'ITEM_SHIP_NOTIFY':
    case 'SHIPPED':
      return 'shipped';
    
    // Delivery events
    case 'DELIVERED':
    case 'FULFILLMENT_DELIVERED':
      return 'delivered';
    
    // Order events
    case 'ORDER_NOTIFY':
    case 'ORDER_CREATED':
    case 'ORDER_RECEIVED':
      return payload.order_status?.toLowerCase() || 'processing';
    
    // In transit events
    case 'IN_TRANSIT':
    case 'OUT_FOR_DELIVERY':
      return 'shipped';
    
    // Cancellation events
    case 'CANCELLED':
    case 'CANCELED':
    case 'ORDER_CANCELLED':
      return 'cancelled';
    
    default:
      // Try to use the type as-is if it's a valid status
      if (resourceType) {
        return resourceType.toLowerCase().replace(/-/g, '_');
      }
      return 'unknown';
  }
}

/**
 * Extracts carrier name from ShipStation payload
 */
function extractCarrier(payload: any): string | undefined {
  const carrier = payload.carrier_code || 
                  payload.carrierCode || 
                  payload.carrier ||
                  payload.shipment?.carrier_code ||
                  payload.shipment?.carrierCode;
  
  if (!carrier) return undefined;
  
  // Normalize carrier names
  const normalizedCarrier = carrier.toLowerCase();
  if (normalizedCarrier.includes('fedex')) return 'FedEx';
  if (normalizedCarrier.includes('ups')) return 'UPS';
  if (normalizedCarrier.includes('usps')) return 'USPS';
  if (normalizedCarrier.includes('dhl')) return 'DHL';
  
  return carrier;
}

/**
 * Transforms VIOS/ShipStation webhook payload to our standard format
 */
export function transformViosPayload(payload: any): StandardWebhookPayload {
  // If already in our standard format, return as-is
  if (payload.pharmacy_order_id || payload.order_line_id || payload.vitaluxe_order_number) {
    // Check if it also has status
    if (payload.status) {
      edgeLogger.info('Payload already in standard format');
      return payload;
    }
  }
  
  // Extract order identifier (order_key is our ReferenceId in ShipStation)
  const pharmacyOrderId = payload.order_key || 
                          payload.orderKey ||
                          payload.order_number ||
                          payload.orderNumber ||
                          payload.reference_id ||
                          payload.referenceId;
  
  // Extract tracking number
  const trackingNumber = payload.tracking_number || 
                         payload.trackingNumber ||
                         payload.shipment?.tracking_number ||
                         payload.shipment?.trackingNumber;
  
  // Determine status
  const resourceType = payload.resource_type || payload.resourceType;
  const status = mapShipStationStatus(resourceType, payload);
  
  // Extract dates
  const shipDate = payload.ship_date || payload.shipDate || payload.shipment?.ship_date;
  const deliveryDate = payload.delivery_date || payload.deliveryDate;
  
  const transformed: StandardWebhookPayload = {
    pharmacy_order_id: pharmacyOrderId,
    status: status,
    status_details: resourceType || payload.status_description || payload.statusDescription,
    tracking_number: trackingNumber,
    carrier: extractCarrier(payload),
    status_datetime: payload.create_date || payload.createDate || new Date().toISOString(),
    raw_shipstation_data: payload,
  };
  
  // Add delivery dates if available
  if (status === 'shipped' && shipDate) {
    transformed.status_datetime = shipDate;
  }
  if (status === 'delivered' && deliveryDate) {
    transformed.actual_delivery = deliveryDate;
  }
  
  edgeLogger.info('Transformed ShipStation payload', {
    originalKeys: Object.keys(payload),
    pharmacyOrderId: transformed.pharmacy_order_id,
    status: transformed.status,
    trackingNumber: transformed.tracking_number,
    carrier: transformed.carrier,
  });
  
  return transformed;
}
