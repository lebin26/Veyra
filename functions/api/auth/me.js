/**
 * GET /api/auth/me
 * Returns current authenticated user and profile from Cloudflare D1.
 * Only returns profile for active accounts.
 */
import { json, error, getUserFromRequest } from '../_utils.js';

export async function onRequestGet(context) {
    const { request, env } = context;
    const db = env.DB;

    if (!db) {
        return error("Service unavailable", 503);
    }

    try {
        const user = await getUserFromRequest(request, db);

        if (!user) {
            return json({ user: null, profile: null });
        }

        // Only expose the fields the frontend actually needs
        const safeProfile = {
            id: user.id,
            username: user.username,
            email: user.email,
            display_name: user.display_name,
            role: user.role,
            status: user.status,
            plan_id: user.plan_id,
            plan_expires_at: user.plan_expires_at,
            must_change_password: user.must_change_password
        };

        return json({
            user: { id: safeProfile.id, email: safeProfile.email },
            profile: safeProfile
        });
    } catch (err) {
        return error("Service unavailable", 503);
    }
}
