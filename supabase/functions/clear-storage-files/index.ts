import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Admin-only check
    if (user.email !== 'admin@vitaluxeservice.com') {
      throw new Error('Only admin@vitaluxeservice.com can clear storage files');
    }

    // Parse request body
    const requestBody = await req.json() as ClearStorageRequest;

    if (requestBody.confirm !== 'CLEAR ALL STORAGE') {
      throw new Error('Invalid confirmation text');
    }

    // Create admin client for storage operations
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

    // Default buckets to clear (excluding product-images)
    const bucketsToClean = requestBody.buckets || [
      'receipts',
      'prescriptions',
      'contracts',
      'terms-signed',
      'quarantine'
    ];

    console.log(`Starting storage cleanup for buckets: ${bucketsToClean.join(', ')}`);

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
        // List all files in bucket
        const { data: files, error: listError } = await supabaseAdmin
          .storage
          .from(bucketName)
          .list('', {
            limit: 1000,
            sortBy: { column: 'name', order: 'asc' }
          });

        if (listError) {
          bucketResult.errors.push(`List error: ${listError.message}`);
          results[bucketName] = bucketResult;
          continue;
        }

        if (!files || files.length === 0) {
          console.log(`Bucket ${bucketName} is empty`);
          results[bucketName] = bucketResult;
          continue;
        }

        bucketResult.files_found = files.length;
        console.log(`Found ${files.length} files in ${bucketName}`);

        // Delete files in batches of 100
        const batchSize = 100;
        for (let i = 0; i < files.length; i += batchSize) {
          const batch = files.slice(i, i + batchSize);
          const filePaths = batch.map(file => file.name);

          const { data: deleteData, error: deleteError } = await supabaseAdmin
            .storage
            .from(bucketName)
            .remove(filePaths);

          if (deleteError) {
            bucketResult.errors.push(`Batch delete error: ${deleteError.message}`);
            console.error(`Error deleting batch in ${bucketName}:`, deleteError);
          } else {
            const deletedCount = deleteData?.length || filePaths.length;
            bucketResult.files_deleted += deletedCount;
            totalFilesDeleted += deletedCount;
            console.log(`Deleted ${deletedCount} files from ${bucketName} (batch ${i / batchSize + 1})`);
          }
        }

      } catch (bucketError: any) {
        bucketResult.errors.push(`Bucket error: ${bucketError.message}`);
        console.error(`Error processing bucket ${bucketName}:`, bucketError);
      }

      results[bucketName] = bucketResult;
    }

    const executionTimeSeconds = (Date.now() - startTime) / 1000;

    console.log(`Storage cleanup complete. Total files deleted: ${totalFilesDeleted} in ${executionTimeSeconds}s`);

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
      console.error("Failed to log audit entry (non-fatal):", auditError);
    }

    return new Response(
      JSON.stringify(responseData),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error: any) {
    console.error('Storage clear error:', error);
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
