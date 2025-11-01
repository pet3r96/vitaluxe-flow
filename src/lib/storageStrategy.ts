import { supabase } from "@/integrations/supabase/client";

/**
 * Unified Storage Strategy with S3-First, Supabase Storage Fallback
 * 
 * HIPAA-compliant document storage with automatic failover:
 * 1. Attempt S3 upload/download (if AWS credentials configured)
 * 2. Silent fallback to Supabase Storage on any S3 failure
 * 3. No user-facing errors for S3 unavailability
 */

export interface UploadResult {
  success: boolean;
  storage_path: string;
  storage_method: 's3' | 'supabase';
  s3_key?: string | null;
  error?: string;
}

export interface SignedUrlResult {
  success: boolean;
  signed_url: string;
  storage_method: 's3' | 'supabase';
  error?: string;
}

/**
 * Upload a document with S3-first, Supabase Storage fallback
 */
export async function uploadDocument(
  bucket: string,
  file: File,
  metadata?: {
    phi?: boolean;
    document_type?: string;
    [key: string]: any;
  }
): Promise<UploadResult> {
  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  
  console.log(`[StorageStrategy] Uploading to bucket: ${bucket}, file: ${fileName}`);
  
  // Try S3 first
  try {
    // Convert file to base64 for edge function
    const reader = new FileReader();
    const fileBuffer = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const { data: s3Data, error: s3Error } = await supabase.functions.invoke('upload-to-s3', {
      body: {
        fileName,
        fileBuffer,
        contentType: file.type,
        metadata: {
          ...metadata,
          bucket,
        }
      }
    });

    // Check if S3 upload succeeded
    if (!s3Error && s3Data?.success && s3Data?.s3_key) {
      console.log(`[StorageStrategy] ✅ S3 upload successful: ${s3Data.s3_key}`);
      return {
        success: true,
        storage_path: fileName,
        storage_method: 's3',
        s3_key: s3Data.s3_key
      };
    }

    // S3 not configured or failed - log and fallback
    console.warn(`[StorageStrategy] S3 upload skipped/failed, falling back to Supabase Storage:`, 
      s3Error?.message || 'AWS not configured');
  } catch (error: any) {
    console.warn(`[StorageStrategy] S3 upload error, falling back to Supabase Storage:`, error.message);
  }

  // Fallback to Supabase Storage
  try {
    console.log(`[StorageStrategy] 📦 Using Supabase Storage fallback for bucket: ${bucket}`);
    
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        contentType: file.type
      });

    if (uploadError) throw uploadError;

    console.log(`[StorageStrategy] ✅ Supabase Storage upload successful: ${fileName}`);
    
    return {
      success: true,
      storage_path: fileName,
      storage_method: 'supabase',
      s3_key: null
    };
  } catch (error: any) {
    console.error(`[StorageStrategy] ❌ Both S3 and Supabase Storage failed:`, error);
    return {
      success: false,
      storage_path: '',
      storage_method: 'supabase',
      error: error.message || 'Upload failed'
    };
  }
}

/**
 * Get a signed URL with S3-first, Supabase Storage fallback
 * 
 * Note: This is a convenience wrapper. Most download flows use the
 * get-s3-signed-url edge function directly, which has the same fallback logic.
 */
export async function getSignedUrl(
  bucket: string,
  filePath: string,
  expiresIn: number = 300
): Promise<SignedUrlResult> {
  console.log(`[StorageStrategy] Getting signed URL for: ${bucket}/${filePath}`);
  
  // Try edge function (which has S3-first logic built-in)
  try {
    const { data, error } = await supabase.functions.invoke('get-s3-signed-url', {
      body: {
        bucketName: bucket,
        filePath,
        expiresIn
      }
    });

    if (!error && data?.signedUrl) {
      const method = data.storage_method || 's3';
      console.log(`[StorageStrategy] ✅ Signed URL generated via ${method}`);
      return {
        success: true,
        signed_url: data.signedUrl || data.signed_url,
        storage_method: method
      };
    }

    console.warn(`[StorageStrategy] Edge function failed, trying direct Storage:`, error?.message);
  } catch (error: any) {
    console.warn(`[StorageStrategy] Edge function error:`, error.message);
  }

  // Fallback to direct Supabase Storage
  try {
    console.log(`[StorageStrategy] 📦 Using Supabase Storage direct signed URL`);
    
    const { data: storageData, error: storageError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn);

    if (storageError) throw storageError;
    if (!storageData?.signedUrl) throw new Error('No signed URL returned');

    console.log(`[StorageStrategy] ✅ Supabase Storage signed URL created`);
    
    return {
      success: true,
      signed_url: storageData.signedUrl,
      storage_method: 'supabase'
    };
  } catch (error: any) {
    console.error(`[StorageStrategy] ❌ Failed to generate signed URL:`, error);
    return {
      success: false,
      signed_url: '',
      storage_method: 'supabase',
      error: error.message || 'Failed to generate signed URL'
    };
  }
}
