/**
 * POST /api/auth/login
 * Authenticates against Cloudflare D1 users table.
 */
import { json, error, verifyPassword, createSession } from '../_utils.js';

export async function onRequestPost(context) {
    const { request, env } = context;
    const db = env.DB;

    if (!db) {
        return error("Cloudflare D1 database binding 'DB' is not configured in Cloudflare Pages.", 500);
    }

    try {
        const body = await request.json();
        const identifier = (body.identifier || body.email || '').trim().toLowerCase();
        const password = body.password || '';
        const remember = Boolean(body.remember ?? true);

        if (!identifier || !password) {
            return error("Invalid email or password", 401);
        }

        // Search user by username or email
        const user = await db.prepare(`
            SELECT id, username, email, password_hash, password_salt, display_name, role, status, plan_id, plan_expires_at, must_change_password
            FROM users
            WHERE lower(username) = ? OR lower(email) = ?
        `).bind(identifier, identifier).first();

        if (!user) {
            return error("Invalid email or password", 401);
        }

        if (user.status === 'suspended') {
            return error("Your account has been suspended. Please contact platform administrator.", 403);
        }

        // Verify PBKDF2 password
        const isValid = await verifyPassword(password, user.password_hash, user.password_salt);
        if (!isValid) {
            return error("Invalid email or password", 401);
        }

        // Create 30-day or 1-day session
        const sessionDays = remember ? 30 : 1;
        const { token, expiresAt } = await createSession(db, user.id, sessionDays);

        // Remove sensitive fields from response
        const { password_hash, password_salt, ...safeUser } = user;

        const maxAge = sessionDays * 24 * 60 * 60;
        const cookieStr = `veyra_session=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax; Secure`;

        return json({
            success: true,
            token,
            user: { id: safeUser.id, email: safeUser.email },
            profile: safeUser,
            mustChangePassword: Boolean(safeUser.must_change_password)
        }, 200, {
            'Set-Cookie': cookieStr
        });
    } catch (err) {
        console.error('[API /auth/login] Error:', err);
        return error("Internal server error during authentication", 500);
    }
}
