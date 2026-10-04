/**
 * /api/wealth/snapshots
 * Monthly Net Worth Snapshots and Clone/Inheritance API (Cloudflare D1)
 */
import { json, error, getUserFromRequest } from '../_utils.js';

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

    // GET /api/wealth/snapshots
    if (method === 'GET') {
        try {
            const detailMonth = url.searchParams.get('month');
            const withDetails = url.searchParams.get('details') === 'true';

            if (detailMonth && withDetails) {
                const snap = await db.prepare(`
                    SELECT id, user_id, month, usd_rate, total_net_worth_myr, estimated_apr_myr, weighted_roi, notes, created_at
                    FROM wealth_snapshots
                    WHERE user_id = ? AND month = ?
                `).bind(currentUser.id, detailMonth).first();

                if (!snap) {
                    return json({ snapshot: null, items: [] });
                }

                const itemsRes = await db.prepare(`
                    SELECT id, snapshot_id, platform, product, category, currency, amount, amount_myr, apr, apr_amount_myr
                    FROM wealth_snapshot_items
                    WHERE snapshot_id = ?
                    ORDER BY platform ASC, product ASC
                `).bind(snap.id).all();

                return json({
                    snapshot: snap,
                    items: itemsRes.results || []
                });
            }

            // List all snapshots
            const res = await db.prepare(`
                SELECT id, user_id, month, usd_rate, total_net_worth_myr, estimated_apr_myr, weighted_roi, notes, created_at
                FROM wealth_snapshots
                WHERE user_id = ?
                ORDER BY month ASC
            `).bind(currentUser.id).all();

            return json({
                snapshots: res.results || []
            });
        } catch (e) {
            return error("Failed to fetch snapshots", 500);
        }
    }

    // DELETE /api/wealth/snapshots?month=YYYY-MM
    if (method === 'DELETE') {
        const monthToDelete = url.searchParams.get('month');
        if (!monthToDelete) return error("month query parameter required", 400);

        try {
            const snap = await db.prepare("SELECT id FROM wealth_snapshots WHERE user_id = ? AND month = ?")
                .bind(currentUser.id, monthToDelete).first();

            if (snap) {
                await db.prepare("DELETE FROM wealth_snapshot_items WHERE snapshot_id = ?").bind(snap.id).run();
                await db.prepare("DELETE FROM wealth_snapshots WHERE id = ?").bind(snap.id).run();
            }

            return json({ success: true, deleted_month: monthToDelete });
        } catch (e) {
            return error("Failed to delete month snapshot", 500);
        }
    }

    // POST /api/wealth/snapshots (Create, Update, or Clone from previous month)
    if (method === 'POST') {
        try {
            const body = await request.json();
            const action = body.action || 'save';

            // Clone Month Action
            if (action === 'clone') {
                const sourceMonth = body.source_month;
                const targetMonth = body.target_month;
                const usdRate = Math.max(0.1, Number(body.usd_rate) || 4.08);

                if (!sourceMonth || !targetMonth) {
                    return error("source_month and target_month are required", 400);
                }

                let sourceItemsList = [];
                if (sourceSnap) {
                    const sourceItemsRes = await db.prepare(`
                        SELECT platform, product, category, currency, amount, apr
                        FROM wealth_snapshot_items
                        WHERE snapshot_id = ?
                    `).bind(sourceSnap.id).all();
                    sourceItemsList = sourceItemsRes.results || [];
                } else {
                    const liveRes = await db.prepare(`
                        SELECT platform, product, category, currency, amount, apr
                        FROM wealth_accounts
                        WHERE user_id = ?
                    `).bind(currentUser.id).all();
                    sourceItemsList = liveRes.results || [];
                }

                const itemsToInsert = (Array.isArray(body.items) && body.items.length > 0)
                    ? body.items
                    : sourceItemsList;

                if (itemsToInsert.length === 0) {
                    return error("No template items found to copy. Please add at least one asset first.", 400);
                }

                // Check or create target snapshot
                let targetSnap = await db.prepare(
                    "SELECT id FROM wealth_snapshots WHERE user_id = ? AND month = ?"
                ).bind(currentUser.id, targetMonth).first();

                let targetSnapId;
                if (targetSnap) {
                    targetSnapId = targetSnap.id;
                    await db.prepare("DELETE FROM wealth_snapshot_items WHERE snapshot_id = ?").bind(targetSnapId).run();
                } else {
                    targetSnapId = 'snp_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
                    await db.prepare(`
                        INSERT INTO wealth_snapshots (id, user_id, month, usd_rate, total_net_worth_myr, estimated_apr_myr, weighted_roi, created_at)
                        VALUES (?, ?, ?, ?, 0, 0, 0, datetime('now'))
                    `).bind(targetSnapId, currentUser.id, targetMonth, usdRate).run();
                }

                let totalMyr = 0;
                let totalAprMyr = 0;

                for (const item of itemsToInsert) {
                    const amt = Math.max(0, Number(item.amount) || 0);
                    const apr = Math.max(0, Number(item.apr) || 0);
                    const currency = (item.currency || 'MYR').toUpperCase().trim();
                    const rate = currency === 'USD' ? usdRate : 1.0;
                    const myr = Math.round(amt * rate * 100) / 100;
                    const aprAmt = Math.round(((myr * apr) / 100) * 100) / 100;

                    totalMyr += myr;
                    totalAprMyr += aprAmt;

                    const newItemId = 'sni_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
                    await db.prepare(`
                        INSERT INTO wealth_snapshot_items (id, snapshot_id, platform, product, category, currency, amount, amount_myr, apr, apr_amount_myr)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).bind(newItemId, targetSnapId, item.platform || 'Other', item.product || 'Account', item.category || 'bank', currency, amt, myr, apr, aprAmt).run();
                }

                totalMyr = Math.round(totalMyr * 100) / 100;
                totalAprMyr = Math.round(totalAprMyr * 100) / 100;
                const weightedRoi = totalMyr > 0 ? Math.round(((totalAprMyr / totalMyr) * 100) * 100) / 100 : 0;

                await db.prepare(`
                    UPDATE wealth_snapshots
                    SET usd_rate = ?, total_net_worth_myr = ?, estimated_apr_myr = ?, weighted_roi = ?
                    WHERE id = ?
                `).bind(usdRate, totalMyr, totalAprMyr, weightedRoi, targetSnapId).run();

                return json({
                    success: true,
                    month: targetMonth,
                    items_count: itemsToInsert.length,
                    total_net_worth_myr: totalMyr
                });
            }

            return error("Invalid action", 400);
        } catch (e) {
            return error("Failed to process snapshot action", 500);
        }
    }

    return error("Method not allowed", 405);
}
