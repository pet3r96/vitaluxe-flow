#!/usr/bin/env node

/**
 * Admin Login Verification Script
 * 
 * This script verifies that the admin login fix has been applied correctly
 * and tests the authentication flow for info@vitaluxeservices.com
 * 
 * Usage: node verify-admin-login.js
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration - update these with your actual Supabase credentials
const SUPABASE_URL = process.env.SUPABASE_URL || 'your-supabase-url';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key';

const ADMIN_EMAIL = 'info@vitaluxeservices.com';
const ADMIN_PASSWORD = 'AdminTemp1234!';
const EXPECTED_UUID = '28807c7e-5296-4860-b3a1-93c883dff39d';

async function verifyAdminLogin() {
    console.log('🔍 Verifying Admin Login Fix...\n');
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    try {
        // Test 1: Attempt login
        console.log('📋 Test 1: Attempting login...');
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });
        
        if (authError) {
            console.log('❌ Login failed:', authError.message);
            return false;
        }
        
        if (!authData.user) {
            console.log('❌ No user returned from login');
            return false;
        }
        
        console.log('✅ Login successful!');
        console.log('   User ID:', authData.user.id);
        console.log('   Email:', authData.user.email);
        
        // Verify UUID matches expected
        if (authData.user.id !== EXPECTED_UUID) {
            console.log('⚠️  Warning: UUID does not match expected value');
            console.log('   Expected:', EXPECTED_UUID);
            console.log('   Actual:', authData.user.id);
        } else {
            console.log('✅ UUID matches expected value');
        }
        
        // Test 2: Check user role
        console.log('\n📋 Test 2: Checking user role...');
        const { data: roleData, error: roleError } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', authData.user.id)
            .eq('role', 'admin')
            .single();
        
        if (roleError) {
            console.log('❌ Role check failed:', roleError.message);
            return false;
        }
        
        if (!roleData) {
            console.log('❌ Admin role not found');
            return false;
        }
        
        console.log('✅ Admin role confirmed');
        
        // Test 3: Check profile status
        console.log('\n📋 Test 3: Checking profile status...');
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('active, name, email')
            .eq('id', authData.user.id)
            .single();
        
        if (profileError) {
            console.log('❌ Profile check failed:', profileError.message);
            return false;
        }
        
        if (!profileData) {
            console.log('❌ Profile not found');
            return false;
        }
        
        if (!profileData.active) {
            console.log('❌ Profile is not active');
            return false;
        }
        
        console.log('✅ Profile is active');
        console.log('   Name:', profileData.name);
        console.log('   Email:', profileData.email);
        
        // Test 4: Check password status
        console.log('\n📋 Test 4: Checking password status...');
        const { data: passwordStatusData, error: passwordStatusError } = await supabase
            .from('user_password_status')
            .select('must_change_password')
            .eq('user_id', authData.user.id)
            .single();
        
        if (passwordStatusError && passwordStatusError.code !== 'PGRST116') {
            // PGRST116 is "not found" which is what we want
            console.log('❌ Password status check failed:', passwordStatusError.message);
            return false;
        }
        
        if (passwordStatusData && passwordStatusData.must_change_password) {
            console.log('❌ Password change required - this should be cleared');
            return false;
        }
        
        console.log('✅ No password change requirements');
        
        // Test 5: Sign out
        console.log('\n📋 Test 5: Signing out...');
        const { error: signOutError } = await supabase.auth.signOut();
        
        if (signOutError) {
            console.log('⚠️  Sign out warning:', signOutError.message);
        } else {
            console.log('✅ Sign out successful');
        }
        
        console.log('\n🎉 ALL TESTS PASSED!');
        console.log('✅ Admin login is working correctly');
        console.log('✅ Credentials: info@vitaluxeservices.com / AdminTemp1234!');
        
        return true;
        
    } catch (error) {
        console.log('❌ Unexpected error:', error.message);
        return false;
    }
}

// Run verification if called directly
if (require.main === module) {
    verifyAdminLogin()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { verifyAdminLogin };
