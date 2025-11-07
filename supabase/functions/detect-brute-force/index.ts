import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateDetectBruteForceRequest } from "../_shared/requestValidators.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse JSON with error handling
    let requestData;
    try {
      requestData = await req.json();
    } catch (error) {
      console.error('Invalid JSON in request body:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input
    const validation = validateDetectBruteForceRequest(requestData);
    if (!validation.valid) {
      console.warn('Validation failed:', validation.errors);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request data', 
          details: validation.errors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { email, ip_address, attempt_count } = requestData;

    console.log(`Detecting brute force: ${attempt_count} attempts for ${email} from ${ip_address}`);

    // Log critical security event
    await supabaseClient.from("security_events").insert({
      event_type: "brute_force",
      severity: "critical",
      user_email: email,
      ip_address,
      details: {
        email,
        ip_address,
        attempt_count,
        timestamp: new Date().toISOString(),
      },
    });

    // Trigger alert
    await supabaseClient.functions.invoke("trigger-alert", {
      body: {
        event_type: "brute_force",
        severity: "critical",
        message: `Brute force attack detected: ${attempt_count} failed login attempts for ${email} from ${ip_address}`,
        details: { email, ip_address, attempt_count },
      },
    });

    // Lock account if user exists
    const { data: userData } = await supabaseClient.auth.admin.listUsers();
    const user = userData.users.find(u => u.email === email);
    
    if (user) {
      await supabaseClient.from("account_lockouts").insert({
        user_id: user.id,
        user_email: email,
        ip_address,
        lockout_reason: "brute_force_detected",
        locked_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
      });
    console.log(`Account locked for ${email} until ${new Date(Date.now() + 30 * 60 * 1000).toISOString()}`);
      
      // Notify all admins of security alert
      try {
        const { data: adminRoles } = await supabaseClient
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin');
        
        if (adminRoles && adminRoles.length > 0) {
          const adminNotifications = adminRoles.map(role => ({
            user_id: role.user_id,
            title: 'Security Alert: Brute Force Detected',
            message: `${attempt_count} failed login attempts for ${email} from IP ${ip_address}. Account locked for 30 minutes.`,
            notification_type: 'security_alert',
            severity: 'error',
            entity_type: 'security_events',
            entity_id: user.id,
            action_url: '/admin/security',
            metadata: {
              email,
              ip_address,
              attempt_count,
              locked_until: new Date(Date.now() + 30 * 60 * 1000).toISOString()
            },
            read: false,
          }));
          
          await supabaseClient.from('notifications').insert(adminNotifications);
          console.log(`[detect-brute-force] Sent security alert to ${adminRoles.length} admins`);
        }
      } catch (notifError) {
        console.error('[detect-brute-force] Failed to send admin notifications:', notifError);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error detecting brute force:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
