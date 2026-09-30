/**
 * /api/admin/users
 * Admin User Management API (Cloudflare D1)
 * Enforces admin authorization.
 * Supports: GET (list users), POST (create user), PATCH (update user, set app overrides)
 */
import { json, error, getUserFromRequest, hashPassword } from '../_utils.js';

export async function onRequest(context) {
    const { request, env } = context;

    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            }
        });
    }

    const db = env.DB;
    if (!db) {
        return error("Database unconfigured", 500);
    }

    const currentUser = await getUserFromRequest(request, db);
    if (!currentUser) {
        return error("Unauthorized: Active session required", 401);
    }
    if (currentUser.role !== 'admin') {
        return error("Forbidden: Administrator access required", 403);
    }

    const method = request.method;

    // GET /api/admin/users: List all users with their app overrides
    if (method === 'GET') {
        try {
            const users = await db.prepare(`
                SELECT id, username, email, display_name, role, status, plan_id, plan_expires_at, must_change_password, created_at, updated_at
                FROM users
                ORDER BY created_at DESC
            `).all();

            // Fetch app overrides safely (table might not exist yet)
            const overrideMap = {};
            try {
                const overrides = await db.prepare(`
                    SELECT user_id, app_key, is_enabled FROM user_app_overrides
                `).all();
                (overrides.results || []).forEach(o => {
                    if (!overrideMap[o.user_id]) overrideMap[o.user_id] = {};
                    overrideMap[o.user_id][o.app_key] = o.is_enabled;
                });
            } catch (_) {
                // Ignore if user_app_overrides table is not yet created
            }

            const result = (users.results || []).map(u => ({
                ...u,
                app_overrides: overrideMap[u.id] || {}
            }));

            return json({ users: result });
        } catch (dbErr) {
            return error("Failed to load users: " + (dbErr.message || "Database query failed"), 500);
        }
    }

    // POST /api/admin/users: Create new user
    if (method === 'POST') {
        try {
            const body = await request.json();
            const username = (body.username || '').trim().toLowerCase();
            const email = (body.email || `${username}@veyra.app`).trim().toLowerCase();
            const password = body.password || 'VeyraTemp123!';
            const role = body.role === 'admin' ? 'admin' : 'user';
            const plan_id = body.plan_id || 'pro';
            const must_change_password = body.must_change_password ? 1 : 0;

            if (!username) {
                return error("Username is required", 400);
            }

            const { hash, salt } = await hashPassword(password);
            const newUserId = 'usr_' + crypto.randomUUID();

            await db.prepare(`
                INSERT INTO users (id, username, email, password_hash, password_salt, display_name, role, status, plan_id, must_change_password, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, datetime('now'), datetime('now'))
            `).bind(newUserId, username, email, hash, salt, username, role, plan_id, must_change_password).run();

            return json({ success: true, userId: newUserId, username, initialPassword: password });
        } catch (e) {
            return error(e.message || "Failed to create user", 400);
        }
    }

    // PATCH /api/admin/users: Update user (status, plan, role, reset password, app overrides)
    if (method === 'PATCH') {
        try {
            const body = await request.json();
            const targetUserId = body.userId;
            if (!targetUserId) return error("userId is required", 400);

            if (body.status) {
                await db.prepare("UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?")
                    .bind(body.status, targetUserId).run();
            }
            if (body.plan_id) {
                await db.prepare("UPDATE users SET plan_id = ?, updated_at = datetime('now') WHERE id = ?")
                    .bind(body.plan_id, targetUserId).run();
            }
            if (body.role) {
                await db.prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?")
                    .bind(body.role, targetUserId).run();
            }
            if (body.resetPassword) {
                const { hash, salt } = await hashPassword(body.resetPassword);
                await db.prepare("UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = 1, updated_at = datetime('now') WHERE id = ?")
                    .bind(hash, salt, targetUserId).run();
            }

            // App override: { app_overrides: { trading_journal: true|false|null } }
            if (body.app_overrides && typeof body.app_overrides === 'object') {
                for (const [appKey, isEnabled] of Object.entries(body.app_overrides)) {
                    if (isEnabled === null) {
                        // Remove override (revert to plan default)
                        await db.prepare("DELETE FROM user_app_overrides WHERE user_id = ? AND app_key = ?")
                            .bind(targetUserId, appKey).run();
                    } else {
                        await db.prepare(`
                            INSERT INTO user_app_overrides (user_id, app_key, is_enabled, updated_at)
                            VALUES (?, ?, ?, datetime('now'))
                            ON CONFLICT(user_id, app_key) DO UPDATE SET is_enabled = excluded.is_enabled, updated_at = excluded.updated_at
                        `).bind(targetUserId, appKey, isEnabled ? 1 : 0).run();
                    }
                }
            }

            return json({ success: true });
        } catch (e) {
            return error(e.message || "Failed to update user", 400);
        }
    }

    return error("Method not allowed", 405);
}
