/**
 * /api/trades
 * CRUD API for trades (Cloudflare D1)
 * Multi-tenant partitioned by user_id and mode ('live' vs 'backtest')
 */
import { json, error, getUserFromRequest } from '../_utils.js';

const VALID_MODES = ['live', 'backtest'];
const VALID_SIDES = ['BUY', 'SELL', 'LONG', 'SHORT'];

export async function onRequest(context) {
    const { request, env } = context;
    const db = env.DB;

    if (!db) {
        return error("Service unavailable", 503);
    }

    const currentUser = await getUserFromRequest(request, db);
    if (!currentUser) {
        return error("Unauthorized", 401);
    }

    const method = request.method;
    const url = new URL(request.url);

    // GET /api/trades?mode=live
    if (method === 'GET') {
        const rawMode = url.searchParams.get('mode') || 'live';
        const mode = VALID_MODES.includes(rawMode) ? rawMode : 'live';
        const bookId = url.searchParams.get('book_id');

        // book_id validation — UUIDs/simple IDs only
        const safeBookId = bookId && /^[a-zA-Z0-9_\-]{1,64}$/.test(bookId) ? bookId : null;

        let query = "SELECT id, user_id, mode, book_id, symbol, side, entry_price, exit_price, lot_size, pnl, pnl_percentage, entry_time, exit_time, strategy, notes, tags, created_at, updated_at FROM trades WHERE user_id = ? AND mode = ?";
        const params = [currentUser.id, mode];

        if (safeBookId) {
            query += " AND book_id = ?";
            params.push(safeBookId);
        }

        query += " ORDER BY entry_time DESC LIMIT 2000";

        const res = await db.prepare(query).bind(...params).all();
        return json({ trades: res.results || [] });
    }

    // POST /api/trades: Create trade
    if (method === 'POST') {
        try {
            const body = await request.json();

            // Whitelist mode and side
            const mode = VALID_MODES.includes(body.mode) ? body.mode : 'live';
            const side = VALID_SIDES.includes((body.side || '').toUpperCase()) ? body.side.toUpperCase() : null;
            if (!side) return error("Invalid side value", 400);

            const symbol = typeof body.symbol === 'string' ? body.symbol.trim().substring(0, 20) : null;
            if (!symbol) return error("Symbol is required", 400);

            const id = 'trd_' + crypto.randomUUID();

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
                typeof body.book_id === 'string' ? body.book_id.substring(0, 64) : null,
                symbol,
                side,
                Number(body.entry_price) || 0,
                Number(body.exit_price) || 0,
                Number(body.lot_size) || 0,
                Number(body.pnl) || 0,
                Number(body.pnl_percentage) || 0,
                body.entry_time || new Date().toISOString(),
                body.exit_time || new Date().toISOString(),
                typeof body.strategy === 'string' ? body.strategy.substring(0, 100) : null,
                typeof body.notes === 'string' ? body.notes.substring(0, 2000) : null,
                Array.isArray(body.tags) ? JSON.stringify(body.tags.slice(0, 20)) : null
            ).run();

            return json({ success: true, id }, 201);
        } catch (e) {
            return error("Failed to create trade", 400);
        }
    }

    return error("Method not allowed", 405);
}
