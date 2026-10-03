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

            // Save initial app overrides if provided
            if (body.app_overrides && typeof body.app_overrides === 'object') {
                for (const [appKey, isEnabled] of Object.entries(body.app_overrides)) {
                    if (isEnabled !== null) {
                        try {
                            await db.prepare(`
                                INSERT INTO user_app_overrides (user_id, app_key, is_enabled, updated_at)
                                VALUES (?, ?, ?, datetime('now'))
                            `).bind(newUserId, appKey, isEnabled ? 1 : 0).run();
                        } catch (_) {}
                    }
                }
            }

            return json({ success: true, userId: newUserId, username, initialPassword: password });
        } catch (e) {
            return error(e.message || "Failed to create user", 400);
        }
    }

    // PATCH /api/admin/users: Update user (username, email, status, plan, role, reset password, app overrides)
    if (method === 'PATCH') {
        try {
            const body = await request.json();
            const targetUserId = body.userId;
            if (!targetUserId) return error("userId is required", 400);

            const targetUser = await db.prepare(
                "SELECT id, username, email, role, status FROM users WHERE id = ?"
            ).bind(targetUserId).first();

            if (!targetUser) {
                return error("User not found", 404);
            }

            // Sole admin protection:
            // An admin cannot suspend themselves if they are the only active admin.
            // Nor can the sole active admin be demoted to 'user'.
            const willSuspend = body.status === 'suspended' && targetUser.status !== 'suspended';
            const willDemote = body.role === 'user' && targetUser.role === 'admin';
            if (targetUser.role === 'admin' && (willSuspend || willDemote)) {
                const adminCountRow = await db.prepare(
                    "SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND status = 'active'"
                ).first();
                const activeAdminCount = adminCountRow ? Number(adminCountRow.count) : 0;
                if (activeAdminCount <= 1) {
                    if (willSuspend) {
                        return error("Cannot suspend the only active administrator.", 400);
                    }
                    if (willDemote) {
                        return error("Cannot demote the only active administrator.", 400);
                    }
                }
            }

            // Update Username
            if (body.username !== undefined) {
                const cleanUsername = String(body.username).trim().toLowerCase();
                if (!cleanUsername || cleanUsername.length < 3 || cleanUsername.length > 50) {
                    return error("Username must be 3–50 characters", 400);
                }
                if (!/^[a-zA-Z0-9_-]+$/.test(cleanUsername)) {
                    return error("Username can only contain letters, numbers, underscores, and hyphens", 400);
                }
                if (cleanUsername !== targetUser.username.toLowerCase()) {
                    const existing = await db.prepare(
                        "SELECT id FROM users WHERE lower(username) = ? AND id != ?"
                    ).bind(cleanUsername, targetUserId).first();
                    if (existing) {
                        return error("Username is already taken", 400);
                    }
                    await db.prepare(
                        "UPDATE users SET username = ?, display_name = ?, updated_at = datetime('now') WHERE id = ?"
                    ).bind(cleanUsername, cleanUsername, targetUserId).run();
                }
            }

            // Update Email
            if (body.email !== undefined) {
                const cleanEmail = String(body.email).trim().toLowerCase();
                if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
                    return error("Invalid email format", 400);
                }
                const emailVal = cleanEmail || null;
                if (emailVal !== (targetUser.email || '').toLowerCase()) {
                    if (emailVal) {
                        const existingEmail = await db.prepare(
                            "SELECT id FROM users WHERE lower(email) = ? AND id != ?"
                        ).bind(emailVal, targetUserId).first();
                        if (existingEmail) {
                            return error("Email is already registered to another user", 400);
                        }
                    }
                    await db.prepare(
                        "UPDATE users SET email = ?, updated_at = datetime('now') WHERE id = ?"
                    ).bind(emailVal, targetUserId).run();
                }
            }

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

            const newPassword = body.resetPassword || body.password;
            if (newPassword) {
                if (newPassword.length < 8 || newPassword.length > 256) {
                    return error("Password must be 8–256 characters", 400);
                }
                const { hash, salt } = await hashPassword(newPassword);
                // When an admin updates their own password, do not force must_change_password
                const mustChange = body.must_change_password !== undefined
                    ? (body.must_change_password ? 1 : 0)
                    : (targetUserId === currentUser.id ? 0 : 1);

                await db.prepare("UPDATE users SET password_hash = ?, password_salt = ?, must_change_password = ?, updated_at = datetime('now') WHERE id = ?")
                    .bind(hash, salt, mustChange, targetUserId).run();
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
