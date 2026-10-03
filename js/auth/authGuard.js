/**
 * authGuard.js
 * Universal Route and Application Entitlement Guard.
 * Enforces session validity, must_change_password, account status, roles, and plan expiry.
 * 
 * IMPORTANT: When user is unauthenticated on a protected page (e.g. Journal),
 * we render an in-page lock screen — not a hard redirect — for better UX.
 * The main-page handles the lock overlay there before the user ever navigates.
 */

import { getCurrentUserAndProfile, signOut } from './authState.js';
import { getSupabase } from './supabaseClient.js';

/**
 * Universal Page Guard
 * Call at top of protected pages (e.g. Journal, Admin)
 * 
 * @param {Object} options
 * @param {'user'|'admin'} [options.requiredRole='user']
 * @param {string} [options.appKey] Key from apps table (e.g. 'trading_journal')
 * @returns {Promise<{user: any, profile: any}|null>}
 */
export async function requirePageAuth(options = {}) {
    const requiredRole = options.requiredRole || 'user';
    const appKey = options.appKey || null;

    const { user, profile } = await getCurrentUserAndProfile();

    // 1. Unauthenticated → Friendly in-page lock screen (NOT a hard redirect)
    if (!user || !profile) {
        renderLoginRequiredScreen();
        return null;
    }

    // 2. Account Status: Suspended → Block access with clear UI
    if (profile.status === 'suspended') {
        renderSuspendedScreen();
        return null;
    }

    // 3. Forced Password Change → Redirect to Reset Password page
    if (profile.must_change_password) {
        if (!window.location.pathname.includes('reset-password.html')) {
            window.location.replace(`../auth/reset-password.html?must_change=true&redirect=${encodeURIComponent(window.location.href)}`);
            return null;
        }
    }

    // 4. Role Requirement: Admin Check
    if (requiredRole === 'admin' && profile.role !== 'admin') {
        renderForbiddenScreen();
        return null;
    }

    // 5. Subscription Plan Expiration Check
    if (profile.plan_expires_at) {
        const expiry = new Date(profile.plan_expires_at).getTime();
        if (Date.now() > expiry) {
            renderPlanExpiredScreen();
            return null;
        }
    }

    // 6. Sub-App Entitlement Check via D1 API
    if (appKey) {
        const hasEntitlement = await checkAppEntitlement(user.id, profile.plan_id, appKey, profile.role);
        if (!hasEntitlement) {
            renderEntitlementDeniedScreen(appKey);
            return null;
        }
    }

    return { user, profile };
}

/**
 * Checks if a user has access to a specific sub-app.
 * Admin always has full access.
 */
export async function checkAppEntitlement(userId, planId, appKey, role) {
    // Admins always have full access
    if (role === 'admin') return true;

    // Check cached or fetched profile app_overrides directly
    try {
        const { profile } = await getCurrentUserAndProfile();
        if (profile && profile.app_overrides && profile.app_overrides[appKey] !== undefined) {
            return Boolean(profile.app_overrides[appKey]);
        }
    } catch (_) {}

    // Public apps like calculator default to accessible unless explicitly revoked
    if (appKey === 'lot_size_calculator') return true;

    // Pro plan defaults to full access
    if (planId === 'pro') return true;

    return false;
}

// ──────────────────────────────────────────
// In-page Screen Renderers
// ──────────────────────────────────────────

function renderLoginRequiredScreen() {
    const returnUrl = encodeURIComponent(window.location.href);
    document.body.innerHTML = `
        <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg-page,#FAFAFA);color:var(--text-primary,#111);font-family:Inter,-apple-system,sans-serif;padding:20px;text-align:center;">
            <div style="max-width:420px;background:var(--bg-panel,#fff);border:1px solid var(--border-default,#E8E8EA);border-radius:16px;padding:40px 32px;box-shadow:0 8px 32px rgba(0,0,0,0.06);">
                <div style="width:56px;height:56px;border-radius:16px;background:rgba(47,91,255,0.08);color:var(--color-brand,#2F5BFF);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </div>
                <h2 style="font-size:20px;font-weight:700;margin-bottom:10px;color:var(--text-primary,#111);">Sign In Required</h2>
                <p style="font-size:13.5px;color:var(--text-secondary,#6B6B73);line-height:1.55;margin-bottom:28px;">This application is exclusively available to members. Please sign in to access Trading Journal.</p>
                <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                    <a href="../auth/login.html?redirect=${returnUrl}" style="display:inline-flex;align-items:center;padding:10px 22px;background:var(--color-brand,#2F5BFF);color:#fff;border-radius:8px;font-size:13.5px;font-weight:600;text-decoration:none;">Sign In</a>
                    <a href="../main-page/index.html" style="display:inline-flex;align-items:center;padding:10px 20px;background:var(--fill-subtle,#F4F4F5);color:var(--text-primary,#111);border:1px solid var(--border-default,#E8E8EA);border-radius:8px;font-size:13.5px;font-weight:500;text-decoration:none;">← Back to Apps</a>
                </div>
            </div>
        </div>
    `;
}

