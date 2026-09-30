/**
 * /api/trades
 * CRUD API for trades (Cloudflare D1)
 * Multi-tenant partitioned by user_id and mode ('live' vs 'backtest')
 */
import { json, error, getUserFromRequest } from '../_utils.js';

export async function onRequest(context) {
    const { request, env } = context;
    const db = env.DB;

    if (!db) {
        return error("Database unconfigured", 500);
    }

    const currentUser = await getUserFromRequest(request, db);
    if (!currentUser) {
        return error("Unauthorized", 401);
    }

    const method = request.method;
    const url = new URL(request.url);

    // GET /api/trades?mode=live
    if (method === 'GET') {
        const mode = url.searchParams.get('mode') || 'live';
        const bookId = url.searchParams.get('book_id');

        let query = "SELECT * FROM trades WHERE user_id = ? AND mode = ?";
        const params = [currentUser.id, mode];

        if (bookId) {
            query += " AND book_id = ?";
            params.push(bookId);
        }

        query += " ORDER BY entry_time DESC";

        const res = await db.prepare(query).bind(...params).all();
        return json({ trades: res.results || [] });
    }

    // POST /api/trades: Create trade
    if (method === 'POST') {
        try {
            const body = await request.json();
            const id = body.id || 'trd_' + crypto.randomUUID();
            const mode = body.mode === 'backtest' ? 'backtest' : 'live';

            await db.prepare(`
                INSERT INTO trades (
                    id, user_id, mode, book_id, symbol, side, entry_price, exit_price,
                    lot_size, pnl, pnl_percentage, entry_time, exit_time, strategy, notes, tags,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `).bind(
                id,
                currentUser.id,
                mode,
                body.book_id || null,
                body.symbol,
                body.side,
                Number(body.entry_price) || 0,
                Number(body.exit_price) || 0,
                Number(body.lot_size) || 0,
                Number(body.pnl) || 0,
                Number(body.pnl_percentage) || 0,
                body.entry_time || new Date().toISOString(),
                body.exit_time || new Date().toISOString(),
                body.strategy || null,
                body.notes || null,
                body.tags ? JSON.stringify(body.tags) : null
            ).run();

            return json({ success: true, id }, 201);
        } catch (e) {
            return error(e.message || "Failed to create trade", 400);
        }
    }

    return error("Method not allowed", 405);
}
