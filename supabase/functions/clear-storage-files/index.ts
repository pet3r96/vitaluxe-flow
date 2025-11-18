import { createClient } from "npm:@supabase/supabase-js@2";
import { edgeLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClearStorageRequest {
  confirm: string;
  buckets?: string[];
}

interface BucketResult {
  files_found: number;
  files_deleted: number;
  errors: string[];
}

interface FileObject {
  name: string;
  id?: string;
  metadata?: any;
}

// Recursive function to list all files in a bucket, including nested folders
async function listAllFiles(
  supabaseAdmin: any,
  bucketName: string,
  prefix: string = ""
): Promise<string[]> {
  const allFiles: string[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data: items, error } = await supabaseAdmin
      .storage
      .from(bucketName)
      .list(prefix, {
        limit,
        offset,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (error) {
      edgeLogger.error('Error listing files in bucket', error, { bucketName, prefix });
      break;
    }

    if (!items || items.length === 0) {
      break;
    }

    for (const item of items) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      
      // Check if it's a folder (no id/metadata) or a file
      if (!item.id && !item.metadata) {
        // It's a folder, recurse into it
        const nestedFiles = await listAllFiles(supabaseAdmin, bucketName, fullPath);
        allFiles.push(...nestedFiles);
      } else {
        // It's a file
        allFiles.push(fullPath);
      }
    }

    // Check if there are more items to fetch
    if (items.length < limit) {
      break;
    }
    offset += limit;
  }

  return allFiles;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      edgeLogger.error('Missing authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract token from Bearer header
    const token = authHeader.replace('Bearer ', '');

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify user with service role client
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      edgeLogger.error('Authentication failed', userError, { hasUser: !!user });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Unauthorized: Invalid or expired token' 
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    edgeLogger.info('User authenticated');

    // Admin-only check
    const { data: roleCheck, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleCheck) {
      edgeLogger.error('Access denied - admin role required');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Access denied: admin role required' 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const requestBody = await req.json() as ClearStorageRequest;

    if (requestBody.confirm !== 'CLEAR ALL STORAGE') {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid confirmation text' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default buckets to clear (excluding product-images)
    const bucketsToClean = requestBody.buckets || [
      'receipts',
      'prescriptions',
      'contracts',
      'terms-signed',
      'quarantine'
    ];

    edgeLogger.info('Starting storage cleanup', { buckets: bucketsToClean });

    const results: Record<string, BucketResult> = {};
    let totalFilesDeleted = 0;

    // Process each bucket
    for (const bucketName of bucketsToClean) {
      const bucketResult: BucketResult = {
        files_found: 0,
        files_deleted: 0,
        errors: []
      };

      try {
        edgeLogger.info('Processing bucket', { bucketName });
        
        // Recursively list all files in bucket (including nested folders)
        const allFilePaths = await listAllFiles(supabaseAdmin, bucketName);
        
        bucketResult.files_found = allFilePaths.length;
        
        if (allFilePaths.length === 0) {
          edgeLogger.info('Bucket is empty', { bucketName });
          results[bucketName] = bucketResult;
          continue;
        }

        edgeLogger.info('Found files in bucket', { bucketName, count: allFilePaths.length });

        // Delete files in batches of 100
        const batchSize = 100;
        for (let i = 0; i < allFilePaths.length; i += batchSize) {
          const batch = allFilePaths.slice(i, i + batchSize);

          const { data: deleteData, error: deleteError } = await supabaseAdmin
            .storage
            .from(bucketName)
            .remove(batch);

          if (deleteError) {
            bucketResult.errors.push(`Batch delete error: ${deleteError.message}`);
            edgeLogger.error('Error deleting batch', deleteError, { bucketName });
          } else {
            const deletedCount = deleteData?.length || batch.length;
            bucketResult.files_deleted += deletedCount;
            totalFilesDeleted += deletedCount;
            edgeLogger.info('Deleted files from bucket', { bucketName, count: deletedCount, batchNum: Math.floor(i / batchSize) + 1 });
          }
        }

      } catch (bucketError: any) {
        bucketResult.errors.push(`Bucket error: ${bucketError.message}`);
        edgeLogger.error('Error processing bucket', bucketError, { bucketName });
      }

      results[bucketName] = bucketResult;
    }

    const executionTimeSeconds = (Date.now() - startTime) / 1000;

    edgeLogger.info('Storage cleanup complete', { totalDeleted: totalFilesDeleted, timeSeconds: executionTimeSeconds });

    // Prepare response
    const responseData = {
      success: true,
      cleared_buckets: results,
      total_files_deleted: totalFilesDeleted,
      execution_time_seconds: executionTimeSeconds,
    };

    // Log to audit_logs (non-blocking)
    try {
      await supabaseAdmin.from("audit_logs").insert({
        action_type: "clear_storage_files",
        entity_type: "storage",
        entity_id: null,
        user_id: user.id,
        user_email: user.email,
        user_role: "admin",
        details: {
          buckets: bucketsToClean,
          results: results,
          total_files_deleted: totalFilesDeleted,
          execution_time_seconds: executionTimeSeconds,
        },
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
        user_agent: req.headers.get("user-agent"),
      });
    } catch (auditError) {
      edgeLogger.error('Failed to log audit entry (non-fatal)', auditError);
    }

    return new Response(
      JSON.stringify(responseData),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    edgeLogger.error('Storage clear error', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to clear storage files',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
