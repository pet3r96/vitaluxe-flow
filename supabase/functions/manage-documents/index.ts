import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { S3Client, PutObjectCommand, GetObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.485.0";
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.485.0";
import { corsHeaders } from '../_shared/cors.ts';
import { edgeLogger } from '../_shared/logger.ts';

/**
 * Consolidated Document Management Endpoint with Dual-Provider Fallback
 * 
 * Primary Storage: AWS S3
 * Fallback Storage: Supabase Storage
 * 
 * Actions: create, assign, upload, get-signed-url
 * 
 * CRITICAL: Never throws S3 errors to users - automatically falls back to Supabase Storage
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

    edgeLogger.info('[manage-documents] Action', { action, userId: user.id });

    switch (action) {
      case 'create': {
        const { document_name, document_type, storage_path, file_size, mime_type, tags, notes, patientIds, is_internal, storage_provider } = body;

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
        } else {
          // Check if user is a provider or staff
          const { data: providerRow } = await supabaseAdmin
            .from('providers')
            .select('practice_id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (providerRow?.practice_id) {
            effectivePracticeId = providerRow.practice_id;
          } else {
            const { data: staffRow } = await supabaseAdmin
              .from('practice_staff')
              .select('practice_id')
              .eq('user_id', user.id)
              .maybeSingle();
            
            if (staffRow?.practice_id) {
              effectivePracticeId = staffRow.practice_id;
            }
          }
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
            storage_provider: storage_provider || 's3', // Track which provider was actually used
            file_size,
            mime_type,
            tags: tags || [],
            notes,
            is_internal: is_internal || false
          })
          .select()
          .single();

        if (insertError) throw insertError;

        console.log('[manage-documents] Document created with provider:', storage_provider || 's3');

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
        const { fileName, contentType, fileBuffer, metadata = {}, practiceId } = body;

        if (!fileBuffer || !fileName || !contentType) {
          throw new Error('Missing required fields: fileBuffer, fileName, contentType');
        }

        const buffer = typeof fileBuffer === 'string' 
          ? Uint8Array.from(atob(fileBuffer), c => c.charCodeAt(0))
          : new Uint8Array(fileBuffer);

        const effectivePracticeId = practiceId || user.id;
        const s3Key = `${effectivePracticeId}/${fileName}`;
        const supabasePath = `${effectivePracticeId}/${fileName}`;

        let usedProvider: 's3' | 'supabase' = 's3';
        let uploadSuccess = false;
        let errorDetails = '';

        // TRY S3 FIRST
        const awsAccessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
        const awsSecretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
        const awsRegion = Deno.env.get('AWS_REGION') || 'us-east-1';
        const s3BucketName = Deno.env.get('S3_BUCKET_NAME');

        if (awsAccessKeyId && awsSecretAccessKey && s3BucketName) {
          try {
            console.log('[manage-documents] Attempting S3 upload...');
            const s3Client = new S3Client({
              region: awsRegion,
              credentials: {
                accessKeyId: awsAccessKeyId,
                secretAccessKey: awsSecretAccessKey,
              },
            });

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
            uploadSuccess = true;
            usedProvider = 's3';
            console.log('[manage-documents] ✅ S3 upload successful');
          } catch (s3Error: any) {
            console.error('[manage-documents] ⚠️ S3 upload failed:', s3Error.message);
            errorDetails = s3Error.message;
            uploadSuccess = false;
          }
        } else {
          console.log('[manage-documents] ⚠️ S3 credentials not configured, skipping S3');
          errorDetails = 'S3 credentials not configured';
        }

        // FALLBACK TO SUPABASE STORAGE IF S3 FAILED
        if (!uploadSuccess) {
          try {
            console.log('[manage-documents] Attempting Supabase Storage fallback...');
            
            const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
              .from('provider-documents')
              .upload(supabasePath, buffer, {
                contentType,
                upsert: false,
                metadata: {
                  uploaded_by: user.id,
                  upload_timestamp: new Date().toISOString(),
                  ...metadata
                }
              });

            if (uploadError) throw uploadError;

            uploadSuccess = true;
            usedProvider = 'supabase';
            console.log('[manage-documents] ✅ Supabase Storage fallback successful');
          } catch (supabaseError: any) {
            console.error('[manage-documents] ❌ Supabase Storage fallback also failed:', supabaseError.message);
            throw new Error(`Both S3 and Supabase Storage uploads failed. S3: ${errorDetails}, Supabase: ${supabaseError.message}`);
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            storage_path: usedProvider === 's3' ? s3Key : supabasePath,
            storage_provider: usedProvider,
            bucket: usedProvider === 's3' ? s3BucketName : 'provider-documents',
            file_size: buffer.byteLength,
            fallback_used: usedProvider === 'supabase'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'get-signed-url': {
        const { documentId, path, storage_provider, expiresIn = 300 } = body;

        let storagePath = path;
        let provider = storage_provider;

        // If documentId provided, look up the document to get storage info
        if (documentId) {
          const { data: doc } = await supabaseAdmin
            .from('provider_documents')
            .select('storage_path, storage_provider')
            .eq('id', documentId)
            .single();

          if (doc) {
            storagePath = doc.storage_path;
            provider = doc.storage_provider;
          }
        }

        if (!storagePath) {
          throw new Error('Missing required field: path or documentId');
        }

        provider = provider || 's3'; // Default to s3 if not specified
        let signedUrl: string | null = null;
        let usedProvider = provider;

        // TRY SPECIFIED PROVIDER FIRST
        if (provider === 's3') {
          const awsAccessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
          const awsSecretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
          const awsRegion = Deno.env.get('AWS_REGION') || 'us-east-1';
          const s3BucketName = Deno.env.get('S3_BUCKET_NAME');

          if (awsAccessKeyId && awsSecretAccessKey && s3BucketName) {
            try {
              console.log('[manage-documents] Generating S3 signed URL...');
              const s3Client = new S3Client({
                region: awsRegion,
                credentials: {
                  accessKeyId: awsAccessKeyId,
                  secretAccessKey: awsSecretAccessKey,
                },
              });

              const command = new GetObjectCommand({
                Bucket: s3BucketName,
                Key: storagePath,
              });

              signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
              console.log('[manage-documents] ✅ S3 signed URL generated');
            } catch (s3Error: any) {
              console.error('[manage-documents] ⚠️ S3 signed URL generation failed:', s3Error.message);
              signedUrl = null;
            }
          }
        }

        // FALLBACK TO SUPABASE STORAGE IF PRIMARY FAILED
        if (!signedUrl) {
          try {
            console.log('[manage-documents] Generating Supabase Storage signed URL...');
            const { data: urlData, error: urlError } = await supabaseAdmin.storage
              .from('provider-documents')
              .createSignedUrl(storagePath, expiresIn);

            if (urlError) throw urlError;

            signedUrl = urlData.signedUrl;
            usedProvider = 'supabase';
            console.log('[manage-documents] ✅ Supabase Storage signed URL generated');
          } catch (supabaseError: any) {
            console.error('[manage-documents] ❌ Supabase Storage signed URL generation also failed:', supabaseError.message);
            throw new Error('Both S3 and Supabase Storage signed URL generation failed');
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            url: signedUrl,
            provider: usedProvider,
            fallback_used: usedProvider !== provider
          }),
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
