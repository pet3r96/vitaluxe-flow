/**
 * Pharmacy Webhook Validator
 * Validates incoming webhooks from pharmacy APIs
 */

import { edgeLogger } from './logger.ts';

/**
 * Validates pharmacy webhook signature using HMAC-SHA512
 * @param signature The signature from the webhook header
 * @param payload The raw request body as string
 * @param signingKey The pharmacy's webhook_secret
 */
export async function validatePharmacyWebhookSignature(
  signature: string | null,
  apiKey: string | null,
  payload: string,
  signingKey: string | undefined
): Promise<{ valid: boolean; reason?: string }> {
  // If no signing key configured, skip validation with warning
  if (!signingKey) {
    edgeLogger.warn('No signing key configured - webhook validation disabled');
    return { valid: false, reason: 'No signing key configured' };
  }

  // OPTION 1: Simple API Key validation
  if (apiKey) {
    if (apiKey === signingKey) {
      edgeLogger.info('Webhook authenticated via API key');
      return { valid: true, reason: 'api_key_match' };
    }
    return { valid: false, reason: 'API key mismatch' };
  }

  // OPTION 2: HMAC-SHA512 signature validation
  if (!signature) {
    return { valid: false, reason: 'Missing signature or API key header' };
  }

  // Parse signature (format: "sha512=<hash>")
  const parts = signature.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha512') {
    return { valid: false, reason: 'Invalid signature format' };
  }

  const providedHash = parts[1].toUpperCase();

  // Compute expected hash
  const encoder = new TextEncoder();
  const keyData = encoder.encode(signingKey);
  const payloadData = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );

  const signature_bytes = await crypto.subtle.sign('HMAC', cryptoKey, payloadData);
  const expectedHash = Array.from(new Uint8Array(signature_bytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

  // Constant-time comparison to prevent timing attacks
  if (providedHash.length !== expectedHash.length) {
    return { valid: false, reason: 'Hash length mismatch' };
  }

  let match = true;
  for (let i = 0; i < providedHash.length; i++) {
    if (providedHash[i] !== expectedHash[i]) {
      match = false;
    }
  }

  if (!match) {
    return { valid: false, reason: 'Signature verification failed' };
  }

  return { valid: true };
}

/**
 * Validates webhook payload structure
 * Supports both standard format and ShipStation format
 */
export function validateWebhookPayload(payload: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Standard payload validation
  if (!payload || typeof payload !== 'object') {
    errors.push('Payload must be a JSON object');
    return { valid: false, errors };
  }

  // Accept multiple order identifier formats (including ShipStation)
  const hasOrderId = payload.order_line_id || 
                     payload.vitaluxe_order_number || 
                     payload.pharmacy_order_id ||
                     payload.order_key ||        // ShipStation snake_case
                     payload.orderKey ||         // ShipStation camelCase
                     payload.order_number ||
                     payload.orderNumber ||
                     payload.reference_id ||
                     payload.referenceId;

  if (!hasOrderId) {
    errors.push('Missing order identifier (order_line_id, vitaluxe_order_number, pharmacy_order_id, or order_key)');
  }

  // Accept multiple status formats (including ShipStation event types)
  const hasStatus = payload.status || 
                    payload.resource_type ||     // ShipStation event type
                    payload.resourceType ||      // ShipStation camelCase
                    payload.order_status ||
                    payload.orderStatus;

  if (!hasStatus) {
    errors.push('Missing status field (status, resource_type, or order_status)');
  }

  return { valid: errors.length === 0, errors };
}
