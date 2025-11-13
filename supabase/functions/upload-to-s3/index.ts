import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.485.0";
import { createAuthClient } from '../_shared/supabaseAdmin.ts';
import { validateCSRFToken } from '../_shared/csrfValidator.ts';
import { handleError, mapExternalApiError } from '../_shared/errorHandler.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Declare variables outside try block for error handler access
  const supabase = createAuthClient(req.headers.get('Authorization'));
  let fileName: string = 'unknown';
  let contentType: string = 'unknown';

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Validate CSRF token
    const csrfToken = req.headers.get('x-csrf-token') || undefined;
    const { valid, error: csrfError } = await validateCSRFToken(supabase, user.id, csrfToken);
    if (!valid) {
      console.error('CSRF validation failed:', csrfError);
      return new Response(
        JSON.stringify({ error: csrfError || 'Invalid CSRF token' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestBody = await req.json();
    fileName = requestBody.fileName;
    contentType = requestBody.contentType;
    const fileBuffer = requestBody.fileBuffer;
    const metadata = requestBody.metadata || {};

    if (!fileBuffer || !fileName || !contentType) {
      throw new Error('Missing required fields: fileBuffer, fileName, contentType');
    }

    // Check for AWS credentials
    const awsAccessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
    const awsSecretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
    const awsRegion = Deno.env.get('AWS_REGION') || 'us-east-1';
    const s3BucketName = Deno.env.get('S3_BUCKET_NAME');

    if (!awsAccessKeyId || !awsSecretAccessKey || !s3BucketName) {
      console.warn('AWS S3 credentials not configured - upload skipped');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'AWS S3 not configured - file not uploaded to S3',
          s3_key: null,
          bucket: null
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

    // Convert base64 to buffer if needed
    const buffer = typeof fileBuffer === 'string' 
      ? Uint8Array.from(atob(fileBuffer), c => c.charCodeAt(0))
      : new Uint8Array(fileBuffer);

    // Prepare S3 key (path)
    const s3Key = `${user.id}/${fileName}`;

    // Prepare metadata for HIPAA compliance
    const s3Metadata = {
      uploaded_by: user.id,
      upload_timestamp: new Date().toISOString(),
      user_email: user.email || 'unknown',
      ...metadata
    };

    // Upload to S3 with server-side encryption
    const command = new PutObjectCommand({
      Bucket: s3BucketName,
      Key: s3Key,
      Body: buffer,
      ContentType: contentType,
      ServerSideEncryption: 'AES256', // Server-side encryption for HIPAA
      Metadata: s3Metadata,
      // Optional: Add custom headers for versioning
      CacheControl: 'no-cache',
    });

    await s3Client.send(command);

    console.log(`File uploaded to S3: s3://${s3BucketName}/${s3Key}`);

    // Log PHI access for HIPAA compliance
    if (metadata.phi === 'true' || metadata.document_type === 'prescription') {
      await supabase.rpc('log_audit_event', {
        action_type: 's3_phi_upload',
        entity_type: 'document',
        entity_id: null,
        details: {
          s3_key: s3Key,
          document_type: metadata.document_type,
          file_size: buffer.byteLength,
          phi: true
        }
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        s3_key: s3Key,
        bucket: s3BucketName,
        region: awsRegion,
        file_size: buffer.byteLength
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('S3 upload error:', error);
    return handleError(
      supabase,
      error,
      'upload-to-s3',
      'external_api',
      corsHeaders,
      { file_name: fileName, content_type: contentType }
    );
  }
});
