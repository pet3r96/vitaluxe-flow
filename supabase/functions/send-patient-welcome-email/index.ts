import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

interface PatientWelcomeEmailRequest {
  userId: string;
  email: string;
  name: string;
  token: string;
  practiceId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authToken = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authToken);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, email, name, token, practiceId }: PatientWelcomeEmailRequest = await req.json();

    // Validate required fields
    if (!userId || !email || !name || !token || !practiceId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
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

    // Get practice name
    const { data: practice } = await supabaseAdmin
      .from('profiles')
      .select('name, company, phone')
      .eq('id', practiceId)
      .single();

    const practiceName = practice?.company || practice?.name || 'Your Practice';
    const practicePhone = practice?.phone || '';

    // Check if 2FA is enabled system-wide
    const { data: twoFASetting } = await supabaseAdmin
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'two_fa_enforcement_enabled')
      .maybeSingle();

    const twoFAEnabled = twoFASetting?.setting_value === 'true';

    const POSTMARK_API_KEY = Deno.env.get('POSTMARK_API_KEY');
    if (!POSTMARK_API_KEY) {
      console.error('POSTMARK_API_KEY not configured');
      throw new Error('Email service not configured');
    }

    // Send email via Postmark
    const postmarkResponse = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': POSTMARK_API_KEY,
      },
      body: JSON.stringify({
        From: 'noreply@vitaluxeservices.com',
        To: email,
        Subject: `Welcome to ${practiceName} Patient Portal`,
        HtmlBody: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #E2C977; background-color: #0B0B0B; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 0 auto; }
              .header { background-color: #292929; padding: 30px 20px; text-align: center; }
              .content { background-color: #1A1A1A; padding: 40px 30px; border: 1px solid #292929; }
              .content h2 { color: #E2C977; margin-top: 0; }
              .content p { color: #E2C977; }
              .feature { margin: 15px 0; padding-left: 25px; }
              .feature:before { content: "✓"; color: #C8A64B; font-weight: bold; margin-right: 10px; }
              .button { display: inline-block; background-color: #C8A64B; color: #0B0B0B; padding: 14px 35px; text-decoration: none; border-radius: 6px; margin: 25px 0; font-weight: bold; }
              .footer { text-align: center; padding: 25px 20px; color: #8E6E1E; font-size: 12px; background-color: #0B0B0B; }
              .info-box { background-color: #292929; padding: 15px; border-left: 4px solid #C8A64B; margin: 20px 0; }
              strong { color: #C8A64B; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <img src="https://app.vitaluxeservices.com/vitaluxe-logo-dark-bg.png" alt="Vitaluxe" style="max-width: 200px; height: auto;" />
              </div>
              <div class="content">
                <h2>Welcome to ${practiceName} Patient Portal, ${name}!</h2>
                <p>Great news! ${practiceName} has invited you to access their secure patient portal.</p>
                
                <p><strong>With your portal account, you can:</strong></p>
                <div class="feature">View your medical records</div>
                <div class="feature">Message your care team</div>
                <div class="feature">Schedule appointments</div>
                <div class="feature">Access test results</div>
                
                <div class="info-box">
                  <p style="margin: 0;"><strong>Your Email:</strong> ${email}</p>
                </div>
                
                <p><strong>Getting Started:</strong></p>
                <p>Click the button below to set your secure password and activate your account:</p>
                
                <a href="https://app.vitaluxeservices.com/change-password?token=${token}" class="button">Activate My Account</a>
                
                <p style="color: #8E6E1E; font-size: 13px;"><em>This link expires in 7 days.</em></p>
                
                ${twoFAEnabled ? `
                  <div class="info-box">
                    <p style="margin: 0; font-size: 14px;">
                      <strong>Security Notice:</strong> After setting your password, you'll be prompted to set up two-factor authentication (2FA) for enhanced security.
                    </p>
                  </div>
                ` : ''}
                
                <p>Questions? ${practicePhone ? `Call us at ${practicePhone} or ` : ''}reply to this email.</p>
              </div>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} ${practiceName}. All rights reserved.</p>
                <p>Powered by Vitaluxe Services</p>
              </div>
            </div>
          </body>
          </html>
        `,
        TextBody: `Welcome to ${practiceName} Patient Portal, ${name}!\n\nGreat news! ${practiceName} has invited you to access their secure patient portal.\n\nWith your portal account, you can:\n- View your medical records\n- Message your care team\n- Schedule appointments\n- Access test results\n\nYour Email: ${email}\n\nActivate your account:\nhttps://app.vitaluxeservices.com/change-password?token=${token}\n\nThis link expires in 7 days.\n\n${twoFAEnabled ? 'Security Notice: After setting your password, you\'ll be prompted to set up two-factor authentication (2FA) for enhanced security.\n\n' : ''}Questions? ${practicePhone ? `Call us at ${practicePhone} or ` : ''}Reply to this email.\n\n- ${practiceName} Team`
      }),
    });

    if (!postmarkResponse.ok) {
      const errorText = await postmarkResponse.text();
      console.error('Postmark API error:', errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const result = await postmarkResponse.json();
    console.log('Patient welcome email sent successfully:', result.MessageID);

    // Update patient account invitation status
    await supabaseAdmin
      .from('patient_accounts')
      .update({ 
        invitation_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    // Log audit event
    try {
      await supabaseAdmin.rpc('log_audit_event', {
        p_action_type: 'patient_welcome_email_sent',
        p_entity_type: 'patient_accounts',
        p_entity_id: userId,
        p_details: {
          email: email,
          practice_id: practiceId,
          sent_by: user.id,
          message_id: result.MessageID
        }
      });
    } catch (auditError) {
      console.error('Failed to log audit event:', auditError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        messageId: result.MessageID
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-patient-welcome-email function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to send welcome email' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
