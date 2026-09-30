/**
 * supabaseClient.js
 * Initializes and exports the singleton Supabase client.
 * Uses official @supabase/supabase-js via native ES Module import.
 */

import { getSupabaseConfig } from './supabaseConfig.js';

// CDN URL for official @supabase/supabase-js v2 (native browser ES module)
const SUPABASE_JS_ESM = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.48.1/+esm';

let supabaseInstance = null;
let initPromise = null;

/**
 * Initializes the Supabase client instance asynchronously
 * @returns {Promise<any>} Supabase client instance or null if unconfigured
 */
export async function getSupabase() {
    if (supabaseInstance) return supabaseInstance;
    if (initPromise) return initPromise;

    initPromise = (async () => {
        const config = getSupabaseConfig();

        if (!config.isConfigured) {
            console.warn('[Veyra Auth] Supabase URL and Anon Key are not yet configured. Please configure in localStorage or config.js.');
            return null;
        }

        try {
            // Dynamically import Supabase client library via ESM
            const { createClient } = await import(SUPABASE_JS_ESM);

            supabaseInstance = createClient(config.url, config.anonKey, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true,
                    storage: window.localStorage
                }
            });

            return supabaseInstance;
        } catch (err) {
            console.error('[Veyra Auth] Failed to load Supabase client:', err);
            return null;
        }
    })();

    return initPromise;
}
