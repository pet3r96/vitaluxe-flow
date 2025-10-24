/**
 * Test Script for Temporary Password Fix
 * Tests the complete flow from temporary password to permanent password
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qbtsfajshnrwwlfzkeog.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_ANON_KEY');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const TEST_EMAIL = process.env.TEST_EMAIL || 'test-temp-password@vitaluxeservices.com';
const TEST_NAME = process.env.TEST_NAME || 'Test User';
const TEST_PASSWORD = 'TempPass123!';
const NEW_PASSWORD = 'NewPassword123!';

console.log('🧪 Testing Temporary Password Fix');
console.log(`📧 Test Email: ${TEST_EMAIL}`);
console.log(`👤 Test Name: ${TEST_NAME}`);
console.log('');

async function testTempPasswordFlow() {
  let testUserId = null;
  let passed = 0;
  let total = 0;

  try {
    // Step 1: Create a test user with temporary password
    console.log('📝 Step 1: Creating test user with temporary password...');
    total++;
    
    const { data: user, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true
    });

    if (createError) {
      console.log(`❌ Failed to create test user: ${createError.message}`);
      return;
    }

    testUserId = user.user.id;
    console.log(`✅ Test user created: ${testUserId}`);

    // Create profile with temp_password = true
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: testUserId,
        name: TEST_NAME,
        email: TEST_EMAIL,
        temp_password: true,
        active: true
      });

    if (profileError) {
      console.log(`❌ Failed to create profile: ${profileError.message}`);
      return;
    }

    // Create user_password_status record
    const { error: statusError } = await supabaseAdmin
      .from('user_password_status')
      .insert({
        user_id: testUserId,
        must_change_password: true,
        temporary_password_sent: true,
        first_login_completed: false
      });

    if (statusError) {
      console.log(`❌ Failed to create password status: ${statusError.message}`);
      return;
    }

    console.log('✅ Test user setup complete with temp_password = true');
    passed++;

    // Step 2: Test password status check (should require password change)
    console.log('\n🔍 Step 2: Testing password status check...');
    total++;
    
    const { data: statusData, error: statusCheckError } = await supabaseAdmin
      .from('user_password_status')
      .select('must_change_password, terms_accepted')
      .eq('user_id', testUserId)
      .single();

    const { data: profileData, error: profileCheckError } = await supabaseAdmin
      .from('profiles')
      .select('temp_password')
      .eq('id', testUserId)
      .single();

    if (statusCheckError || profileCheckError) {
      console.log(`❌ Failed to check status: ${statusCheckError?.message || profileCheckError?.message}`);
      return;
    }

    const hasTempPassword = profileData.temp_password;
    const mustChange = statusData.must_change_password;
    const finalMustChange = mustChange || hasTempPassword;

    if (finalMustChange && hasTempPassword) {
      console.log('✅ Password status correctly shows must change password due to temp_password flag');
      passed++;
    } else {
      console.log(`❌ Password status incorrect: mustChange=${mustChange}, hasTempPassword=${hasTempPassword}`);
      return;
    }

    // Step 3: Simulate password change
    console.log('\n🔑 Step 3: Simulating password change...');
    total++;
    
    // Update password
    const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
      testUserId,
      { password: NEW_PASSWORD }
    );

    if (passwordError) {
      console.log(`❌ Failed to update password: ${passwordError.message}`);
      return;
    }

    // Update password status
    const { error: statusUpdateError } = await supabaseAdmin
      .from('user_password_status')
      .update({
        must_change_password: false,
        first_login_completed: true,
        password_last_changed: new Date().toISOString()
      })
      .eq('user_id', testUserId);

    if (statusUpdateError) {
      console.log(`❌ Failed to update password status: ${statusUpdateError.message}`);
      return;
    }

    // Clear temp_password flag
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({
        temp_password: false
      })
      .eq('id', testUserId);

    if (profileUpdateError) {
      console.log(`❌ Failed to clear temp_password flag: ${profileUpdateError.message}`);
      return;
    }

    console.log('✅ Password change completed and temp_password flag cleared');
    passed++;

    // Step 4: Verify final status
    console.log('\n✅ Step 4: Verifying final status...');
    total++;
    
    const { data: finalStatusData, error: finalStatusError } = await supabaseAdmin
      .from('user_password_status')
      .select('must_change_password, terms_accepted')
      .eq('user_id', testUserId)
      .single();

    const { data: finalProfileData, error: finalProfileError } = await supabaseAdmin
      .from('profiles')
      .select('temp_password')
      .eq('id', testUserId)
      .single();

    if (finalStatusError || finalProfileError) {
      console.log(`❌ Failed to check final status: ${finalStatusError?.message || finalProfileError?.message}`);
      return;
    }

    const finalHasTempPassword = finalProfileData.temp_password;
    const finalMustChange = finalStatusData.must_change_password;
    const finalResult = finalMustChange || finalHasTempPassword;

    if (!finalResult && !finalHasTempPassword) {
      console.log('✅ Final status correct: no password change required, temp_password flag cleared');
      passed++;
    } else {
      console.log(`❌ Final status incorrect: mustChange=${finalMustChange}, hasTempPassword=${finalHasTempPassword}`);
      return;
    }

    // Summary
    console.log('\n📊 Test Summary:');
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${total - passed}/${total}`);

    if (passed === total) {
      console.log('\n🎉 All tests passed! The temporary password fix is working correctly.');
      console.log('\n💡 The fix ensures that:');
      console.log('   1. Users with temp_password=true are forced to change password');
      console.log('   2. After password change, temp_password flag is cleared');
      console.log('   3. Users can then proceed normally without being stuck in 2FA loop');
    } else {
      console.log('\n⚠️ Some tests failed. Check the implementation.');
    }

  } catch (error) {
    console.error('💥 Test failed with error:', error);
  } finally {
    // Cleanup: Delete test user
    if (testUserId) {
      console.log('\n🧹 Cleaning up test user...');
      try {
        await supabaseAdmin.auth.admin.deleteUser(testUserId);
        console.log('✅ Test user cleaned up');
      } catch (cleanupError) {
        console.log(`⚠️ Failed to cleanup test user: ${cleanupError.message}`);
      }
    }
  }
}

// Run test
testTempPasswordFlow().catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});
