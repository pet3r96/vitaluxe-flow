import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { S3Client, GetObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.485.0";
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.485.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { s3_key, expires_in = 3600 } = await req.json();

    if (!s3_key) {
      throw new Error('Missing required field: s3_key');
    }

    // Check for AWS credentials
    const awsAccessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
    const awsSecretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
    const awsRegion = Deno.env.get('AWS_REGION') || 'us-east-1';
    const s3BucketName = Deno.env.get('S3_BUCKET_NAME');

    if (!awsAccessKeyId || !awsSecretAccessKey || !s3BucketName) {
      console.warn('AWS S3 credentials not configured - returning placeholder URL');
      return new Response(
        JSON.stringify({
          success: true,
          signed_url: null,
          message: 'AWS S3 not configured'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // Initialize S3 client
    const s3Client = new S3Client({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
      },
    });

    // Generate signed URL
    const command = new GetObjectCommand({
      Bucket: s3BucketName,
      Key: s3_key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: expires_in, // URL expires in 1 hour by default
    });

    console.log(`Generated signed URL for: s3://${s3BucketName}/${s3_key}`);

    // Log access for HIPAA compliance
    await supabase.rpc('log_audit_event', {
      action_type: 's3_access',
      entity_type: 'document',
      entity_id: null,
      details: {
        s3_key,
        access_type: 'download',
        expires_in
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        signed_url: signedUrl,
        expires_in,
        s3_key
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('Error generating S3 signed URL:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to generate signed URL',
        details: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
