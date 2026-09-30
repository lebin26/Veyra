/**
 * supabaseConfig.js
 * Client-side configuration provider for Supabase credentials.
 * 
 * Supports:
 * 1. Global window.VEYRA_CONFIG (set via local config.js or inline script)
 * 2. localStorage override for easy local development testing
 */

export function getSupabaseConfig() {
    let url = '';
    let anonKey = '';

    // 1. Check window.VEYRA_CONFIG
    if (typeof window !== 'undefined' && window.VEYRA_CONFIG) {
        url = window.VEYRA_CONFIG.SUPABASE_URL || '';
        anonKey = window.VEYRA_CONFIG.SUPABASE_ANON_KEY || '';
    }

    // 2. Check localStorage override (convenient for local debugging)
    if (typeof localStorage !== 'undefined') {
        const localUrl = localStorage.getItem('veyra_supabase_url');
        const localKey = localStorage.getItem('veyra_supabase_anon_key');
        if (localUrl && localKey) {
            url = localUrl;
            anonKey = localKey;
        }
    }

    return {
        url: url.trim(),
        anonKey: anonKey.trim(),
        isConfigured: Boolean(url && anonKey && !url.includes('YOUR_PROJECT_ID'))
    };
}

export function setSupabaseConfig(url, anonKey) {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('veyra_supabase_url', url.trim());
        localStorage.setItem('veyra_supabase_anon_key', anonKey.trim());
    }
}
