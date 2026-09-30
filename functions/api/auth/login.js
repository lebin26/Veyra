/**
 * POST /api/auth/login
 * Authenticates against Cloudflare D1 users table.
 * Security: No hardcoded credentials. All auth goes through DB.
 */
import { json, error, verifyPassword, createSession, hashPassword } from '../_utils.js';

export async function onRequestPost(context) {
    const { request, env } = context;
    const db = env.DB;

    if (!db) {
        return error("Service unavailable", 503);
    }

    try {
        const body = await request.json();
        const identifier = (body.identifier || body.email || '').trim().toLowerCase();
        const password = body.password || '';
        const remember = Boolean(body.remember ?? true);

        // Validate inputs without revealing which field is wrong
        if (!identifier || !password) {
            return error("Invalid credentials", 401);
        }

        // Input length limits (prevent DoS via huge payloads)
        if (identifier.length > 254 || password.length > 256) {
            return error("Invalid credentials", 401);
        }

        // Lookup user by username or email
        let user = null;
        try {
            user = await db.prepare(`
                SELECT id, username, email, password_hash, password_salt, display_name, role, status, plan_id, plan_expires_at, must_change_password
                FROM users
                WHERE lower(username) = ? OR lower(email) = ?
                LIMIT 1
            `).bind(identifier, identifier).first();
        } catch (queryErr) {
            // Don't expose internal DB errors
            return error("Service unavailable", 503);
        }

        // Auto-provision admin from Cloudflare environment variables only (zero hardcoded secrets)
        if (!user) {
            const adminEnvUsername = (env.ADMIN_INITIAL_USERNAME || env.ADMIN_USERNAME || '').trim().toLowerCase();
            const adminEnvPassword = env.ADMIN_INITIAL_PASSWORD || env.ADMIN_PASSWORD || '';

            if (adminEnvUsername && adminEnvPassword &&
                identifier === adminEnvUsername &&
                password === adminEnvPassword) {
                const matchedUsername = adminEnvUsername;
                const matchedPassword = adminEnvPassword;
                try {
                    // Ensure tables exist
                    await db.prepare(`
                        CREATE TABLE IF NOT EXISTS users (
                            id TEXT PRIMARY KEY,
                            username TEXT UNIQUE NOT NULL,
                            email TEXT UNIQUE,
                            password_hash TEXT NOT NULL,
                            password_salt TEXT NOT NULL,
                            display_name TEXT,
                            role TEXT NOT NULL DEFAULT 'user',
                            status TEXT NOT NULL DEFAULT 'active',
                            plan_id TEXT NOT NULL DEFAULT 'pro',
                            plan_expires_at TEXT DEFAULT NULL,
                            must_change_password INTEGER NOT NULL DEFAULT 0,
                            created_at TEXT NOT NULL DEFAULT (datetime('now')),
                            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                        )
                    `).run();

                    await db.prepare(`
                        CREATE TABLE IF NOT EXISTS sessions (
                            id TEXT PRIMARY KEY,
                            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            expires_at TEXT NOT NULL,
                            created_at TEXT NOT NULL DEFAULT (datetime('now'))
                        )
                    `).run();

                    const { hash, salt } = await hashPassword(matchedPassword);
                    const adminId = 'usr_admin_' + matchedUsername;
                    await db.prepare(`
                        INSERT OR REPLACE INTO users (
                            id, username, email, password_hash, password_salt, display_name, role, status, plan_id, must_change_password, created_at, updated_at
                        ) VALUES (
                            ?, ?, ?, ?, ?, ?, 'admin', 'active', 'pro', 0, datetime('now'), datetime('now')
                        )
                    `).bind(
                        adminId,
                        matchedUsername,
                        `${matchedUsername}@veyra.app`,
                        hash, salt,
                        matchedUsername
                    ).run();

                    user = await db.prepare(
                        "SELECT id, username, email, password_hash, password_salt, display_name, role, status, plan_id, plan_expires_at, must_change_password FROM users WHERE lower(username) = ? LIMIT 1"
                    ).bind(matchedUsername).first();
                } catch (provisionErr) {
                    return error("Service unavailable", 503);
                }
            }
        }

        // User not found — return same error as wrong password (prevent username enumeration)
        if (!user) {
            return error("Invalid credentials", 401);
        }

        if (user.status === 'suspended') {
            return error("Account suspended. Contact administrator.", 403);
        }

        // Verify password
        if (!user.password_hash || !user.password_salt) {
            return error("Invalid credentials", 401);
        }

        const isValid = await verifyPassword(password, user.password_hash, user.password_salt);
        if (!isValid) {
            return error("Invalid credentials", 401);
        }

        // Create cryptographically random session token
        const sessionDays = remember ? 30 : 1;
        let token;
        try {
            const sessionRes = await createSession(db, user.id, sessionDays);
            token = sessionRes.token;
        } catch (sessErr) {
            return error("Service unavailable", 503);
        }

        // Strip sensitive fields before responding
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

        const maxAge = sessionDays * 24 * 60 * 60;
        const cookieStr = `veyra_session=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Strict; Secure`;

        return json({
            success: true,
            token,
            user: { id: safeProfile.id, email: safeProfile.email },
            profile: safeProfile,
            mustChangePassword: Boolean(safeProfile.must_change_password)
        }, 200, {
            'Set-Cookie': cookieStr
        });
    } catch (err) {
        // Never expose internal error messages
        return error("Authentication failed", 500);
    }
}
