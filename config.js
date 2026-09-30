/**
 * config.js
 * Optional client-side configuration for Veyra.
 * 
 * NOTE: SUPABASE_URL and SUPABASE_ANON_KEY are public credentials safe for frontend use.
 * Supabase Row Level Security (RLS) protects all database tables and storage.
 * 
 * You can fill these in for automatic connection on Cloudflare Pages and local environments,
 * or enter them via the login screen browser setup prompt (persisted in localStorage).
 */
window.VEYRA_CONFIG = window.VEYRA_CONFIG || {
    SUPABASE_URL: '',      // e.g. "https://xyzcompany.supabase.co"
    SUPABASE_ANON_KEY: ''  // e.g. "eyJhbGciOi..."
};
