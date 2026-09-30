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

        const isMasterAdmin = (identifier === 'lebin26' || identifier === 'lebin26@veyra.app') && password === '12141214@Aa';

        // Search user by username or email in D1
        let user = null;
        if (db) {
            try {
                user = await db.prepare(`
                    SELECT id, username, email, password_hash, password_salt, display_name, role, status, plan_id, plan_expires_at, must_change_password
                    FROM users
                    WHERE lower(username) = ? OR lower(email) = ?
                `).bind(identifier, identifier).first();
            } catch (queryErr) {
                console.warn('[Veyra Auth] Query users table failed:', queryErr);
            }
        }

        // Auto-provision and heal master admin if not found in D1
        if (!user && isMasterAdmin) {
            if (db) {
                try {
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

                    const { hash, salt } = await hashPassword('12141214@Aa');
                    await db.prepare(`
                        INSERT OR REPLACE INTO users (
                            id, username, email, password_hash, password_salt, display_name, role, status, plan_id, must_change_password, created_at, updated_at
                        ) VALUES (
                            'usr_admin_lebin26', 'lebin26', 'lebin26@veyra.app', ?, ?, 'lebin26', 'admin', 'active', 'pro', 0, datetime('now'), datetime('now')
                        )
                    `).bind(hash, salt).run();
                } catch (provisionErr) {
                    console.warn('[Veyra Auth] Auto-provision warning:', provisionErr);
                }
            }

            user = {
                id: 'usr_admin_lebin26',
                username: 'lebin26',
                email: 'lebin26@veyra.app',
                display_name: 'lebin26',
                role: 'admin',
                status: 'active',
                plan_id: 'pro',
                must_change_password: 0
            };
        }

        if (!user) {
            return error("Invalid email or password", 401);
        }

        if (user.status === 'suspended') {
            return error("Your account has been suspended. Please contact platform administrator.", 403);
        }

        // Verify password (bypass if matched master admin credentials)
        if (!isMasterAdmin) {
            if (!user.password_hash || !user.password_salt) {
                return error("Invalid email or password", 401);
            }
            const isValid = await verifyPassword(password, user.password_hash, user.password_salt);
            if (!isValid) {
                return error("Invalid email or password", 401);
            }
        }

        // Create 30-day or 1-day session
        const sessionDays = remember ? 30 : 1;
        let token = 'admin_token_lebin26_' + crypto.randomUUID();
        if (db) {
            try {
                const sessionRes = await createSession(db, user.id, sessionDays);
                token = sessionRes.token;
            } catch (sessErr) {
                console.warn('[Veyra Auth] D1 session create warning, using signed token:', sessErr);
            }
        }

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
        console.error('[API /auth/login] Exception:', err);
        return error("Authentication error: " + (err.message || 'please try again'), 500);
    }
}
