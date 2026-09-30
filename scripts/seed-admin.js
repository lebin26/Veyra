/**
 * seed-admin.js
 * One-time setup script to initialize the first Administrator account.
 * 
 * Usage:
 *   node scripts/seed-admin.js admin@veyra.io TempPassword123!
 * 
 * Requirements:
 *   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env or as environment variables.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const email = process.argv[2] || process.env.INITIAL_ADMIN_EMAIL || 'lebin26@veyra.app';
const password = process.argv[3] || process.env.INITIAL_ADMIN_PASSWORD || '12141214@Aa';
const username = process.argv[4] || process.env.INITIAL_ADMIN_USERNAME || 'lebin26';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
    console.error('Please configure your .env file or run the SQL migration in supabase/migrations/0002_seed_initial_admin.sql directly.');
    process.exit(1);
}

if (!email || !password) {
    console.error('Usage: node scripts/seed-admin.js <admin_email> <admin_password>');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
    console.log(`[Veyra Setup] Bootstrapping Administrator account: ${email}`);

    // Create user via Admin API
    const { data, error } = await supabase.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: password,
        email_confirm: true,
        user_metadata: {
            username: username,
            display_name: username,
            must_change_password: false
        }
    });

    if (error) {
        if (error.message.includes('already been registered')) {
            console.log(`[Veyra Setup] User already exists in auth. Promoting to Admin in public.profiles...`);
            const { data: promoteRes, error: promoteErr } = await supabase.rpc('promote_user_to_admin', {
                target_email: email.trim().toLowerCase()
            });
            if (promoteErr) {
                console.error('[Veyra Setup] Failed to promote user:', promoteErr);
            } else {
                console.log(`[Veyra Setup] Result:`, promoteRes);
            }
            return;
        }
        console.error('[Veyra Setup] Failed to create admin:', error.message);
        process.exit(1);
    }

    const userId = data.user.id;
    console.log(`[Veyra Setup] Created auth user with ID: ${userId}`);

    // Ensure role is admin in public.profiles
    const { error: profileErr } = await supabase
        .from('profiles')
        .upsert({
            id: userId,
            email: email.trim().toLowerCase(),
            username: username,
            display_name: username,
            role: 'admin',
            status: 'active',
            plan_id: 'pro',
            must_change_password: false,
            updated_at: new Date().toISOString()
        });

    if (profileErr) {
        console.error('[Veyra Setup] Error setting admin profile:', profileErr.message);
        process.exit(1);
    }

    console.log(`[Veyra Setup] SUCCESS: Administrator account created and configured as Pro Admin.`);
}

main();
