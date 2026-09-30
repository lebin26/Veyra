/**
 * /api/trades/:id
 * Individual trade update and deletion (Cloudflare D1)
 */
import { json, error, getUserFromRequest } from '../_utils.js';

export async function onRequest(context) {
    const { request, env, params } = context;
    const db = env.DB;
    const tradeId = params.id;

    if (!db) {
        return error("Database unconfigured", 500);
    }

    const currentUser = await getUserFromRequest(request, db);
    if (!currentUser) {
        return error("Unauthorized", 401);
    }

    const method = request.method;

    // DELETE /api/trades/:id
    if (method === 'DELETE') {
        const res = await db.prepare("DELETE FROM trades WHERE id = ? AND user_id = ?")
            .bind(tradeId, currentUser.id).run();
        
        return json({ success: true, deleted: res.meta.changes > 0 });
    }

    // PUT /api/trades/:id
    if (method === 'PUT') {
        try {
            const body = await request.json();

            await db.prepare(`
                UPDATE trades
                SET symbol = COALESCE(?, symbol),
                    side = COALESCE(?, side),
                    entry_price = COALESCE(?, entry_price),
                    exit_price = COALESCE(?, exit_price),
                    lot_size = COALESCE(?, lot_size),
                    pnl = COALESCE(?, pnl),
                    pnl_percentage = COALESCE(?, pnl_percentage),
                    entry_time = COALESCE(?, entry_time),
                    exit_time = COALESCE(?, exit_time),
                    strategy = COALESCE(?, strategy),
                    notes = COALESCE(?, notes),
                    tags = COALESCE(?, tags),
                    updated_at = datetime('now')
                WHERE id = ? AND user_id = ?
            `).bind(
                body.symbol || null,
                body.side || null,
                body.entry_price !== undefined ? Number(body.entry_price) : null,
                body.exit_price !== undefined ? Number(body.exit_price) : null,
                body.lot_size !== undefined ? Number(body.lot_size) : null,
                body.pnl !== undefined ? Number(body.pnl) : null,
                body.pnl_percentage !== undefined ? Number(body.pnl_percentage) : null,
                body.entry_time || null,
                body.exit_time || null,
                body.strategy || null,
                body.notes || null,
                body.tags ? JSON.stringify(body.tags) : null,
                tradeId,
                currentUser.id
            ).run();

            return json({ success: true });
        } catch (e) {
            return error(e.message || "Failed to update trade", 400);
        }
    }

    return error("Method not allowed", 405);
}
