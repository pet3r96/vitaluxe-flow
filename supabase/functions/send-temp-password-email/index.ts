import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SESClient, SendEmailCommand } from "https://esm.sh/@aws-sdk/client-ses@3.423.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TempPasswordEmailRequest {
  email: string;
  name: string;
  tempPassword: string;
  createdBy: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, tempPassword, createdBy }: TempPasswordEmailRequest = await req.json();

    if (!email || !name || !tempPassword || !createdBy) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, name, tempPassword, createdBy' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Initialize Supabase client to verify admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify that the caller is an admin
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', createdBy)
      .maybeSingle();

    if (rolesError || roles?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Only admins can send temp password emails' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
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

    // Create login URL
    const loginUrl = `${Deno.env.get('SUPABASE_URL')?.replace('/v1', '')}/auth`;

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
          <title>Your VitaLuxe Account - Temporary Password</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to VitaLuxe!</h1>
          </div>
          
          <div style="background: #ffffff; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">Hi ${name},</h2>
            
            <p style="font-size: 16px; line-height: 1.8;">
              An account has been created for you on VitaLuxe by an administrator. Below are your login credentials:
            </p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #667eea;">
              <p style="margin: 0 0 10px 0; font-weight: bold; color: #333;">Email Address:</p>
              <p style="margin: 0 0 20px 0; font-family: monospace; font-size: 14px; color: #667eea;">${email}</p>
              
              <p style="margin: 0 0 10px 0; font-weight: bold; color: #333;">Temporary Password:</p>
              <p style="margin: 0; font-family: monospace; font-size: 16px; color: #764ba2; font-weight: bold; letter-spacing: 1px;">${tempPassword}</p>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 25px 0;">
              <p style="margin: 0; font-size: 14px; color: #856404;">
                <strong>⚠️ Important:</strong> You will be required to change this password upon your first login for security purposes.
              </p>
            </div>
            
            <div style="text-align: center; margin: 35px 0;">
              <a href="${loginUrl}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 15px 40px; 
                        text-decoration: none; 
                        border-radius: 5px; 
                        font-weight: bold; 
                        font-size: 16px;
                        display: inline-block;
                        box-shadow: 0 4px 6px rgba(102, 126, 234, 0.4);">
                Log In Now
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Or copy and paste this link into your browser:
            </p>
            <p style="font-size: 13px; color: #667eea; word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 5px;">
              ${loginUrl}
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="font-size: 13px; color: #999;">
              For your security, please do not share this temporary password with anyone. If you did not expect this email, please contact us immediately at <a href="mailto:support@vitaluxeservices.com" style="color: #667eea;">support@vitaluxeservices.com</a>
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
          Data: "Your VitaLuxe Account - Temporary Password",
          Charset: "UTF-8",
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: "UTF-8",
          },
          Text: {
            Data: `Welcome to VitaLuxe!\n\nHi ${name},\n\nAn account has been created for you by an administrator.\n\nEmail: ${email}\nTemporary Password: ${tempPassword}\n\nIMPORTANT: You will be required to change this password upon your first login.\n\nLog in at: ${loginUrl}\n\nFor security, do not share this password. If you didn't expect this email, contact support@vitaluxeservices.com`,
            Charset: "UTF-8",
          },
        },
      },
    });

    await sesClient.send(sendEmailCommand);

    console.log('Temp password email sent successfully:', { email });

    return new Response(
      JSON.stringify({ success: true, message: 'Temporary password email sent' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error: any) {
    console.error('Error in send-temp-password-email:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

serve(handler);
