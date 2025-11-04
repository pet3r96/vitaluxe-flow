import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StaffWelcomeEmailRequest {
  userId: string;
  email: string;
  name: string;
  token: string;
  practiceId: string;
  roleType?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user is authenticated
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const requestData: StaffWelcomeEmailRequest = await req.json();
    const { userId, email, name, token: resetToken, practiceId, roleType } = requestData;

    // Validate required fields
    if (!userId || !email || !name || !resetToken || !practiceId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, email, name, token, practiceId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get practice information
    const { data: practice, error: practiceError } = await supabase
      .from('profiles')
      .select('name, company, phone')
      .eq('id', practiceId)
      .single();

    if (practiceError) {
      console.error('Error fetching practice:', practiceError);
    }

    const practiceName = practice?.name || practice?.company || 'VitaLuxe';
    const practicePhone = practice?.phone || '';

    // Create activation link
    const activationLink = `https://app.vitaluxeservices.com/change-password?token=${resetToken}`;

    // Get Postmark API key
    const postmarkApiKey = Deno.env.get('POSTMARK_API_KEY');
    if (!postmarkApiKey) {
      console.error('POSTMARK_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send email using Postmark
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${practiceName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Welcome to ${practiceName}!</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Hello ${name},
              </p>
              
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                You've been added as a staff member${roleType ? ` (${roleType})` : ''} at <strong>${practiceName}</strong>. To get started, you'll need to set up your password and activate your account.
              </p>
              
              <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 30px 0;">
                <p style="margin: 0 0 15px 0; color: #333333; font-size: 16px; font-weight: 600;">
                  🔐 Set Up Your Password
                </p>
                <p style="margin: 0 0 20px 0; color: #666666; font-size: 14px; line-height: 1.5;">
                  Click the button below to set your password and activate your account. This link is valid for 7 days.
                </p>
                <div style="text-align: center;">
                  <a href="${activationLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                    Set Your Password
                  </a>
                </div>
              </div>
              
              <p style="margin: 30px 0 10px 0; color: #666666; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 30px 0; color: #667eea; font-size: 14px; word-break: break-all;">
                ${activationLink}
              </p>
              
              <div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 15px; margin: 30px 0;">
                <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.5;">
                  <strong>⚠️ Security Notice:</strong> If you did not expect this email or did not request to join this practice, please contact ${practiceName} immediately${practicePhone ? ` at ${practicePhone}` : ''}.
                </p>
              </div>
              
              <p style="margin: 30px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                After setting your password, you can log in at:<br>
                <a href="https://app.vitaluxeservices.com" style="color: #667eea; text-decoration: none;">https://app.vitaluxeservices.com</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e9ecef;">
              <p style="margin: 0 0 10px 0; color: #999999; font-size: 12px; line-height: 1.5;">
                This email was sent to ${email} because you were added as a staff member at ${practiceName}.
              </p>
              <p style="margin: 0; color: #999999; font-size: 12px; line-height: 1.5;">
                © ${new Date().getFullYear()} VitaLuxe Services. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const emailText = `
Welcome to ${practiceName}!

Hello ${name},

You've been added as a staff member${roleType ? ` (${roleType})` : ''} at ${practiceName}. To get started, you'll need to set up your password and activate your account.

SET UP YOUR PASSWORD
Click the link below to set your password and activate your account. This link is valid for 7 days.

${activationLink}

SECURITY NOTICE
If you did not expect this email or did not request to join this practice, please contact ${practiceName} immediately${practicePhone ? ` at ${practicePhone}` : ''}.

After setting your password, you can log in at:
https://app.vitaluxeservices.com

---
This email was sent to ${email} because you were added as a staff member at ${practiceName}.
© ${new Date().getFullYear()} VitaLuxe Services. All rights reserved.
    `.trim();

    console.log('Sending staff welcome email via Postmark...');
    const postmarkResponse = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': postmarkApiKey,
      },
      body: JSON.stringify({
        From: 'VitaLuxe Services <noreply@vitaluxeservices.com>',
        To: email,
        Subject: `Welcome to ${practiceName} - Set Your Password`,
        HtmlBody: emailHtml,
        TextBody: emailText,
        MessageStream: 'outbound'
      })
    });

    if (!postmarkResponse.ok) {
      const errorText = await postmarkResponse.text();
      console.error('Postmark API error:', errorText);
      throw new Error(`Failed to send email: ${postmarkResponse.status} ${errorText}`);
    }

    const postmarkData = await postmarkResponse.json();
    console.log('✅ Staff welcome email sent successfully:', postmarkData);

    // Log audit event
    await supabase.rpc('log_audit_event', {
      p_action_type: 'staff_welcome_email_sent',
      p_entity_type: 'practice_staff',
      p_entity_id: userId,
      p_details: {
        staff_email: email,
        staff_name: name,
        practice_id: practiceId,
        practice_name: practiceName,
        role_type: roleType,
        message_id: postmarkData.MessageID
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Staff welcome email sent successfully',
        messageId: postmarkData.MessageID
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-staff-welcome-email:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send staff welcome email'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
