-- ============================================================================
-- FIX MIGRATION: Resolve Admin Login Issues for info@vitaluxeservices.com
-- This migration will clean up duplicates and ensure proper admin account setup
-- ============================================================================

DO $$
DECLARE
    target_uuid uuid := '28807c7e-5296-4860-b3a1-93c883dff39d';
    target_email text := 'info@vitaluxeservices.com';
    temp_password text := 'AdminTemp1234!';
    duplicate_users uuid[];
    user_record RECORD;
    cleanup_count integer := 0;
BEGIN
    RAISE NOTICE '=== FIXING ADMIN LOGIN ISSUES ===';
    RAISE NOTICE 'Target UUID: %', target_uuid;
    RAISE NOTICE 'Target Email: %', target_email;
    
    -- Step 1: Find and collect all duplicate vitaluxe-related users (excluding our target)
    SELECT ARRAY_AGG(id) INTO duplicate_users
    FROM auth.users 
    WHERE email ILIKE '%vitaluxe%' 
    AND id != target_uuid;
    
    RAISE NOTICE 'Found % duplicate users to clean up', COALESCE(array_length(duplicate_users, 1), 0);
    
    -- Step 2: Clean up duplicate users if any exist
    IF duplicate_users IS NOT NULL THEN
        RAISE NOTICE 'Cleaning up duplicate users...';
        
        -- Delete from user_password_status first (foreign key constraint)
        DELETE FROM public.user_password_status 
        WHERE user_id = ANY(duplicate_users);
        
        -- Delete from user_roles
        DELETE FROM public.user_roles 
        WHERE user_id = ANY(duplicate_users);
        
        -- Delete from profiles
        DELETE FROM public.profiles 
        WHERE id = ANY(duplicate_users);
        
        -- Delete from auth.users
        DELETE FROM auth.users 
        WHERE id = ANY(duplicate_users);
        
        cleanup_count := array_length(duplicate_users, 1);
        RAISE NOTICE 'Cleaned up % duplicate users', cleanup_count;
    END IF;
    
    -- Step 3: Ensure target user exists in auth.users
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_uuid) THEN
        RAISE NOTICE 'Creating missing auth.users entry...';
        
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            aud,
            role,
            created_at,
            updated_at,
            confirmation_token,
            email_change_token_new,
            recovery_token,
            last_sign_in_at,
            phone,
            phone_confirmed_at,
            phone_change,
            phone_change_token,
            email_change_token_current,
            email_change_confirm_status,
            banned_until,
            reauthentication_token,
            reauthentication_sent_at,
            is_sso_user,
            deleted_at,
            is_anonymous
        ) VALUES (
            target_uuid,
            '00000000-0000-0000-0000-000000000000',
            target_email,
            crypt(temp_password, gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}',
            '{"name":"Admin User","email":"' || target_email || '"}',
            'authenticated',
            'authenticated',
            now(),
            now(),
            '',
            '',
            '',
            NULL,
            NULL,
            NULL,
            NULL,
            '',
            '',
            0,
            NULL,
            '',
            NULL,
            false,
            NULL,
            false
        );
        
        RAISE NOTICE 'Created auth.users entry for target user';
    ELSE
        -- Update existing user to ensure correct email and password
        RAISE NOTICE 'Updating existing auth.users entry...';
        
        UPDATE auth.users 
        SET 
            email = target_email,
            encrypted_password = crypt(temp_password, gen_salt('bf')),
            raw_user_meta_data = jsonb_set(
                COALESCE(raw_user_meta_data, '{}'::jsonb),
                '{email}',
                '"' || target_email || '"'
            ),
            updated_at = now()
        WHERE id = target_uuid;
        
        RAISE NOTICE 'Updated auth.users entry';
    END IF;
    
    -- Step 4: Ensure profile exists and is active
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_uuid) THEN
        RAISE NOTICE 'Creating missing profile...';
        
        INSERT INTO public.profiles (
            id,
            name,
            email,
            active,
            created_at,
            updated_at
        ) VALUES (
            target_uuid,
            'Admin User',
            target_email,
            true,
            now(),
            now()
        );
        
        RAISE NOTICE 'Created profile entry';
    ELSE
        -- Update existing profile to ensure it's active
        UPDATE public.profiles 
        SET 
            email = target_email,
            active = true,
            updated_at = now()
        WHERE id = target_uuid;
        
        RAISE NOTICE 'Updated profile entry';
    END IF;
    
    -- Step 5: Ensure admin role is assigned
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = target_uuid AND role = 'admin') THEN
        RAISE NOTICE 'Assigning admin role...';
        
        INSERT INTO public.user_roles (user_id, role)
        VALUES (target_uuid, 'admin');
        
        RAISE NOTICE 'Assigned admin role';
    ELSE
        RAISE NOTICE 'Admin role already assigned';
    END IF;
    
    -- Step 6: Clear any password change requirements
    DELETE FROM public.user_password_status 
    WHERE user_id = target_uuid;
    
    RAISE NOTICE 'Cleared password status flags';
    
    -- Step 7: Verify final state
    RAISE NOTICE '=== FINAL VERIFICATION ===';
    
    -- Check auth.users
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = target_uuid) THEN
        RAISE NOTICE '✓ Auth user exists';
    ELSE
        RAISE NOTICE '✗ Auth user missing';
    END IF;
    
    -- Check profile
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = target_uuid AND active = true) THEN
        RAISE NOTICE '✓ Active profile exists';
    ELSE
        RAISE NOTICE '✗ Active profile missing';
    END IF;
    
    -- Check role
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = target_uuid AND role = 'admin') THEN
        RAISE NOTICE '✓ Admin role assigned';
    ELSE
        RAISE NOTICE '✗ Admin role missing';
    END IF;
    
    -- Check password status (should be empty)
    IF NOT EXISTS (SELECT 1 FROM public.user_password_status WHERE user_id = target_uuid) THEN
        RAISE NOTICE '✓ No password change requirements';
    ELSE
        RAISE NOTICE '✗ Password change requirements still exist';
    END IF;
    
    RAISE NOTICE '=== ADMIN LOGIN FIX COMPLETE ===';
    RAISE NOTICE 'Login credentials: % / %', target_email, temp_password;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'ERROR in admin login fix: %', SQLERRM;
        RAISE;
END $$;
