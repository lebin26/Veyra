-- ==========================================================================
-- Migration: 0002_seed_initial_admin.sql
-- Administrative helper to promote or verify initial Admin
-- Seed Administrator Setup Template (Do NOT commit real passwords)
-- ==========================================================================

-- 1. Helper function to look up user email by username for sign-in
CREATE OR REPLACE FUNCTION public.get_email_for_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    found_email TEXT;
BEGIN
    SELECT email INTO found_email
    FROM public.profiles
    WHERE lower(username) = lower(trim(p_username))
    LIMIT 1;

    RETURN found_email;
END;
$$;

-- Grant execution to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_email_for_username(TEXT) TO anon, authenticated, service_role;


-- 2. Helper function to promote any invited user to Administrator by email
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(target_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_record RECORD;
BEGIN
    SELECT id, email, role INTO user_record 
    FROM public.profiles 
    WHERE lower(email) = lower(target_email);

    IF NOT FOUND THEN
        RETURN 'User with email ' || target_email || ' not found in profiles.';
    END IF;

    UPDATE public.profiles
    SET role = 'admin',
        plan_id = 'pro',
        status = 'active',
        updated_at = NOW()
    WHERE lower(email) = lower(target_email);

    -- Log promotion
    INSERT INTO public.audit_logs (actor_id, target_user_id, action, details)
    VALUES (user_record.id, user_record.id, 'admin_promoted_via_sql', jsonb_build_object('email', target_email));

    RETURN 'Success: ' || target_email || ' is now an active Administrator with Pro plan.';
END;
$$;


-- 3. Template Seed for Initial Administrator
-- Set target_password before executing locally in private SQL editor
DO $$
DECLARE
    admin_id UUID := gen_random_uuid();
    target_email TEXT := 'admin@veyra.app';
    target_username TEXT := 'admin';
    target_password TEXT := 'REPLACE_WITH_SECURE_PASSWORD';
    existing_user_id UUID;
BEGIN
    -- Check if user exists in auth.users by email or username
    SELECT id INTO existing_user_id 
    FROM auth.users 
    WHERE lower(email) = lower(target_email)
       OR lower(raw_user_meta_data->>'username') = lower(target_username);

    IF existing_user_id IS NULL THEN
        -- Insert new auth user
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            role,
            aud,
            confirmation_token
        ) VALUES (
            admin_id,
            '00000000-0000-0000-0000-000000000000',
            target_email,
            crypt(target_password, gen_salt('bf')),
            NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object('username', target_username, 'display_name', target_username, 'must_change_password', false),
            NOW(),
            NOW(),
            'authenticated',
            'authenticated',
            encode(gen_random_bytes(32), 'hex')
        );

        -- Insert identity for Supabase Auth
        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            provider_id,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            admin_id,
            jsonb_build_object('sub', admin_id::text, 'email', target_email),
            'email',
            admin_id::text,
            NOW(),
            NOW(),
            NOW()
        );

        existing_user_id := admin_id;
    ELSE
        -- Update password and ensure email confirmed
        UPDATE auth.users
        SET encrypted_password = crypt(target_password, gen_salt('bf')),
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            updated_at = NOW()
        WHERE id = existing_user_id;
    END IF;

    -- Upsert profile record as Admin with Pro plan
    INSERT INTO public.profiles (
        id,
        email,
        username,
        display_name,
        role,
        status,
        plan_id,
        must_change_password,
        updated_at
    ) VALUES (
        existing_user_id,
        target_email,
        target_username,
        target_username,
        'admin',
        'active',
        'pro',
        false,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        username = EXCLUDED.username,
        display_name = EXCLUDED.display_name,
        role = 'admin',
        status = 'active',
        plan_id = 'pro',
        must_change_password = false,
        updated_at = NOW();

END $$;

