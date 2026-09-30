/**
 * authGuard.js
 * Universal Route and Application Entitlement Guard.
 * Enforces session validity, must_change_password, account status, roles, and plan expiry.
 */

import { getCurrentUserAndProfile, signOut } from './authState.js';
import { getSupabase } from './supabaseClient.js';

/**
 * Universal Page Guard
 * Call at top of protected pages (e.g. Journal, Admin, Calculator if members_only)
 * 
 * @param {Object} options
 * @param {'user'|'admin'} [options.requiredRole='user']
 * @param {string} [options.appKey] Key from apps table (e.g. 'trading_journal', 'lot_size_calculator')
 * @returns {Promise<{user: any, profile: any}|null>} Returns authenticated context or redirects
 */
export async function requirePageAuth(options = {}) {
    const requiredRole = options.requiredRole || 'user';
    const appKey = options.appKey || null;

    const { user, profile } = await getCurrentUserAndProfile();

    // 1. Unauthenticated -> Redirect to Login with return URL
    if (!user || !profile) {
        const currentPath = window.location.href;
        window.location.replace(`../auth/login.html?redirect=${encodeURIComponent(currentPath)}`);
        return null;
    }

    // 2. Account Status: Suspended -> Block access with clear UI
    if (profile.status === 'suspended') {
        renderSuspendedScreen();
        return null;
    }

    // 3. Forced Password Change -> Redirect to Reset Password page
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

    // 6. Sub-App Entitlement Check
    if (appKey) {
        const hasEntitlement = await checkAppEntitlement(user.id, profile.plan_id, appKey);
        if (!hasEntitlement) {
            renderEntitlementDeniedScreen(appKey);
            return null;
        }
    }

    return { user, profile };
}

/**
 * Checks if a user has access to a specific sub-app based on Plan or Admin Overrides
 * @param {string} userId
 * @param {string} planId
 * @param {string} appKey
 * @returns {Promise<boolean>}
 */
export async function checkAppEntitlement(userId, planId, appKey) {
    const supabase = await getSupabase();
    if (!supabase) return true; // Default permissive in unconfigured state

    try {
        // First check app access_level in apps table
        const { data: appData } = await supabase
            .from('apps')
            .select('access_level, is_active')
            .eq('key', appKey)
            .single();

        if (appData && !appData.is_active) {
            return false;
        }

        if (appData && appData.access_level === 'public') {
            return true;
        }

        // Check user_app_overrides first (highest precedence)
        const { data: override } = await supabase
            .from('user_app_overrides')
            .select('is_enabled')
            .eq('user_id', userId)
            .eq('app_key', appKey)
            .single();

        if (override && override.is_enabled !== null) {
            return Boolean(override.is_enabled);
        }

        // Otherwise check plan default entitlements
        const { data: planEntitlement } = await supabase
            .from('plan_app_entitlements')
            .select('is_enabled')
            .eq('plan_id', planId)
            .eq('app_key', appKey)
            .single();

        if (planEntitlement) {
            return Boolean(planEntitlement.is_enabled);
        }

        return false;
    } catch (e) {
        console.error('[Veyra Guard] Error checking entitlement:', e);
        return false;
    }
}

function renderSuspendedScreen() {
    document.body.innerHTML = `
        <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0B0B0C; color: #EDEDEF; font-family: Inter, -apple-system, sans-serif; padding: 20px; text-align: center;">
            <div style="max-width: 440px; background: #141416; border: 1px solid #26262A; border-radius: 12px; padding: 36px 28px;">
                <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(239, 68, 68, 0.12); color: #EF4444; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                </div>
                <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">Account Suspended</h2>
                <p style="font-size: 13px; color: #9A9AA2; line-height: 1.5; margin-bottom: 24px;">Your account access has been suspended by the administrator. Please reach out to your team or sponsor to reactivate.</p>
                <button onclick="localStorage.clear(); window.location.href='../auth/login.html'" style="padding: 10px 20px; background: #26262A; color: #EDEDEF; border: 1px solid #36363B; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;">Sign Out</button>
            </div>
        </div>
    `;
}

function renderForbiddenScreen() {
    document.body.innerHTML = `
        <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0B0B0C; color: #EDEDEF; font-family: Inter, -apple-system, sans-serif; padding: 20px; text-align: center;">
            <div style="max-width: 440px; background: #141416; border: 1px solid #26262A; border-radius: 12px; padding: 36px 28px;">
                <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(245, 158, 11, 0.12); color: #F59E0B; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </div>
                <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">403 Forbidden</h2>
                <p style="font-size: 13px; color: #9A9AA2; line-height: 1.5; margin-bottom: 24px;">You do not possess the required administrator privileges to access this area.</p>
                <a href="../main-page/index.html" style="display: inline-block; padding: 10px 20px; background: #4F75FF; color: #FFFFFF; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none;">Return to Applications</a>
            </div>
        </div>
    `;
}

function renderPlanExpiredScreen() {
    document.body.innerHTML = `
        <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0B0B0C; color: #EDEDEF; font-family: Inter, -apple-system, sans-serif; padding: 20px; text-align: center;">
            <div style="max-width: 440px; background: #141416; border: 1px solid #26262A; border-radius: 12px; padding: 36px 28px;">
                <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">Plan Expired</h2>
                <p style="font-size: 13px; color: #9A9AA2; line-height: 1.5; margin-bottom: 24px;">Your subscription access period has expired. Please contact an administrator to extend your plan.</p>
                <a href="../main-page/index.html" style="display: inline-block; padding: 10px 20px; background: #26262A; color: #EDEDEF; border: 1px solid #36363B; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none;">Return to Home</a>
            </div>
        </div>
    `;
}

function renderEntitlementDeniedScreen(appKey) {
    document.body.innerHTML = `
        <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0B0B0C; color: #EDEDEF; font-family: Inter, -apple-system, sans-serif; padding: 20px; text-align: center;">
            <div style="max-width: 440px; background: #141416; border: 1px solid #26262A; border-radius: 12px; padding: 36px 28px;">
                <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">Access Restricted</h2>
                <p style="font-size: 13px; color: #9A9AA2; line-height: 1.5; margin-bottom: 24px;">This application is not included in your active plan entitlement. Contact your administrator to request access.</p>
                <a href="../main-page/index.html" style="display: inline-block; padding: 10px 20px; background: #4F75FF; color: #FFFFFF; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none;">Back to Apps</a>
            </div>
        </div>
    `;
}
