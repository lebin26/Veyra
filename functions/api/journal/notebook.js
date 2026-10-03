/**
 * /api/journal/notebook
 * CRUD API for Trading Notebook Entries (Cloudflare D1)
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
        const category = url.searchParams.get('category');
        let query = "SELECT * FROM notebook_entries WHERE user_id = ?";
        const params = [currentUser.id];

        if (category && category !== 'all') {
            query += " AND category = ?";
            params.push(category);
        }

        query += " ORDER BY is_pinned DESC, created_at DESC";
        const res = await db.prepare(query).bind(...params).all();
        return json({ notes: res.results || [] });
    }

    if (method === 'POST') {
        try {
            const body = await request.json();
            const title = (body.title || '').trim().substring(0, 200);
            if (!title) return error("Title is required", 400);

            const id = body.id || `nb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const content = body.content || '';
            const category = ['general', 'mistakes', 'psychology', 'market', 'lessons'].includes(body.category) ? body.category : 'general';
            const tags = typeof body.tags === 'string' ? body.tags : JSON.stringify(body.tags || []);
            const linkedTradeId = body.linked_trade_id || null;
            const isPinned = body.is_pinned ? 1 : 0;

            await db.prepare(`
                INSERT INTO notebook_entries (id, user_id, title, content, category, tags, linked_trade_id, is_pinned, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    content = excluded.content,
                    category = excluded.category,
                    tags = excluded.tags,
                    linked_trade_id = excluded.linked_trade_id,
                    is_pinned = excluded.is_pinned,
                    updated_at = datetime('now')
            `).bind(id, currentUser.id, title, content, category, tags, linkedTradeId, isPinned).run();

            return json({ success: true, id });
        } catch (e) {
            return error(e.message || "Failed to save note", 500);
        }
    }

    if (method === 'DELETE') {
        const id = url.searchParams.get('id');
        if (!id) return error("Missing note ID", 400);
        await db.prepare("DELETE FROM notebook_entries WHERE id = ? AND user_id = ?").bind(id, currentUser.id).run();
        return json({ success: true });
    }

    return error("Method not allowed", 405);
}
