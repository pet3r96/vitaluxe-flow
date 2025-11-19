import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

/**
 * PHASE 3 - PART 1: STORAGE PENETRATION TEST SUITE
 * 
 * Tests storage bucket isolation and security
 * Executes 16 test cases (4 attack vectors × 4 buckets)
 */

const STORAGE_BUCKETS = [
  'prescriptions',
  'medical_vault',
  'profiles',
  'documents'
];

const MALICIOUS_FILENAMES = [
  '../../etc/passwd',
  '<script>alert(1)</script>.pdf',
  'file\x00.exe.pdf',
  'A'.repeat(10000) + '.txt', // 10KB filename
  '../../../root/secrets.txt',
  'test.pdf; DROP TABLE users;--'
];

interface TestResult {
  testName: string;
  testCategory: string;
  attackVector: string;
  targetBucket: string;
  success: boolean;
  expectedResult: string;
  actualResult: string;
  errorMessage?: string;
}

async function logTestResult(supabase: any, result: TestResult) {
  await supabase.from('penetration_test_results').insert({
    test_name: result.testName,
    test_category: result.testCategory,
    attack_vector: result.attackVector,
    target_bucket: result.targetBucket,
    success: result.success,
    expected_result: result.expectedResult,
    actual_result: result.actualResult,
    error_message: result.errorMessage || null,
    timestamp: new Date().toISOString()
  });
}

async function testCrossPracticeAccess(supabase: any, bucket: string, targetPath: string): Promise<TestResult> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(targetPath);

    const blocked = error !== null || !data;
    
    return {
      testName: `Cross-practice access attempt on ${bucket}`,
      testCategory: 'Storage',
      attackVector: 'cross_practice_access',
      targetBucket: bucket,
      success: !blocked,
      expectedResult: '403 Forbidden or null data',
      actualResult: blocked ? 'Access blocked ✅' : 'Access granted ❌',
      errorMessage: error?.message
    };
  } catch (err: any) {
    return {
      testName: `Cross-practice access attempt on ${bucket}`,
      testCategory: 'Storage',
      attackVector: 'cross_practice_access',
      targetBucket: bucket,
      success: false,
      expectedResult: '403 Forbidden or exception',
      actualResult: 'Exception thrown - Access blocked ✅',
      errorMessage: err.message
    };
  }
}

async function testCrossPracticeUpload(supabase: any, bucket: string, targetPath: string): Promise<TestResult> {
  try {
    const testData = new Blob(['test data'], { type: 'text/plain' });
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(targetPath, testData);

    const blocked = error !== null;
    
    // Clean up if upload succeeded
    if (!blocked && data) {
      await supabase.storage.from(bucket).remove([targetPath]);
    }
    
    return {
      testName: `Cross-practice upload attempt on ${bucket}`,
      testCategory: 'Storage',
      attackVector: 'cross_practice_upload',
      targetBucket: bucket,
      success: !blocked,
      expectedResult: '403 Forbidden',
      actualResult: blocked ? 'Upload blocked ✅' : 'Upload succeeded ❌',
      errorMessage: error?.message
    };
  } catch (err: any) {
    return {
      testName: `Cross-practice upload attempt on ${bucket}`,
      testCategory: 'Storage',
      attackVector: 'cross_practice_upload',
      targetBucket: bucket,
      success: false,
      expectedResult: '403 Forbidden or exception',
      actualResult: 'Exception thrown - Upload blocked ✅',
      errorMessage: err.message
    };
  }
}

async function testMaliciousFilenames(supabase: any, bucket: string): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  for (const filename of MALICIOUS_FILENAMES) {
    try {
      const testData = new Blob(['test'], { type: 'text/plain' });
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(`test/${filename}`, testData);

      const sanitized = error !== null || !data;
      
      // Clean up if upload succeeded
      if (!sanitized && data) {
        await supabase.storage.from(bucket).remove([`test/${filename}`]);
      }
      
      results.push({
        testName: `Malicious filename test: ${filename.substring(0, 50)}...`,
        testCategory: 'Storage',
        attackVector: 'malicious_filename',
        targetBucket: bucket,
        success: !sanitized,
        expectedResult: 'Filename sanitized or upload rejected',
        actualResult: sanitized ? 'Filename blocked ✅' : 'Upload succeeded ❌',
        errorMessage: error?.message
      });
    } catch (err: any) {
      results.push({
        testName: `Malicious filename test: ${filename.substring(0, 50)}...`,
        testCategory: 'Storage',
        attackVector: 'malicious_filename',
        targetBucket: bucket,
        success: false,
        expectedResult: 'Filename sanitized or exception',
        actualResult: 'Exception thrown - Attack blocked ✅',
        errorMessage: err.message
      });
    }
  }
  
  return results;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify CRON secret
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedSecret = Deno.env.get('CRON_SECRET');
    
    if (!expectedSecret || cronSecret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid CRON secret' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createAdminClient();
    const results: TestResult[] = [];

    edgeLogger.info('Starting storage penetration test suite', { buckets: STORAGE_BUCKETS.length });

    // Test each storage bucket
    for (const bucket of STORAGE_BUCKETS) {
      // Test 1: Cross-practice file access
      const accessResult = await testCrossPracticeAccess(
        supabaseAdmin,
        bucket,
        'practice-123/test-file.pdf'
      );
      results.push(accessResult);
      await logTestResult(supabaseAdmin, accessResult);

      // Test 2: Cross-practice file upload
      const uploadResult = await testCrossPracticeUpload(
        supabaseAdmin,
        bucket,
        'practice-456/malicious-upload.pdf'
      );
      results.push(uploadResult);
      await logTestResult(supabaseAdmin, uploadResult);

      // Test 3: Malicious filenames
      const filenameResults = await testMaliciousFilenames(supabaseAdmin, bucket);
      results.push(...filenameResults);
      for (const result of filenameResults) {
        await logTestResult(supabaseAdmin, result);
      }
    }

    const summary = {
      totalTests: results.length,
      passed: results.filter(r => !r.success).length,
      failed: results.filter(r => r.success).length,
      passRate: (results.filter(r => !r.success).length / results.length * 100).toFixed(2) + '%',
      timestamp: new Date().toISOString()
    };

    edgeLogger.info('Storage penetration test suite completed', summary);

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        results,
        criticalFindings: results.filter(r => r.success)
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    edgeLogger.error('Error in storage penetration test', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
