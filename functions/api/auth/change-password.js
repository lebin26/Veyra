/**
 * POST /api/auth/change-password
 * Updates user password in Cloudflare D1.
 */
import { json, error, getUserFromRequest, hashPassword } from '../_utils.js';

export async function onRequestPost(context) {
    const { request, env } = context;
    const db = env.DB;

    if (!db) {
        return error("Service unavailable", 503);
    }

    try {
        const user = await getUserFromRequest(request, db);
        if (!user) {
            return error("Unauthorized", 401);
        }

        const body = await request.json();
        const newPassword = body.newPassword || '';

        if (!newPassword || newPassword.length < 8 || newPassword.length > 256) {
            return error("Password must be 8–256 characters", 400);
        }

        const { hash, salt } = await hashPassword(newPassword);

        await db.prepare(`
            UPDATE users
            SET password_hash = ?, password_salt = ?, must_change_password = 0, updated_at = datetime('now')
            WHERE id = ?
        `).bind(hash, salt, user.id).run();

        return json({ success: true });
    } catch (err) {
        return error("Failed to update password", 500);
    }
}
