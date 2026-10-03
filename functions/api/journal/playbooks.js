/**
 * /api/journal/playbooks
 * CRUD API for Trading Playbooks (Cloudflare D1)
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
            "SELECT * FROM playbooks WHERE user_id = ? ORDER BY created_at DESC"
        ).bind(currentUser.id).all();
        return json({ playbooks: res.results || [] });
    }

    if (method === 'POST') {
        try {
            const body = await request.json();
            const name = (body.name || '').trim().substring(0, 100);
            if (!name) return error("Playbook name is required", 400);

            const id = body.id || `pb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const description = (body.description || '').substring(0, 500);
            const market = (body.market || 'ALL').substring(0, 50);
            const timeframe = (body.timeframe || '5M').substring(0, 20);
            const direction = ['LONG', 'SHORT', 'BOTH'].includes(body.direction) ? body.direction : 'BOTH';
            const rules = typeof body.rules === 'string' ? body.rules : JSON.stringify(body.rules || []);
            const riskModel = (body.risk_model || '1R').substring(0, 50);
            const status = ['active', 'paused', 'archived'].includes(body.status) ? body.status : 'active';
            const isShared = body.is_shared ? 1 : 0;

            await db.prepare(`
                INSERT INTO playbooks (id, user_id, name, description, market, timeframe, direction, rules, risk_model, status, is_shared, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    description = excluded.description,
                    market = excluded.market,
                    timeframe = excluded.timeframe,
                    direction = excluded.direction,
                    rules = excluded.rules,
                    risk_model = excluded.risk_model,
                    status = excluded.status,
                    is_shared = excluded.is_shared,
                    updated_at = datetime('now')
            `).bind(id, currentUser.id, name, description, market, timeframe, direction, rules, riskModel, status, isShared).run();

            return json({ success: true, id });
        } catch (e) {
            return error(e.message || "Failed to save playbook", 500);
        }
    }

    if (method === 'DELETE') {
        const id = url.searchParams.get('id');
        if (!id) return error("Missing playbook ID", 400);
        await db.prepare("DELETE FROM playbooks WHERE id = ? AND user_id = ?").bind(id, currentUser.id).run();
        return json({ success: true });
    }

    return error("Method not allowed", 405);
}
