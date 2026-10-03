/**
 * /api/wealth/portfolio/:id
 * Update and delete individual month portfolio asset holding
 */
import { json, error, getUserFromRequest } from '../../_utils.js';

const VALID_CATEGORIES = ['cash', 'bank', 'crypto', 'investment', 'trading'];

export async function onRequest(context) {
    const { request, env, params } = context;
    const db = env.DB;
    const itemId = params.id;

    if (!db) {
        return error("Service unavailable", 503);
    }

    const currentUser = await getUserFromRequest(request, db);
    if (!currentUser) {
        return error("Unauthorized", 401);
    }

    const method = request.method;

    // Helper: Recalculate totals for snapshot
    async function recalculateSnapshot(snapshotId) {
        const snap = await db.prepare("SELECT usd_rate FROM wealth_snapshots WHERE id = ?").bind(snapshotId).first();
        const usdRate = Number(snap?.usd_rate) || 4.08;

        const itemsRes = await db.prepare(`
            SELECT amount, apr, currency FROM wealth_snapshot_items WHERE snapshot_id = ?
        `).bind(snapshotId).all();

        let totalMyr = 0;
        let totalAprMyr = 0;

        for (const item of (itemsRes.results || [])) {
            const amt = Number(item.amount) || 0;
            const apr = Number(item.apr) || 0;
            const rate = item.currency === 'USD' ? usdRate : 1.0;
            const myr = Math.round(amt * rate * 100) / 100;
            const aprAmt = Math.round(((myr * apr) / 100) * 100) / 100;
            totalMyr += myr;
            totalAprMyr += aprAmt;
        }

        totalMyr = Math.round(totalMyr * 100) / 100;
        totalAprMyr = Math.round(totalAprMyr * 100) / 100;
        const weightedRoi = totalMyr > 0 ? Math.round(((totalAprMyr / totalMyr) * 100) * 100) / 100 : 0;

        await db.prepare(`
            UPDATE wealth_snapshots
            SET total_net_worth_myr = ?, estimated_apr_myr = ?, weighted_roi = ?
            WHERE id = ?
        `).bind(totalMyr, totalAprMyr, weightedRoi, snapshotId).run();
    }

    // DELETE /api/wealth/portfolio/:id
    if (method === 'DELETE') {
        try {
            // Find item and check user ownership through snapshot
            const item = await db.prepare(`
                SELECT i.id, i.snapshot_id
                FROM wealth_snapshot_items i
                JOIN wealth_snapshots s ON i.snapshot_id = s.id
                WHERE i.id = ? AND s.user_id = ?
            `).bind(itemId, currentUser.id).first();

            if (item) {
                await db.prepare("DELETE FROM wealth_snapshot_items WHERE id = ?").bind(itemId).run();
                await recalculateSnapshot(item.snapshot_id);
                return json({ success: true, deleted: true });
            }

            // Fallback for live accounts table
            const res = await db.prepare(
                "DELETE FROM wealth_accounts WHERE id = ? AND user_id = ?"
            ).bind(itemId, currentUser.id).run();

            return json({ success: true, deleted: res.meta?.changes > 0 });
        } catch (e) {
            return error("Failed to delete asset", 500);
        }
    }

    // PUT /api/wealth/portfolio/:id
    if (method === 'PUT') {
        try {
            const body = await request.json();

            // Find item in snapshot
            const item = await db.prepare(`
                SELECT i.id, i.snapshot_id, i.platform, i.product, i.category, i.currency, i.amount, i.apr, s.usd_rate
                FROM wealth_snapshot_items i
                JOIN wealth_snapshots s ON i.snapshot_id = s.id
                WHERE i.id = ? AND s.user_id = ?
            `).bind(itemId, currentUser.id).first();

            if (!item) {
                // Check if in live table
                const live = await db.prepare("SELECT id FROM wealth_accounts WHERE id = ? AND user_id = ?").bind(itemId, currentUser.id).first();
                if (!live) return error("Asset not found", 404);

                const platform = typeof body.platform === 'string' ? body.platform.trim().substring(0, 50) : undefined;
                const product = typeof body.product === 'string' ? body.product.trim().substring(0, 50) : undefined;
                const rawCat = typeof body.category === 'string' ? body.category.toLowerCase().trim() : undefined;
                const category = rawCat && VALID_CATEGORIES.includes(rawCat) ? rawCat : undefined;
                const currency = body.currency !== undefined ? String(body.currency).toUpperCase().trim().substring(0, 10) : undefined;
                const amount = body.amount !== undefined ? Math.max(0, Number(body.amount) || 0) : undefined;
                const apr = body.apr !== undefined ? Math.max(0, Number(body.apr) || 0) : undefined;

                await db.prepare(`
                    UPDATE wealth_accounts
                    SET platform = COALESCE(?, platform),
                        product = COALESCE(?, product),
                        category = COALESCE(?, category),
                        currency = COALESCE(?, currency),
                        amount = COALESCE(?, amount),
                        apr = COALESCE(?, apr),
                        updated_at = datetime('now')
                    WHERE id = ? AND user_id = ?
                `).bind(platform, product, category, currency, amount, apr, itemId, currentUser.id).run();

                return json({ success: true, id: itemId });
            }

            const platform = typeof body.platform === 'string' ? body.platform.trim().substring(0, 50) : item.platform;
            const product = typeof body.product === 'string' ? body.product.trim().substring(0, 50) : item.product;
            const rawCat = typeof body.category === 'string' ? body.category.toLowerCase().trim() : item.category;
            const category = VALID_CATEGORIES.includes(rawCat) ? rawCat : item.category;
            const currency = body.currency !== undefined ? String(body.currency).toUpperCase().trim().substring(0, 10) : item.currency;
            const amount = body.amount !== undefined ? Math.max(0, Number(body.amount) || 0) : item.amount;
            const apr = body.apr !== undefined ? Math.max(0, Number(body.apr) || 0) : item.apr;

            const rate = currency === 'USD' ? item.usd_rate : 1.0;
            const amountMyr = Math.round(amount * rate * 100) / 100;
            const aprAmountMyr = Math.round(((amountMyr * apr) / 100) * 100) / 100;

            await db.prepare(`
                UPDATE wealth_snapshot_items
                SET platform = ?,
                    product = ?,
                    category = ?,
                    currency = ?,
                    amount = ?,
                    amount_myr = ?,
                    apr = ?,
                    apr_amount_myr = ?
                WHERE id = ?
            `).bind(platform, product, category, currency, amount, amountMyr, apr, aprAmountMyr, itemId).run();

            await recalculateSnapshot(item.snapshot_id);

            return json({ success: true, id: itemId });
        } catch (e) {
            return error("Failed to update asset", 500);
        }
    }

    return error("Method not allowed", 405);
}
