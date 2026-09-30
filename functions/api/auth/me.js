/**
 * GET /api/auth/me
 * Returns current authenticated user and profile from Cloudflare D1.
 */
import { json, error, getUserFromRequest } from '../_utils.js';

export async function onRequestGet(context) {
    const { request, env } = context;
    const db = env.DB;

    if (!db) {
        return error("Cloudflare D1 database binding 'DB' is not configured.", 500);
    }

    try {
        const user = await getUserFromRequest(request, db);

        if (!user) {
            return json({ user: null, profile: null });
        }

        return json({
            user: { id: user.id, email: user.email },
            profile: user
        });
    } catch (err) {
        console.error('[API /auth/me] Error:', err);
        return error("Failed to retrieve profile", 500);
    }
}
