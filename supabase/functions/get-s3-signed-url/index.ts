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

    console.log('[get-s3-signed-url] 🔐 Authenticated user:', user.id);

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
    // S3 key should just be the path (not bucket/path) when using new format
    const s3Key = s3_key || path;

    if (!path) {
      throw new Error('Missing required field: filePath or s3_key');
    }

    // Determine effective user (check for impersonation)
    let effectiveUserId = user.id;
    const { data: impersonationData } = await supabase
      .from('active_impersonation_sessions')
      .select('impersonated_user_id')
      .eq('impersonator_id', user.id)
      .maybeSingle();

    if (impersonationData?.impersonated_user_id) {
      effectiveUserId = impersonationData.impersonated_user_id;
      console.log('[get-s3-signed-url] 🔄 Using impersonated user:', effectiveUserId);
    }

    // Get user's role (try user_roles first, fallback to profiles)
    let userRole: string | null = null;
    const { data: userRoleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', effectiveUserId)
      .maybeSingle();
    
    if (userRoleData?.role) {
      userRole = userRoleData.role;
    } else {
      // Fallback to profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', effectiveUserId)
        .maybeSingle();
      userRole = profile?.role || null;
    }

    console.log('[get-s3-signed-url] 👤 Role:', userRole, '| Request:', { bucket, path });

    // Compute effective practice ID for authorization
    let effectivePracticeId: string | null = null;
    if (userRole === 'doctor') {
      // Doctor is the practice owner
      effectivePracticeId = effectiveUserId;
    } else if (userRole === 'provider') {
      // Lookup practice_id from providers table
      const { data: providerRecord } = await supabase
        .from('providers')
        .select('practice_id')
        .eq('user_id', effectiveUserId)
        .maybeSingle();
      effectivePracticeId = providerRecord?.practice_id || null;
    } else if (userRole === 'staff') {
      // Try practice_staff first, fallback to providers
      const { data: staffRecord } = await supabase
        .from('practice_staff')
        .select('practice_id')
        .eq('user_id', effectiveUserId)
        .maybeSingle();
      
      if (staffRecord?.practice_id) {
        effectivePracticeId = staffRecord.practice_id;
      } else {
        // Fallback: staff member might also be a provider
        const { data: providerRecord } = await supabase
          .from('providers')
          .select('practice_id')
          .eq('user_id', effectiveUserId)
          .maybeSingle();
        effectivePracticeId = providerRecord?.practice_id || null;
      }
    }
    console.log('[get-s3-signed-url] 🏥 Effective practice ID:', effectivePracticeId);

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

      // Authorization logic
      let authResult = { allowed: false, reason: '' };
      
      if (userRole === 'patient') {
        // Patient can only access their own documents
        if (patientAccount.user_id === effectiveUserId) {
          authResult = { allowed: true, reason: 'patient owns document' };
        } else {
          authResult = { allowed: false, reason: 'patient accessing another patient\'s document' };
        }
      } else if (userRole === 'doctor' || userRole === 'provider' || userRole === 'staff') {
        // Practice users can only access shared documents from their practice
        if (!document.share_with_practice) {
          authResult = { allowed: false, reason: 'document not shared with practice' };
        } else if (!effectivePracticeId) {
          authResult = { allowed: false, reason: 'no practice context' };
        } else if (patientAccount.practice_id !== effectivePracticeId) {
          authResult = { allowed: false, reason: 'document from different practice' };
        } else {
          authResult = { allowed: true, reason: 'practice user accessing shared document' };
        }
      } else if (userRole === 'admin') {
        authResult = { allowed: true, reason: 'admin access' };
      } else {
        authResult = { allowed: false, reason: 'invalid role' };
      }

      console.log('[get-s3-signed-url] 🔐 Authorization:', authResult);

      if (!authResult.allowed) {
        throw new Error(`Access denied: ${authResult.reason}`);
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

      // Authorization logic
      let authResult = { allowed: false, reason: '' };
      
      if (userRole === 'patient') {
        // Patient can only access provider docs assigned to them
        const { data: patientAccount } = await supabase
          .from('patient_accounts')
          .select('id')
          .eq('user_id', effectiveUserId)
          .maybeSingle();

        if (!patientAccount) {
          authResult = { allowed: false, reason: 'patient account not found' };
        } else {
          // Check for assignment
          const { data: assignment } = await supabase
            .from('provider_document_patients')
            .select('id, hidden, is_hidden')
            .eq('document_id', providerDoc.id)
            .eq('patient_id', patientAccount.id)
            .maybeSingle();

          if (!assignment) {
            authResult = { allowed: false, reason: 'document not assigned to patient' };
          } else if (assignment.hidden || assignment.is_hidden) {
            authResult = { allowed: false, reason: 'document hidden from patient' };
          } else {
            authResult = { allowed: true, reason: 'patient has assignment' };
          }
        }
      } else if (userRole === 'doctor' || userRole === 'provider' || userRole === 'staff') {
        // Practice users can access documents from their practice
        if (!effectivePracticeId) {
          authResult = { allowed: false, reason: 'no practice context' };
        } else if (providerDoc.practice_id !== effectivePracticeId) {
          authResult = { allowed: false, reason: 'document from different practice' };
        } else {
          authResult = { allowed: true, reason: 'practice user accessing own practice document' };
        }
      } else if (userRole === 'admin') {
        authResult = { allowed: true, reason: 'admin access' };
      } else {
        authResult = { allowed: false, reason: 'invalid role' };
      }

      console.log('[get-s3-signed-url] 🔐 Authorization:', authResult);

      if (!authResult.allowed) {
        throw new Error(`Access denied: ${authResult.reason}`);
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

    let storageMethod: 's3' | 'supabase' = 'supabase';
    
    if (awsAccessKeyId && awsSecretAccessKey && s3BucketName) {
      // Try S3 first
      try {
        console.log('[get-s3-signed-url] 📦 Attempting S3 signed URL');
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
        storageMethod = 's3';
        console.log('[get-s3-signed-url] ✅ S3 signed URL generated');
      } catch (s3Error: any) {
        console.warn('[get-s3-signed-url] ⚠️ S3 failed, falling back to Supabase Storage:', s3Error.message);
        
        // Fallback to Supabase Storage
        const { data: storageData, error: storageError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, expires);

        if (storageError) {
          console.error('[get-s3-signed-url] ❌ Storage fallback also failed:', storageError);
          throw storageError;
        }

        if (!storageData?.signedUrl) {
          throw new Error('Failed to generate signed URL from storage');
        }

        signedUrl = storageData.signedUrl;
        console.log('[get-s3-signed-url] ✅ Supabase Storage signed URL generated (fallback)');
      }
    } else {
      // No S3 configured - use Supabase Storage directly
      console.log('[get-s3-signed-url] 📦 AWS not configured, using Supabase Storage');
      const { data: storageData, error: storageError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expires);

      if (storageError) {
        console.error('[get-s3-signed-url] ❌ Storage error:', storageError);
        throw storageError;
      }

      if (!storageData?.signedUrl) {
        throw new Error('Failed to generate signed URL from storage');
      }

      signedUrl = storageData.signedUrl;
    }

    // Log access for HIPAA compliance
    await supabase.rpc('log_audit_event', {
      action_type: 'document_access',
      entity_type: 'document',
      entity_id: null,
      details: {
        bucket,
        path,
        storage_method: storageMethod,
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
        storage_method: storageMethod,
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
