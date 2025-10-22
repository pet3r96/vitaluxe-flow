/**
 * Send Test Email via Amazon SES
 * 
 * This edge function sends a test email using AWS SES to verify your email configuration.
 * 
 * Required Environment Variables:
 * - AWS_REGION: Your AWS region (e.g., 'us-east-1')
 * - AWS_ACCESS_KEY_ID: Your AWS access key
 * - AWS_SECRET_ACCESS_KEY: Your AWS secret key
 * - SES_FROM_EMAIL: The verified sender email address in SES
 * 
 * To test manually:
 * 1. Deploy this function
 * 2. Call it via POST request to the function URL
 * 3. Check console logs for MessageId or error
 * 
 * Example call from frontend:
 * ```typescript
 * const { data, error } = await supabase.functions.invoke('send-test-email');
 * ```
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SESClient, SendEmailCommand } from "https://esm.sh/@aws-sdk/client-ses@3.511.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Sends a test email using Amazon SES
 * @returns Promise with MessageId on success
 */
async function sendTestEmail() {
  // Get environment variables
  const AWS_REGION = Deno.env.get('AWS_REGION');
  const AWS_ACCESS_KEY_ID = Deno.env.get('AWS_ACCESS_KEY_ID');
  const AWS_SECRET_ACCESS_KEY = Deno.env.get('AWS_SECRET_ACCESS_KEY');
  const SES_FROM_EMAIL = Deno.env.get('SES_FROM_EMAIL');

  // Validate environment variables
  if (!AWS_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !SES_FROM_EMAIL) {
    throw new Error('Missing required AWS environment variables');
  }

  console.log(`Initializing SES client in region: ${AWS_REGION}`);
  console.log(`Sending test email from: ${SES_FROM_EMAIL}`);

  // Initialize SES client
  const sesClient = new SESClient({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });

  // Prepare email command
  const emailCommand = new SendEmailCommand({
    Source: SES_FROM_EMAIL,
    Destination: {
      ToAddresses: [SES_FROM_EMAIL],
    },
    Message: {
      Subject: {
        Data: "Test Email from SES",
        Charset: "UTF-8",
      },
      Body: {
        Text: {
          Data: "Your SES test email worked!",
          Charset: "UTF-8",
        },
      },
    },
  });

  try {
    // Send the email
    const response = await sesClient.send(emailCommand);
    console.log(`✅ Email sent successfully! MessageId: ${response.MessageId}`);
    return {
      success: true,
      messageId: response.MessageId,
      message: 'Test email sent successfully',
    };
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📧 Starting test email send...');
    
    // Send test email
    const result = await sendTestEmail();

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in send-test-email function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
