import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SESClient, SendEmailCommand } from "https://esm.sh/@aws-sdk/client-ses@3.423.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerificationEmailRequest {
  userId: string;
  email: string;
  name: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, email, name }: VerificationEmailRequest = await req.json();

    if (!userId || !email || !name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, email, name' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Initialize Supabase client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Generate unique verification token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store token in database
    const { error: tokenError } = await supabaseAdmin
      .from('email_verification_tokens')
      .insert({
        user_id: userId,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (tokenError) {
      console.error('Error storing verification token:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to create verification token' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Get AWS SES credentials
    const AWS_ACCESS_KEY_ID = Deno.env.get('AWS_ACCESS_KEY_ID');
    const AWS_SECRET_ACCESS_KEY = Deno.env.get('AWS_SECRET_ACCESS_KEY');
    const AWS_REGION = Deno.env.get('AWS_REGION') || 'us-east-1';
    const SES_FROM_EMAIL = Deno.env.get('SES_FROM_EMAIL') || 'info@vitaluxeservices.com';

    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      return new Response(
        JSON.stringify({ error: 'AWS credentials not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Create verification URL
    const verificationUrl = `${Deno.env.get('SUPABASE_URL')?.replace('/v1', '')}/verify-email?token=${token}`;

    // Initialize SES client
    const sesClient = new SESClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });

    // Construct email HTML
    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email - VitaLuxe</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to VitaLuxe!</h1>
          </div>
          
          <div style="background: #ffffff; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">Hi ${name},</h2>
            
            <p style="font-size: 16px; line-height: 1.8;">
              Thank you for signing up for VitaLuxe! To complete your registration and activate your account, please verify your email address by clicking the button below:
            </p>
            
            <div style="text-align: center; margin: 35px 0;">
              <a href="${verificationUrl}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 15px 40px; 
                        text-decoration: none; 
                        border-radius: 5px; 
                        font-weight: bold; 
                        font-size: 16px;
                        display: inline-block;
                        box-shadow: 0 4px 6px rgba(102, 126, 234, 0.4);">
                Verify Email Address
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Or copy and paste this link into your browser:
            </p>
            <p style="font-size: 13px; color: #667eea; word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 5px;">
              ${verificationUrl}
            </p>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              <strong>This verification link will expire in 24 hours.</strong>
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="font-size: 13px; color: #999;">
              If you didn't create an account with VitaLuxe, you can safely ignore this email.
            </p>
            
            <p style="font-size: 13px; color: #999; margin-top: 20px;">
              Need help? Contact us at <a href="mailto:support@vitaluxeservices.com" style="color: #667eea;">support@vitaluxeservices.com</a>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>© ${new Date().getFullYear()} VitaLuxe. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    // Send email using SES
    const sendEmailCommand = new SendEmailCommand({
      Source: SES_FROM_EMAIL,
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: "Verify Your Email - VitaLuxe",
          Charset: "UTF-8",
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: "UTF-8",
          },
          Text: {
            Data: `Welcome to VitaLuxe!\n\nHi ${name},\n\nThank you for signing up! To complete your registration, please verify your email address by visiting:\n\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nIf you didn't create an account, you can safely ignore this email.\n\nNeed help? Contact support@vitaluxeservices.com`,
            Charset: "UTF-8",
          },
        },
      },
    });

    await sesClient.send(sendEmailCommand);

    console.log('Verification email sent successfully:', { email, userId });

    return new Response(
      JSON.stringify({ success: true, message: 'Verification email sent' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error: any) {
    console.error('Error in send-verification-email:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

serve(handler);
