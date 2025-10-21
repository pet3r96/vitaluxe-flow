-- ============================================================================
-- DIAGNOSTIC MIGRATION: Check Admin Login Issues
-- This migration will help diagnose and fix login issues for info@vitaluxeservices.com
-- ============================================================================

DO $$
DECLARE
    admin_user_id uuid := '28807c7e-5296-4860-b3a1-93c883dff39d';
    admin_email text := 'info@vitaluxeservices.com';
    duplicate_count integer;
    auth_user_count integer;
    profile_count integer;
    role_count integer;
    password_status_count integer;
    profile_active boolean;
    must_change_password boolean;
BEGIN
    RAISE NOTICE '=== DIAGNOSTIC: Admin Login Issues ===';
    RAISE NOTICE 'Target UUID: %', admin_user_id;
    RAISE NOTICE 'Target Email: %', admin_email;
    
    -- Check for duplicates in auth.users with similar emails
    SELECT COUNT(*) INTO duplicate_count
    FROM auth.users 
    WHERE email ILIKE '%vitaluxe%';
    
    RAISE NOTICE 'Total auth.users with vitaluxe emails: %', duplicate_count;
    
    -- Check if target user exists in auth.users
    SELECT COUNT(*) INTO auth_user_count
    FROM auth.users 
    WHERE id = admin_user_id;
    
    RAISE NOTICE 'Target user exists in auth.users: %', (auth_user_count > 0);
    
    -- Check profiles table
    SELECT COUNT(*) INTO profile_count
    FROM public.profiles 
    WHERE id = admin_user_id;
    
    RAISE NOTICE 'Target user exists in profiles: %', (profile_count > 0);
    
    -- Check user_roles
    SELECT COUNT(*) INTO role_count
    FROM public.user_roles 
    WHERE user_id = admin_user_id AND role = 'admin';
    
    RAISE NOTICE 'Admin role assigned: %', (role_count > 0);
    
    -- Check profile active status
    SELECT active INTO profile_active
    FROM public.profiles 
    WHERE id = admin_user_id;
    
    RAISE NOTICE 'Profile active status: %', COALESCE(profile_active::text, 'NULL');
    
    -- Check password status
    SELECT COUNT(*) INTO password_status_count
    FROM public.user_password_status 
    WHERE user_id = admin_user_id;
    
    RAISE NOTICE 'Password status entries: %', password_status_count;
    
    IF password_status_count > 0 THEN
        SELECT must_change_password INTO must_change_password
        FROM public.user_password_status 
        WHERE user_id = admin_user_id;
        
        RAISE NOTICE 'Must change password flag: %', COALESCE(must_change_password::text, 'NULL');
    END IF;
    
    -- Show all vitaluxe-related users for debugging
    RAISE NOTICE '=== All vitaluxe-related users ===';
    FOR rec IN 
        SELECT id, email, email_confirmed_at, created_at 
        FROM auth.users 
        WHERE email ILIKE '%vitaluxe%'
        ORDER BY created_at
    LOOP
        RAISE NOTICE 'Auth User: % | % | confirmed: % | created: %', 
            rec.id, rec.email, rec.email_confirmed_at, rec.created_at;
    END LOOP;
    
    RAISE NOTICE '=== DIAGNOSTIC COMPLETE ===';
    
END $$;
