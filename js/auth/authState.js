/**
 * authState.js
 * Centralized authentication state and session lifecycle manager.
 * Interacts with Supabase Auth and public.profiles.
 */

import { getSupabase } from './supabaseClient.js';

let cachedProfile = null;

/**
 * Sign in using email/username and password.
 * Prioritizes Cloudflare D1 Native Edge API (/api/auth/login) with Supabase fallback.
 * @param {string} identifier
 * @param {string} password
 * @returns {Promise<{success: boolean, user?: any, profile?: any, mustChangePassword?: boolean, error?: string}>}
 */
export async function signIn(identifier, password) {
    const cleanIdentifier = identifier.trim();

    // 1. Try Cloudflare D1 Native Edge API
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: cleanIdentifier, password, remember: true })
        });

        if (response.status !== 404) {
            const data = await response.json();
            if (response.ok && data.success) {
                if (data.token && typeof localStorage !== 'undefined') {
                    localStorage.setItem('veyra_session_token', data.token);
                }
                cachedProfile = data.profile;
                return {
                    success: true,
                    user: data.user,
                    profile: data.profile,
                    mustChangePassword: Boolean(data.mustChangePassword)
                };
            } else {
                return {
                    success: false,
                    error: data.error || 'Invalid email or password'
                };
            }
        }
    } catch (apiErr) {
        console.warn('[Veyra Auth] Cloudflare D1 API unreachable, falling back to Supabase client:', apiErr);
    }

    // 2. Supabase Fallback (if configured)
    const supabase = await getSupabase();
    if (!supabase) {
        return {
            success: false,
            error: 'Database connection unconfigured. Please configure Cloudflare D1 or Supabase credentials.'
        };
    }

    try {
        let emailToUse = cleanIdentifier.toLowerCase();

        // If identifier is a username (no '@'), resolve it via RPC or fallback
        if (!emailToUse.includes('@')) {
            try {
                const { data: rpcEmail } = await supabase.rpc('get_email_for_username', {
                    p_username: emailToUse
                });

                if (rpcEmail) {
                    emailToUse = rpcEmail.trim().toLowerCase();
                } else {
                    const { data: profileRow } = await supabase
                        .from('profiles')
                        .select('email')
                        .ilike('username', emailToUse)
                        .maybeSingle();

                    if (profileRow && profileRow.email) {
                        emailToUse = profileRow.email.trim().toLowerCase();
                    } else {
                        emailToUse = `${emailToUse}@veyra.app`;
                    }
                }
            } catch (resolveErr) {
                console.warn('[Veyra Auth] Username resolution error, using default email fallback:', resolveErr);
                emailToUse = `${emailToUse}@veyra.app`;
            }
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email: emailToUse,
            password: password
        });

        if (error) {
            return {
                success: false,
                error: 'Invalid email or password'
            };
        }

        const user = data.user;

        // Fetch User Profile from public.profiles
        const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileErr || !profile) {
            console.error('[Veyra Auth] Failed to load user profile:', profileErr);
            await supabase.auth.signOut();
            return {
                success: false,
                error: 'Account profile record not found. Please contact administrator.'
            };
        }

        if (profile.status === 'suspended') {
            await supabase.auth.signOut();
            return {
                success: false,
                error: 'Your account has been suspended. Please contact platform administrator.'
            };
        }

        cachedProfile = profile;

        return {
            success: true,
            user,
            profile,
            mustChangePassword: Boolean(profile.must_change_password)
        };
    } catch (err) {
        console.error('[Veyra Auth] Login exception:', err);
        return {
            success: false,
            error: 'Authentication failed. Please check your network and try again.'
        };
    }
}

/**
 * Sign out current session
 */
export async function signOut() {
    cachedProfile = null;
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('veyra_session_token') : null;
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('veyra_session_token');
    }

    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
    } catch (e) {}

    const supabase = await getSupabase();
    if (supabase) {
        try {
            await supabase.auth.signOut();
        } catch (e) {
            console.error('[Veyra Auth] Supabase Sign out error:', e);
        }
    }
}

/**
 * Get current authenticated user session & profile
 * @returns {Promise<{user: any|null, profile: any|null}>}
 */
export async function getCurrentUserAndProfile() {
    // 1. Try Cloudflare D1 Native Edge API
    try {
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('veyra_session_token') : null;
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch('/api/auth/me', { headers });
        if (res.status !== 404) {
            const data = await res.json();
            if (data && data.user && data.profile) {
                cachedProfile = data.profile;
                return { user: data.user, profile: data.profile };
            }
            if (res.status === 200 && data.user === null) {
                cachedProfile = null;
                return { user: null, profile: null };
            }
        }
    } catch (e) {
        // Ignore and fallback to Supabase
    }

    // 2. Supabase Fallback
    const supabase = await getSupabase();
    if (!supabase) {
        return { user: null, profile: null };
    }

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !session.user) {
            cachedProfile = null;
            return { user: null, profile: null };
        }

        const user = session.user;

        if (cachedProfile && cachedProfile.id === user.id) {
            return { user, profile: cachedProfile };
        }

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error || !profile) {
            return { user, profile: null };
        }

        cachedProfile = profile;
        return { user, profile };
    } catch (err) {
        console.error('[Veyra Auth] Error getting current user:', err);
        return { user: null, profile: null };
    }
}

/**
 * Update password (used for forced password resets and settings)
 * @param {string} newPassword
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updatePassword(newPassword) {
    // 1. Try Cloudflare D1 API
    try {
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('veyra_session_token') : null;
        const res = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ newPassword })
        });
        if (res.status !== 404) {
            const data = await res.json();
            if (res.ok && data.success) {
                if (cachedProfile) cachedProfile.must_change_password = 0;
                return { success: true };
            }
            return { success: false, error: data.error || 'Failed to update password' };
        }
    } catch (e) {}

    // 2. Supabase Fallback
    const supabase = await getSupabase();
    if (!supabase) {
        return { success: false, error: 'Database unconfigured' };
    }

    try {
        const { data, error } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (error) {
            return { success: false, error: error.message };
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase
                .from('profiles')
                .update({ must_change_password: false, updated_at: new Date().toISOString() })
                .eq('id', user.id);

            if (cachedProfile) {
                cachedProfile.must_change_password = false;
            }
        }

        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Subscribe to Supabase auth state change events
 * @param {(event: string, session: any) => void} callback
 */
export async function onAuthStateChange(callback) {
    const supabase = await getSupabase();
    if (!supabase) return { unsubscribe: () => {} };
    const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
    return subscription;
}
