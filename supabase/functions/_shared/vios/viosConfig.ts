/**
 * VIOS Configuration
 * 
 * Centralized configuration and feature flags for VIOS integration.
 * All VIOS-related constants and settings live here.
 */

// Feature flag - can be controlled via environment variable
export const VIOS_ENABLED = Deno.env.get("VIOS_ENABLED") !== "false";

// API Configuration
export const VIOS_API_URL = "https://integrations.vioscompounding.com";
export const TOKEN_TTL_MS = 14 * 60 * 1000; // 14 minutes (1-minute buffer before 15-min expiry)
export const MIN_REQUEST_INTERVAL_MS = 1000; // 1 second between requests per VIOS guidelines
export const MAX_REQUESTS_PER_MINUTE = 100;
export const MAX_ORDERS_PER_MINUTE = 50;

// Retry configuration
export const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
} as const;

// Known VIOS pharmacy identifiers
export const VIOS_PHARMACY_IDENTIFIERS = [
  'd5e75179-e66c-450f-8cae-1f4df93b097c', // Primary VIOS Compounding ID
  'vios',
  'vios compounding',
];

// Shipping service codes per VIOS documentation
export const VIOS_SHIPPING_CODES = {
  FEDEX_2_DAY: 7608,
  USPS_PRIORITY: 7615,
  FEDEX_PRIORITY_OVERNIGHT: 7617,
  FEDEX_STANDARD_OVERNIGHT: 7618,
  FEDEX_OVERNIGHT_CALIFORNIA: 7620,
  FEDEX_GROUND: 7623,
} as const;

export type ViosShippingCode = typeof VIOS_SHIPPING_CODES[keyof typeof VIOS_SHIPPING_CODES];

// Map internal shipping speeds to VIOS codes
export const SHIPPING_SPEED_TO_VIOS: Record<string, ViosShippingCode> = {
  'priority_overnight': VIOS_SHIPPING_CODES.FEDEX_PRIORITY_OVERNIGHT,
  'standard_overnight': VIOS_SHIPPING_CODES.FEDEX_STANDARD_OVERNIGHT,
  'overnight_california': VIOS_SHIPPING_CODES.FEDEX_OVERNIGHT_CALIFORNIA,
  '2_day': VIOS_SHIPPING_CODES.FEDEX_2_DAY,
  'usps_priority': VIOS_SHIPPING_CODES.USPS_PRIORITY,
  'overnight': VIOS_SHIPPING_CODES.FEDEX_STANDARD_OVERNIGHT,
  'express': VIOS_SHIPPING_CODES.FEDEX_PRIORITY_OVERNIGHT,
  '2day': VIOS_SHIPPING_CODES.FEDEX_2_DAY,
  'priority': VIOS_SHIPPING_CODES.USPS_PRIORITY,
  'first_class': VIOS_SHIPPING_CODES.USPS_PRIORITY,
  'ground': VIOS_SHIPPING_CODES.FEDEX_GROUND, // historical
  'standard': VIOS_SHIPPING_CODES.FEDEX_GROUND, // historical
};

// GLP-1 medication keywords that require clinical difference statement
export const GLP1_KEYWORDS = [
  'semaglutide', 'tirzepatide', 'liraglutide', 'dulaglutide',
  'exenatide', 'glp-1', 'glp1', 'ozempic', 'wegovy', 'mounjaro',
  'saxenda', 'victoza', 'trulicity', 'byetta', 'bydureon'
];

/**
 * Check if a pharmacy is VIOS
 */
export function isViosPharmacy(pharmacyId: string, pharmacyName?: string, apiEndpoint?: string): boolean {
  if (VIOS_PHARMACY_IDENTIFIERS.includes(pharmacyId.toLowerCase())) {
    return true;
  }
  if (pharmacyName?.toLowerCase().includes('vios')) {
    return true;
  }
  if (apiEndpoint?.includes('vioscompounding.com')) {
    return true;
  }
  return false;
}

/**
 * Get VIOS shipping code from internal shipping speed
 */
export function getViosShippingCode(shippingSpeed: string | null | undefined): ViosShippingCode {
  if (!shippingSpeed) return VIOS_SHIPPING_CODES.USPS_PRIORITY;
  const normalized = shippingSpeed.toLowerCase().replace(/[-\s]/g, '_');
  return SHIPPING_SPEED_TO_VIOS[normalized] || VIOS_SHIPPING_CODES.USPS_PRIORITY;
}

/**
 * Check if product requires GLP-1 clinical difference statement
 */
export function requiresGlp1Statement(productName: string): boolean {
  const lowerName = productName?.toLowerCase() || '';
  return GLP1_KEYWORDS.some(keyword => lowerName.includes(keyword));
}
