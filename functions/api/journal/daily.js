/**
 * /api/journal/daily
 * Daily Journal Entries & Reviews API (Cloudflare D1)
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
        const date = url.searchParams.get('date');
        if (date) {
            const res = await db.prepare(
                "SELECT * FROM daily_journals WHERE user_id = ? AND date = ?"
            ).bind(currentUser.id, date).first();
            return json({ entry: res || null });
        }
        const res = await db.prepare(
            "SELECT * FROM daily_journals WHERE user_id = ? ORDER BY date DESC LIMIT 365"
        ).bind(currentUser.id).all();
        return json({ entries: res.results || [] });
    }

    if (method === 'POST') {
        try {
            const body = await request.json();
            const date = (body.date || '').trim();
            if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return error("Valid date (YYYY-MM-DD) is required", 400);

            const id = body.id || `dj_${date}_${currentUser.id.substring(0, 8)}`;
            const preNotes = body.pre_market_notes || '';
            const postNotes = body.post_market_notes || '';
            const rating = Number(body.daily_rating) || 5;
            const mood = body.mood || 'Focused';
            const marketCondition = body.market_condition || 'Normal';
            const lessons = body.lessons || '';

            await db.prepare(`
                INSERT INTO daily_journals (id, user_id, date, pre_market_notes, post_market_notes, daily_rating, mood, market_condition, lessons, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                ON CONFLICT(user_id, date) DO UPDATE SET
                    pre_market_notes = excluded.pre_market_notes,
                    post_market_notes = excluded.post_market_notes,
                    daily_rating = excluded.daily_rating,
                    mood = excluded.mood,
                    market_condition = excluded.market_condition,
                    lessons = excluded.lessons,
                    updated_at = datetime('now')
            `).bind(id, currentUser.id, date, preNotes, postNotes, rating, mood, marketCondition, lessons).run();

            return json({ success: true, date });
        } catch (e) {
            return error(e.message || "Failed to save daily journal entry", 500);
        }
    }

    return error("Method not allowed", 405);
}
