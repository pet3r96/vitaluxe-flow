import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from "../_shared/supabaseAdmin.ts";
import { edgeLogger } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AlertPayload {
  alert_id: string;
  alert_name: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "WARNING";
  message: string;
  details?: Record<string, any>;
  triggered_at: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createAdminClient();

    const payload: AlertPayload = await req.json();
    
    edgeLogger.info("Alert received", {
      alert_id: payload.alert_id,
      severity: payload.severity,
      alert_name: payload.alert_name
    });

    // Insert into admin_alerts table
    const { error: insertError } = await supabaseAdmin
      .from("admin_alerts")
      .insert({
        title: payload.alert_name,
        message: payload.message,
        severity: payload.severity.toLowerCase(),
        entity_type: "system_alert",
        details: payload.details || {}
      });

    if (insertError) {
      edgeLogger.error("Failed to insert alert", insertError);
      throw insertError;
    }

    // Send Slack notification for CRITICAL and HIGH severity
    if (["CRITICAL", "HIGH"].includes(payload.severity)) {
      const slackWebhook = Deno.env.get("SLACK_WEBHOOK_URL");
      
      if (slackWebhook) {
        const slackPayload = buildSlackPayload(payload);
        
        const slackResponse = await fetch(slackWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(slackPayload)
        });

        if (!slackResponse.ok) {
          edgeLogger.warn("Slack notification failed", {
            status: slackResponse.status,
            alert_id: payload.alert_id
          });
        } else {
          edgeLogger.info("Slack notification sent", {
            alert_id: payload.alert_id
          });
        }
      }
    }

    // Send email notification for CRITICAL severity
    if (payload.severity === "CRITICAL") {
      const emailPayload = buildEmailPayload(payload);
      
      const { error: emailError } = await supabaseAdmin.functions.invoke(
        "unified-email-sender",
        {
          body: emailPayload
        }
      );

      if (emailError) {
        edgeLogger.warn("Email notification failed", emailError);
      } else {
        edgeLogger.info("Email notification sent", {
          alert_id: payload.alert_id
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, alert_id: payload.alert_id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    edgeLogger.error("Alert webhook error", error);
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Build Slack notification payload with rich formatting
 */
function buildSlackPayload(alert: AlertPayload) {
  const severityColors = {
    CRITICAL: "#FF0000",
    HIGH: "#FF6B00",
    MEDIUM: "#FFA500",
    WARNING: "#FFD700"
  };

  const severityEmojis = {
    CRITICAL: "🔴",
    HIGH: "🟠",
    MEDIUM: "🟡",
    WARNING: "⚠️"
  };

  return {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${severityEmojis[alert.severity]} ${alert.alert_name}`,
          emoji: true
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Severity:*\n${alert.severity}`
          },
          {
            type: "mrkdwn",
            text: `*Alert ID:*\n\`${alert.alert_id}\``
          },
          {
            type: "mrkdwn",
            text: `*Triggered:*\n${new Date(alert.triggered_at).toLocaleString()}`
          }
        ]
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Message:*\n${alert.message}`
        }
      }
    ],
    attachments: [
      {
        color: severityColors[alert.severity],
        blocks: alert.details ? [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Details:*\n\`\`\`${JSON.stringify(alert.details, null, 2)}\`\`\``
            }
          }
        ] : []
      }
    ]
  };
}

/**
 * Build email notification payload
 */
function buildEmailPayload(alert: AlertPayload) {
  const recipients = Deno.env.get("ALERT_EMAIL_RECIPIENTS")?.split(",") || [
    "security@vitaluxepro.com",
    "devops@vitaluxepro.com"
  ];

  return {
    to: recipients,
    subject: `[${alert.severity}] ${alert.alert_name}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .header { background: #f4f4f4; padding: 20px; border-left: 5px solid ${
              alert.severity === "CRITICAL" ? "#FF0000" : "#FF6B00"
            }; }
            .content { padding: 20px; }
            .details { background: #f9f9f9; padding: 15px; border-radius: 5px; margin-top: 15px; }
            .footer { padding: 20px; font-size: 12px; color: #666; border-top: 1px solid #eee; }
            pre { background: #f4f4f4; padding: 10px; border-radius: 3px; overflow-x: auto; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>${alert.alert_name}</h2>
            <p><strong>Severity:</strong> ${alert.severity}</p>
            <p><strong>Triggered:</strong> ${new Date(alert.triggered_at).toLocaleString()}</p>
          </div>
          <div class="content">
            <h3>Message</h3>
            <p>${alert.message}</p>
            ${alert.details ? `
              <div class="details">
                <h4>Details</h4>
                <pre>${JSON.stringify(alert.details, null, 2)}</pre>
              </div>
            ` : ''}
          </div>
          <div class="footer">
            <p>This is an automated alert from VitaLuxePro production monitoring system.</p>
            <p>Alert ID: ${alert.alert_id}</p>
          </div>
        </body>
      </html>
    `,
    text: `
[${alert.severity}] ${alert.alert_name}

Message: ${alert.message}

Triggered: ${new Date(alert.triggered_at).toLocaleString()}
Alert ID: ${alert.alert_id}

${alert.details ? `Details:\n${JSON.stringify(alert.details, null, 2)}` : ''}

---
This is an automated alert from VitaLuxePro production monitoring system.
    `.trim()
  };
}
