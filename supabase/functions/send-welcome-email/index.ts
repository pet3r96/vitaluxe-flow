import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  userId: string;
  email: string;
  name: string;
  role: string;
  practiceId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  edgeLogger.info('[send-welcome-email] Function START');
  
  if (req.method === "OPTIONS") {
    edgeLogger.info('[send-welcome-email] CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    edgeLogger.info('[send-welcome-email] Creating admin client');
    const supabaseAdmin = createAdminClient();

    edgeLogger.info('[send-welcome-email] Parsing request body');
    const { userId, email, name, role, practiceId }: WelcomeEmailRequest = await req.json();

    edgeLogger.info('[send-welcome-email] Request params', { 
      hasUserId: !!userId, 
      emailDomain: email?.split('@')[1], 
      hasName: !!name,
      role, 
      hasPracticeId: !!practiceId 
    });

    if (!userId || !email || !name || !role) {
      edgeLogger.error('[send-welcome-email] Missing required fields', { 
        hasUserId: !!userId, 
        hasEmail: !!email, 
        hasName: !!name, 
        hasRole: !!role 
      });
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, email, name, role" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate secure token (7 day expiry for welcome emails)
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    edgeLogger.info('[send-welcome-email] Generated token', { expiresAt });

    // Store token in temp_password_tokens
    edgeLogger.info('[send-welcome-email] Storing token in database');
    const { error: tokenError } = await supabaseAdmin
      .from('temp_password_tokens')
      .insert({
        user_id: userId,
        token: token,
        expires_at: expiresAt
      });

    if (tokenError) {
      edgeLogger.error('[send-welcome-email] Error creating token', tokenError);
      throw tokenError;
    }
    edgeLogger.info('[send-welcome-email] Token stored successfully');

    // Get practice information if practiceId provided
    let practiceInfo = null;
    if (practiceId) {
      edgeLogger.info('[send-welcome-email] Fetching practice info', { practiceId });
      const { data: practice } = await supabaseAdmin
        .from('profiles')
        .select('name, company, phone')
        .eq('id', practiceId)
        .single();
      practiceInfo = practice;
      edgeLogger.info('[send-welcome-email] Practice info retrieved', { 
        hasPractice: !!practice,
        practiceId 
      });
    }

    // Check if 2FA is enabled for the system
    edgeLogger.info('[send-welcome-email] Checking 2FA settings');
    const { data: systemSettings } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('setting_key', 'two_fa_enforcement_enabled')
      .maybeSingle();

    const twoFactorEnabled = systemSettings?.value === true;
    edgeLogger.info('[send-welcome-email] 2FA enabled', { twoFactorEnabled });

    const resetLink = `https://app.vitaluxeservices.com/change-password?token=${token}`;
    edgeLogger.info('[send-welcome-email] Password setup link generated');
    
    // Determine if this is a patient or staff/doctor
    const isPatient = role === 'patient';
    
    // Generate email template
    const practiceDisplayName = practiceInfo?.name || practiceInfo?.company || undefined;

    // Call unified email sender
    edgeLogger.info('[send-welcome-email] Calling unified-email-sender', { 
      emailDomain: email.split('@')[1], 
      userType: isPatient ? 'patient' : 'staff' 
    });
    
    const emailPayload = {
      type: 'transactional',
      to: email,
      subject: `Welcome to Vitaluxe${practiceDisplayName ? ` - ${practiceDisplayName}` : ''}`,
      htmlBody: generateWelcomeEmailHTML({
        recipientName: name,
        resetLink,
        isPatient,
        practiceName: practiceDisplayName,
        twoFactorEnabled,
      }),
      textBody: generateWelcomeEmailText({
        recipientName: name,
        resetLink,
        isPatient,
        practiceName: practiceDisplayName,
        twoFactorEnabled,
      }),
    };
    
    const emailResult = await supabaseAdmin.functions.invoke('unified-email-sender', {
      body: emailPayload,
    });

    if (emailResult.error) {
      edgeLogger.error('[send-welcome-email] Unified email sender error', emailResult.error);
      throw new Error(`Email sending failed: ${emailResult.error.message}`);
    }

    const result = emailResult.data;
    edgeLogger.info('[send-welcome-email] Email sent successfully', { 
      messageId: result.messageId, 
      emailDomain: email.split('@')[1] 
    });

    // Log to audit_logs
    await supabaseAdmin.from('audit_logs').insert({
      action_type: 'email_welcome',
      user_id: userId,
      user_email: email,
      entity_type: 'email',
      entity_id: result.messageId,
      details: {
        role,
        practiceId,
        success: true,
      }
    });

    return new Response(
      JSON.stringify({ success: true, messageId: result.messageId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    edgeLogger.error('[send-welcome-email] Fatal error', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);

// Email template generators
function generateWelcomeEmailHTML(params: {
  recipientName: string;
  resetLink: string;
  isPatient?: boolean;
  practiceName?: string;
  twoFactorEnabled?: boolean;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #E2C977; background-color: #0B0B0B; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #8E6E1E 0%, #C8A64B 50%, #E2C977 100%); padding: 30px 20px; text-align: center; }
        .header h1 { margin: 0; color: #0B0B0B; font-size: 28px; font-weight: bold; letter-spacing: 2px; }
        .content { background-color: #1A1A1A; padding: 40px 30px; border: 1px solid #292929; }
        .content h2 { color: #E2C977; margin-top: 0; }
        .content p { color: #E2C977; }
        .greeting { color: #E2C977; font-size: 16px; margin-bottom: 20px; }
        .button { display: inline-block; background-color: #C8A64B; color: #0B0B0B; padding: 14px 35px; text-decoration: none; border-radius: 6px; margin: 25px 0; font-weight: bold; }
        .button:hover { background-color: #E2C977; }
        .footer { text-align: center; padding: 25px 20px; color: #8E6E1E; font-size: 12px; background-color: #0B0B0B; }
        .footer a { color: #C8A64B; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>VITALUXE</h1>
        </div>
        <div class="content">
          <p class="greeting">Dear ${params.recipientName},</p>
          <h2>Welcome to Vitaluxe${params.practiceName ? ` - ${params.practiceName}` : ''}!</h2>
          ${params.isPatient 
            ? '<p>Your healthcare provider has created a secure patient portal account for you.</p>'
            : '<p>Your account has been created and you now have access to the Vitaluxe platform.</p>'
          }
          <p><strong>Important:</strong> You need to set your password before you can access your account.</p>
          ${params.twoFactorEnabled 
            ? '<p><em>Note: Two-factor authentication is enabled. After setting your password, you\'ll need to set up 2FA on your next login.</em></p>'
            : ''
          }
          <div style="text-align: center;">
            <a href="${params.resetLink}" class="button">Set Your Password</a>
          </div>
          <p style="margin-top: 30px; color: #C8A64B; font-size: 14px;">
            This link will expire in 7 days. If you did not request this account, please disregard this email.
          </p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Vitaluxe Services. All rights reserved.</p>
          <p><a href="https://app.vitaluxeservices.com">Visit Portal</a> | <a href="https://app.vitaluxeservices.com/support">Support</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateWelcomeEmailText(params: {
  recipientName: string;
  resetLink: string;
  isPatient?: boolean;
  practiceName?: string;
  twoFactorEnabled?: boolean;
}): string {
  return `
Welcome to Vitaluxe${params.practiceName ? ` - ${params.practiceName}` : ''}!

Dear ${params.recipientName},

${params.isPatient 
  ? 'Your healthcare provider has created a secure patient portal account for you.'
  : 'Your account has been created and you now have access to the Vitaluxe platform.'
}

IMPORTANT: You need to set your password before you can access your account.

${params.twoFactorEnabled 
  ? 'Note: Two-factor authentication is enabled. After setting your password, you\'ll need to set up 2FA on your next login.'
  : ''
}

Click here to set your password: ${params.resetLink}

This link will expire in 7 days. If you did not request this account, please disregard this email.

© ${new Date().getFullYear()} Vitaluxe Services. All rights reserved.
  `.trim();
}
