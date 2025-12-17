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
  payload: string,
  signingKey: string | undefined
): Promise<{ valid: boolean; reason?: string }> {
  if (!signature) {
    return { valid: false, reason: 'Missing signature header' };
  }

  if (!signingKey) {
    edgeLogger.warn('No signing key configured - webhook validation disabled');
    return { valid: false, reason: 'No signing key configured' };
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
 * Supports both standard format and VIOS array format
 */
export function validateWebhookPayload(payload: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for VIOS array format first
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      errors.push('Empty payload array');
      return { valid: false, errors };
    }
    
    // Validate VIOS format - check first item has required fields
    const firstItem = payload[0];
    if (!firstItem || typeof firstItem !== 'object') {
      errors.push('Invalid VIOS payload structure');
      return { valid: false, errors };
    }
    
    // VIOS payloads should have orderId and rxStatus
    if (!firstItem.orderId && !firstItem.rxNumber) {
      errors.push('Missing orderId or rxNumber in VIOS payload');
    }
    if (!firstItem.rxStatus) {
      errors.push('Missing rxStatus in VIOS payload');
    }
    
    return { valid: errors.length === 0, errors };
  }

  // Standard payload validation
  if (!payload || typeof payload !== 'object') {
    errors.push('Payload must be a JSON object');
    return { valid: false, errors };
  }

  if (!payload.order_line_id && !payload.vitaluxe_order_number && !payload.pharmacy_order_id) {
    errors.push('Missing order_line_id, vitaluxe_order_number, or pharmacy_order_id');
  }

  if (!payload.status) {
    errors.push('Missing status field');
  }

  return { valid: errors.length === 0, errors };
}
