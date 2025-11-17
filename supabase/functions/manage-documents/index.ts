import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { S3Client, PutObjectCommand, GetObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.485.0";
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.485.0";
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Consolidated Document Management Endpoint
 * Actions: create, assign, upload, get-signed-url
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing authorization token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action } = body;

    console.log('[manage-documents] Action:', action, 'User:', user.id);

    switch (action) {
      case 'create': {
        // From create-provider-document logic
        const { document_name, document_type, storage_path, file_size, mime_type, tags, notes, patientIds, is_internal } = body;

        // Resolve effective practice ID
        let effectivePracticeId: string | null = null;
        
        const { data: doctorRole } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'doctor')
          .maybeSingle();

        if (doctorRole) {
          effectivePracticeId = user.id;
        }

        if (!effectivePracticeId) {
          return new Response(
            JSON.stringify({ error: 'No practice context', code: 'no_practice_context' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: document, error: insertError } = await supabaseAdmin
          .from('provider_documents')
          .insert({
            practice_id: effectivePracticeId,
            document_name,
            document_type,
            storage_path,
            file_size,
            mime_type,
            tags: tags || [],
            notes,
            is_internal: is_internal || false
          })
          .select()
          .single();

        if (insertError) throw insertError;

        return new Response(
          JSON.stringify({ success: true, document }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'assign': {
        // From assign-document-to-patient logic
        const { documentId, patientIds } = body;

        if (!documentId || !patientIds || !Array.isArray(patientIds)) {
          return new Response(
            JSON.stringify({ error: 'documentId and patientIds required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const assignments = patientIds.map(patientId => ({
          document_id: documentId,
          patient_id: patientId,
          assigned_at: new Date().toISOString()
        }));

        const { data, error } = await supabaseAdmin
          .from('provider_document_assignments')
          .insert(assignments)
          .select();

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, assignments: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'upload': {
        // From upload-to-s3 logic
        const { fileName, contentType, fileBuffer, metadata = {} } = body;

        if (!fileBuffer || !fileName || !contentType) {
          throw new Error('Missing required fields: fileBuffer, fileName, contentType');
        }

        const awsAccessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
        const awsSecretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
        const awsRegion = Deno.env.get('AWS_REGION') || 'us-east-1';
        const s3BucketName = Deno.env.get('S3_BUCKET_NAME');

        if (!awsAccessKeyId || !awsSecretAccessKey || !s3BucketName) {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'AWS S3 not configured - file not uploaded to S3',
              s3_key: null
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        const s3Client = new S3Client({
          region: awsRegion,
          credentials: {
            accessKeyId: awsAccessKeyId,
            secretAccessKey: awsSecretAccessKey,
          },
        });

        const buffer = typeof fileBuffer === 'string' 
          ? Uint8Array.from(atob(fileBuffer), c => c.charCodeAt(0))
          : new Uint8Array(fileBuffer);

        const s3Key = `${user.id}/${fileName}`;

        const command = new PutObjectCommand({
          Bucket: s3BucketName,
          Key: s3Key,
          Body: buffer,
          ContentType: contentType,
          ServerSideEncryption: 'AES256',
          Metadata: {
            uploaded_by: user.id,
            upload_timestamp: new Date().toISOString(),
            ...metadata
          },
        });

        await s3Client.send(command);

        return new Response(
          JSON.stringify({
            success: true,
            s3_key: s3Key,
            bucket: s3BucketName
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'get-signed-url': {
        // From get-s3-signed-url logic
        const { bucket, path, expiresIn = 300 } = body;

        if (!path) {
          throw new Error('Missing required field: path');
        }

        const awsAccessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
        const awsSecretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
        const awsRegion = Deno.env.get('AWS_REGION') || 'us-east-1';
        const s3BucketName = bucket || Deno.env.get('S3_BUCKET_NAME');

        if (!awsAccessKeyId || !awsSecretAccessKey || !s3BucketName) {
          throw new Error('AWS S3 credentials not configured');
        }

        const s3Client = new S3Client({
          region: awsRegion,
          credentials: {
            accessKeyId: awsAccessKeyId,
            secretAccessKey: awsSecretAccessKey,
          },
        });

        const command = new GetObjectCommand({
          Bucket: s3BucketName,
          Key: path,
        });

        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });

        return new Response(
          JSON.stringify({ success: true, url: signedUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Invalid action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error: any) {
    console.error('[manage-documents] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