function renderSuspendedScreen() {
    document.body.innerHTML = `
        <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg-page,#0B0B0C);color:var(--text-primary,#EDEDEF);font-family:Inter,-apple-system,sans-serif;padding:20px;text-align:center;">
            <div style="max-width:440px;background:var(--bg-panel,#141416);border:1px solid var(--border-default,#26262A);border-radius:16px;padding:40px 32px;">
                <div style="width:52px;height:52px;border-radius:14px;background:rgba(239,68,68,0.12);color:#EF4444;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                </div>
                <h2 style="font-size:18px;font-weight:700;margin-bottom:8px;">Account Suspended</h2>
                <p style="font-size:13px;color:#9A9AA2;line-height:1.5;margin-bottom:28px;">Your account access has been suspended. Please contact your administrator to resolve this.</p>
                <button onclick="localStorage.removeItem('veyra_session_token');window.location.href='../auth/login.html'" style="padding:10px 20px;background:#26262A;color:#EDEDEF;border:1px solid #36363B;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">Sign Out</button>
            </div>
        </div>
    `;
}

function renderForbiddenScreen() {
    document.body.innerHTML = `
        <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg-page,#0B0B0C);color:var(--text-primary,#EDEDEF);font-family:Inter,-apple-system,sans-serif;padding:20px;text-align:center;">
            <div style="max-width:440px;background:var(--bg-panel,#141416);border:1px solid var(--border-default,#26262A);border-radius:16px;padding:40px 32px;">
                <div style="width:52px;height:52px;border-radius:14px;background:rgba(245,158,11,0.12);color:#F59E0B;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </div>
                <h2 style="font-size:18px;font-weight:700;margin-bottom:8px;">Administrator Access Required</h2>
                <p style="font-size:13px;color:#9A9AA2;line-height:1.5;margin-bottom:28px;">You do not have administrator privileges to view this page.</p>
                <a href="../main-page/index.html" style="display:inline-block;padding:10px 20px;background:#4F75FF;color:#FFFFFF;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">Return to Applications</a>
            </div>
        </div>
    `;
}

function renderPlanExpiredScreen() {
    document.body.innerHTML = `
        <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg-page,#0B0B0C);color:var(--text-primary,#EDEDEF);font-family:Inter,-apple-system,sans-serif;padding:20px;text-align:center;">
            <div style="max-width:440px;background:var(--bg-panel,#141416);border:1px solid var(--border-default,#26262A);border-radius:16px;padding:40px 32px;">
                <h2 style="font-size:18px;font-weight:700;margin-bottom:8px;">Plan Expired</h2>
                <p style="font-size:13px;color:#9A9AA2;line-height:1.5;margin-bottom:28px;">Your subscription period has expired. Contact an administrator to extend your access.</p>
                <a href="../main-page/index.html" style="display:inline-block;padding:10px 20px;background:#26262A;color:#EDEDEF;border:1px solid #36363B;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">Return to Home</a>
            </div>
        </div>
    `;
}

function renderEntitlementDeniedScreen(appKey) {
    document.body.innerHTML = `
        <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg-page,#0B0B0C);color:var(--text-primary,#EDEDEF);font-family:Inter,-apple-system,sans-serif;padding:20px;text-align:center;">
            <div style="max-width:440px;background:var(--bg-panel,#141416);border:1px solid var(--border-default,#26262A);border-radius:16px;padding:40px 32px;">
                <div style="width:52px;height:52px;border-radius:14px;background:rgba(239,68,68,0.1);color:#EF4444;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </div>
                <h2 style="font-size:18px;font-weight:700;margin-bottom:8px;">Access Restricted</h2>
                <p style="font-size:13px;color:#9A9AA2;line-height:1.5;margin-bottom:28px;">This application is not included in your current plan. Contact your administrator to request access.</p>
                <a href="../main-page/index.html" style="display:inline-block;padding:10px 20px;background:#4F75FF;color:#FFFFFF;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">Back to Apps</a>
            </div>
        </div>
    `;
}
