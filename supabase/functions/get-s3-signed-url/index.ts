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

    // Parse request body - accept both old and new formats
    const body = await req.json();
    const { 
      s3_key,           // Old format
      bucketName,       // New format
      filePath,         // New format
      expires_in,       // Old format
      expiresIn         // New format
    } = body;

    // Normalize inputs
    const bucket = bucketName || 'patient-documents';
    const path = filePath || s3_key;
    const expires = expiresIn || expires_in || 300;
    const s3Key = s3_key || `${bucket}/${path}`;

    if (!path) {
      throw new Error('Missing required field: filePath or s3_key');
    }

    console.log('[get-s3-signed-url] Request:', { bucket, path, userId: user.id });

    // Determine effective user (check for impersonation)
    let effectiveUserId = user.id;
    const { data: impersonationData } = await supabase
      .from('active_impersonation_sessions')
      .select('impersonated_user_id')
      .eq('impersonator_id', user.id)
      .maybeSingle();

    if (impersonationData?.impersonated_user_id) {
      effectiveUserId = impersonationData.impersonated_user_id;
      console.log('[get-s3-signed-url] Using impersonated user:', effectiveUserId);
    }

    // Get user's role and practice context
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, id')
      .eq('id', effectiveUserId)
      .single();

    const userRole = profile?.role;
    console.log('[get-s3-signed-url] User role:', userRole);

    // Authorization checks based on bucket
    if (bucket === 'patient-documents') {
      // For patient documents bucket
      const { data: document } = await supabase
        .from('patient_documents')
        .select('id, patient_id, share_with_practice')
        .eq('storage_path', path)
        .maybeSingle();

      if (!document) {
        console.error('[get-s3-signed-url] Document not found in patient_documents:', path);
        throw new Error('Document not found');
      }

      // Get patient's account info
      const { data: patientAccount } = await supabase
        .from('patient_accounts')
        .select('id, user_id, practice_id')
        .eq('id', document.patient_id)
        .single();

      if (!patientAccount) {
        throw new Error('Patient account not found');
      }

      // Check authorization
      if (userRole === 'patient') {
        // Patient can only access their own documents
        if (patientAccount.user_id !== effectiveUserId) {
          console.error('[get-s3-signed-url] Patient accessing another patient\'s document');
          throw new Error('Access denied: Not your document');
        }
      } else if (userRole === 'doctor' || userRole === 'provider' || userRole === 'staff') {
        // Practice users can only access shared documents from their practice
        if (!document.share_with_practice) {
          console.error('[get-s3-signed-url] Document not shared with practice');
          throw new Error('Access denied: Document not shared');
        }
        if (patientAccount.practice_id !== profile.id) {
          console.error('[get-s3-signed-url] Document belongs to different practice');
          throw new Error('Access denied: Document from different practice');
        }
      } else if (userRole !== 'admin') {
        throw new Error('Access denied: Invalid role');
      }

    } else if (bucket === 'provider-documents') {
      // For provider documents bucket
      const { data: providerDoc } = await supabase
        .from('provider_documents')
        .select('id, practice_id')
        .eq('storage_path', path)
        .maybeSingle();

      if (!providerDoc) {
        console.error('[get-s3-signed-url] Document not found in provider_documents:', path);
        throw new Error('Document not found');
      }

      // Check authorization
      if (userRole === 'patient') {
        // Patient can only access provider docs assigned to them
        const { data: assignment } = await supabase
          .from('provider_document_patients')
          .select('id, patient_id, hidden')
          .eq('document_id', providerDoc.id)
          .maybeSingle();

        if (!assignment || assignment.hidden) {
          console.error('[get-s3-signed-url] Provider document not assigned to patient or is hidden');
          throw new Error('Access denied: Document not available');
        }

        // Verify the assignment is for this patient
        const { data: patientAccount } = await supabase
          .from('patient_accounts')
          .select('id')
          .eq('user_id', effectiveUserId)
          .eq('id', assignment.patient_id)
          .maybeSingle();

        if (!patientAccount) {
          console.error('[get-s3-signed-url] Patient account mismatch');
          throw new Error('Access denied');
        }

      } else if (userRole === 'doctor' || userRole === 'provider' || userRole === 'staff') {
        // Practice users can access documents from their practice
        if (providerDoc.practice_id !== profile.id) {
          console.error('[get-s3-signed-url] Provider document from different practice');
          throw new Error('Access denied: Document from different practice');
        }
      } else if (userRole !== 'admin') {
        throw new Error('Access denied: Invalid role');
      }
    } else {
      throw new Error('Invalid bucket');
    }

    // Generate signed URL
    let signedUrl: string;

    // Check for AWS credentials
    const awsAccessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
    const awsSecretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
    const awsRegion = Deno.env.get('AWS_REGION') || 'us-east-1';
    const s3BucketName = Deno.env.get('S3_BUCKET_NAME');

    if (awsAccessKeyId && awsSecretAccessKey && s3BucketName) {
      // Use S3
      console.log('[get-s3-signed-url] Generating S3 signed URL');
      const s3Client = new S3Client({
        region: awsRegion,
        credentials: {
          accessKeyId: awsAccessKeyId,
          secretAccessKey: awsSecretAccessKey,
        },
      });

      const command = new GetObjectCommand({
        Bucket: s3BucketName,
        Key: s3Key,
      });

      signedUrl = await getSignedUrl(s3Client, command, { expiresIn: expires });
    } else {
      // Fallback to Supabase Storage
      console.log('[get-s3-signed-url] Falling back to Supabase Storage');
      const { data: storageData, error: storageError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expires);

      if (storageError) {
        console.error('[get-s3-signed-url] Storage error:', storageError);
        throw storageError;
      }

      if (!storageData?.signedUrl) {
        throw new Error('Failed to generate signed URL from storage');
      }

      signedUrl = storageData.signedUrl;
    }

    console.log('[get-s3-signed-url] Successfully generated signed URL');

    // Log access for HIPAA compliance
    await supabase.rpc('log_audit_event', {
      action_type: 'document_access',
      entity_type: 'document',
      entity_id: null,
      details: {
        bucket,
        path,
        access_type: 'download',
        expires
      }
    });

    // Return both property names for compatibility
    return new Response(
      JSON.stringify({
        success: true,
        signed_url: signedUrl,    // Old format
        signedUrl: signedUrl,      // New format
        expires_in: expires,       // Old format
        expiresIn: expires,        // New format
        s3_key: s3Key
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('[get-s3-signed-url] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to generate signed URL',
        details: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.message.includes('Access denied') ? 403 : 500
      }
    );
  }
});
