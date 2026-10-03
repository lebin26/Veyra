/**
 * /api/journal/broker-sync
 * Broker Sync Connections Management API (Cloudflare D1)
 */
import { json, error, getUserFromRequest } from '../_utils.js';

export async function onRequest(context) {
    const { request, env } = context;
    const db = env.DB;
    if (!db) return error("Service unavailable", 503);

    const currentUser = await getUserFromRequest(request, db);
    if (!currentUser) return error("Unauthorized", 401);

    const method = request.method;
    const url = new URL(request.url);

    if (method === 'GET') {
        const res = await db.prepare(
            "SELECT * FROM broker_connections WHERE user_id = ? ORDER BY created_at DESC"
        ).bind(currentUser.id).all();
        return json({ brokers: res.results || [] });
    }

    if (method === 'POST') {
        try {
            const body = await request.json();
            const broker = (body.broker || '').trim().substring(0, 50);
            const accountName = (body.account_name || '').trim().substring(0, 100);
            if (!broker || !accountName) return error("Broker and account name are required", 400);

            const id = body.id || `brk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const accountNumber = (body.account_number || '').substring(0, 50);
            const status = ['connected', 'syncing', 'failed', 'disconnected'].includes(body.status) ? body.status : 'connected';
            const lastSync = body.last_sync || 'Just now';
            const nextSync = body.next_sync || '2 hours later';

            await db.prepare(`
                INSERT INTO broker_connections (id, user_id, broker, account_name, account_number, status, last_sync, next_sync, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                ON CONFLICT(id) DO UPDATE SET
                    broker = excluded.broker,
                    account_name = excluded.account_name,
                    account_number = excluded.account_number,
                    status = excluded.status,
                    last_sync = excluded.last_sync,
                    next_sync = excluded.next_sync,
                    updated_at = datetime('now')
            `).bind(id, currentUser.id, broker, accountName, accountNumber, status, lastSync, nextSync).run();

            return json({ success: true, id });
        } catch (e) {
            return error(e.message || "Failed to save broker connection", 500);
        }
    }

    if (method === 'DELETE') {
        const id = url.searchParams.get('id');
        if (!id) return error("Missing broker ID", 400);
        await db.prepare("DELETE FROM broker_connections WHERE id = ? AND user_id = ?").bind(id, currentUser.id).run();
        return json({ success: true });
    }

    return error("Method not allowed", 405);
}
