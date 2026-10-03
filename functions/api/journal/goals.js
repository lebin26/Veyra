/**
 * /api/journal/goals
 * CRUD API for Progress Tracker Goals (Cloudflare D1)
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
            "SELECT * FROM progress_goals WHERE user_id = ? ORDER BY created_at DESC"
        ).bind(currentUser.id).all();
        return json({ goals: res.results || [] });
    }

    if (method === 'POST') {
        try {
            const body = await request.json();
            const title = (body.title || '').trim().substring(0, 150);
            if (!title) return error("Goal title is required", 400);

            const id = body.id || `goal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const metricType = body.metric_type || 'win_rate';
            const targetValue = Number(body.target_value) || 0;
            const currentValue = Number(body.current_value) || 0;
            const unit = (body.unit || '%').substring(0, 10);
            const deadline = body.deadline || null;
            const status = ['in_progress', 'achieved', 'behind'].includes(body.status) ? body.status : 'in_progress';

            await db.prepare(`
                INSERT INTO progress_goals (id, user_id, title, metric_type, target_value, current_value, unit, deadline, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    metric_type = excluded.metric_type,
                    target_value = excluded.target_value,
                    current_value = excluded.current_value,
                    unit = excluded.unit,
                    deadline = excluded.deadline,
                    status = excluded.status,
                    updated_at = datetime('now')
            `).bind(id, currentUser.id, title, metricType, targetValue, currentValue, unit, deadline, status).run();

            return json({ success: true, id });
        } catch (e) {
            return error(e.message || "Failed to save goal", 500);
        }
    }

    if (method === 'DELETE') {
        const id = url.searchParams.get('id');
        if (!id) return error("Missing goal ID", 400);
        await db.prepare("DELETE FROM progress_goals WHERE id = ? AND user_id = ?").bind(id, currentUser.id).run();
        return json({ success: true });
    }

    return error("Method not allowed", 405);
}
