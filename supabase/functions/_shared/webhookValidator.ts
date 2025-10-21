/**
 * Webhook Signature Validator for Authorize.Net
 * Implements HMAC-SHA512 verification to prevent unauthorized webhook calls
 */

/**
 * Validate Authorize.Net webhook signature
 * @param signature - The x-anet-signature header value (format: "sha512=hash")
 * @param payload - The raw webhook payload string
 * @param signingKey - The webhook signing key from Authorize.Net
 * @returns true if signature is valid, false otherwise
 */
export async function validateAuthorizenetWebhookSignature(
  signature: string | null,
  payload: string,
  signingKey: string | undefined
): Promise<{ valid: boolean; reason?: string }> {
  // In development mode without signing key, allow webhooks through with warning
  if (!signingKey) {
    console.warn('⚠️ Webhook signature validation skipped - AUTHORIZENET_WEBHOOK_SIGNING_KEY not configured');
    console.warn('⚠️ This is acceptable for development but MUST be configured for production');
    return { valid: true, reason: 'dev_mode_no_key' };
  }

  // Signature must be present if key is configured
  if (!signature) {
    return { valid: false, reason: 'missing_signature' };
  }

  // Signature format should be "sha512=<hash>"
  if (!signature.startsWith('sha512=')) {
    return { valid: false, reason: 'invalid_signature_format' };
  }

  try {
    // Extract the hash from the signature
    const providedHash = signature.substring(7).toUpperCase();

    // Calculate expected HMAC-SHA512
    const encoder = new TextEncoder();
    const keyData = encoder.encode(signingKey);
    const payloadData = encoder.encode(payload);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', key, payloadData);
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const expectedHash = signatureArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();

    // Constant-time comparison to prevent timing attacks
    if (providedHash.length !== expectedHash.length) {
      return { valid: false, reason: 'hash_length_mismatch' };
    }

    let mismatch = 0;
    for (let i = 0; i < providedHash.length; i++) {
      mismatch |= providedHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
    }

    if (mismatch !== 0) {
      return { valid: false, reason: 'hash_mismatch' };
    }

    return { valid: true };
  } catch (error) {
    console.error('Webhook signature validation error:', error);
    return { valid: false, reason: 'validation_error' };
  }
}

/**
 * Validate webhook payload structure
 */
export function validateWebhookPayload(payload: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!payload) {
    errors.push('Webhook payload is empty');
    return { valid: false, errors };
  }

  if (typeof payload !== 'object') {
    errors.push('Webhook payload must be a JSON object');
    return { valid: false, errors };
  }

  // Validate required fields
  if (!payload.eventType) {
    errors.push('Missing required field: eventType');
  }

  if (!payload.payload) {
    errors.push('Missing required field: payload');
  }

  return { valid: errors.length === 0, errors };
}
