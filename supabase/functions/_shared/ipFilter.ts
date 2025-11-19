/**
 * PHASE 3 - PART 2: IP FILTERING FOR ADMIN FUNCTIONS
 * 
 * Restricts admin operations to allowlisted IP addresses
 */

import { edgeLogger } from './logger.ts';

// IP allowlist for admin operations
export const ADMIN_ALLOWED_IPS = [
  '127.0.0.1',          // Localhost
  '::1',                 // IPv6 localhost
  Deno.env.get('ADMIN_IP_1'),
  Deno.env.get('ADMIN_IP_2'),
  Deno.env.get('ADMIN_IP_3'),
  Deno.env.get('ADMIN_IP_4'),
  Deno.env.get('ADMIN_IP_5'),
].filter(Boolean); // Remove undefined values

/**
 * Extract client IP from request headers
 */
export function getClientIP(req: Request): string {
  // Try various headers that proxies might set
  const headers = [
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip', // Cloudflare
    'x-client-ip',
    'x-cluster-client-ip'
  ];

  for (const header of headers) {
    const value = req.headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs, take the first one
      return value.split(',')[0].trim();
    }
  }

  // Fallback to connection remote address if available
  return 'unknown';
}

/**
 * Check if request IP is in admin allowlist
 */
export function checkAdminIP(req: Request): { allowed: boolean; ip: string } {
  const ip = getClientIP(req);
  
  // If no IPs configured, allow all (development mode)
  if (ADMIN_ALLOWED_IPS.length === 0) {
    edgeLogger.warn('No admin IPs configured - allowing all requests (DEV MODE)');
    return { allowed: true, ip };
  }
  
  const allowed = ADMIN_ALLOWED_IPS.includes(ip);
  
  if (!allowed) {
    edgeLogger.warn('Unauthorized IP attempting admin access', { ip, allowedIPs: ADMIN_ALLOWED_IPS.length });
  }
  
  return { allowed, ip };
}

/**
 * Middleware to enforce IP filtering on admin functions
 * Returns 403 response if IP not allowed
 */
export async function enforceAdminIP(req: Request, supabase: any, functionName: string): Promise<Response | null> {
  const { allowed, ip } = checkAdminIP(req);
  
  if (!allowed) {
    // Log security event
    await supabase.from('security_events').insert({
      event_type: 'unauthorized_admin_access_attempt',
      ip_address: ip,
      details: { 
        function: functionName, 
        timestamp: new Date().toISOString(),
        user_agent: req.headers.get('user-agent')
      }
    });
    
    edgeLogger.error('Admin function access denied - IP not in allowlist', {
      function: functionName,
      ip,
      userAgent: req.headers.get('user-agent')
    });
    
    return new Response(
      JSON.stringify({ 
        error: 'Forbidden - IP address not authorized for admin operations',
        ip: ip
      }),
      { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  // IP allowed, no response needed (continue processing)
  edgeLogger.info('Admin IP verified', { function: functionName, ip });
  return null;
}
