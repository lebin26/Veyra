/**
 * /api/wealth/portfolio
 * Manage portfolio holdings by month (Cloudflare D1)
 */
import { json, error, getUserFromRequest } from '../_utils.js';

const VALID_CATEGORIES = ['cash', 'bank', 'crypto', 'investment', 'trading'];

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
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const rawMonth = url.searchParams.get('month');
    const month = (rawMonth && /^\d{4}-\d{2}$/.test(rawMonth)) ? rawMonth : defaultMonth;

    // Helper: Ensure snapshot exists for month and return snapshot record
    async function getOrCreateSnapshot(usdRate = 4.08) {
        let snap = await db.prepare(
            "SELECT id, month, usd_rate FROM wealth_snapshots WHERE user_id = ? AND month = ?"
        ).bind(currentUser.id, month).first();

        if (!snap) {
            const snapId = 'snp_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
            await db.prepare(`
                INSERT INTO wealth_snapshots (id, user_id, month, usd_rate, total_net_worth_myr, estimated_apr_myr, weighted_roi, created_at)
                VALUES (?, ?, ?, ?, 0, 0, 0, datetime('now'))
            `).bind(snapId, currentUser.id, month, usdRate).run();
            snap = { id: snapId, month, usd_rate: usdRate };
        }
        return snap;
    }

    // Helper: Recalculate totals for snapshot
    async function recalculateSnapshot(snapshotId, usdRate) {
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

        return { totalMyr, totalAprMyr, weightedRoi };
    }

    // GET /api/wealth/portfolio?month=YYYY-MM
    if (method === 'GET') {
        try {
            const snap = await db.prepare(
                "SELECT id, month, usd_rate FROM wealth_snapshots WHERE user_id = ? AND month = ?"
            ).bind(currentUser.id, month).first();

            if (!snap) {
                return json({ month, accounts: [], usd_rate: 4.08 });
            }

            const itemsRes = await db.prepare(`
                SELECT id, platform, product, category, currency, amount, amount_myr, apr, apr_amount_myr
                FROM wealth_snapshot_items
                WHERE snapshot_id = ?
                ORDER BY platform ASC, product ASC
            `).bind(snap.id).all();

            return json({
                month,
                usd_rate: snap.usd_rate,
                accounts: itemsRes.results || []
            });
        } catch (e) {
            return error("Failed to fetch month portfolio", 500);
        }
    }

    // POST /api/wealth/portfolio?month=YYYY-MM (Add asset to this month)
    if (method === 'POST') {
        try {
            const body = await request.json();
            const targetMonth = (body.month && /^\d{4}-\d{2}$/.test(body.month)) ? body.month : month;

            const platform = typeof body.platform === 'string' ? body.platform.trim().substring(0, 50) : '';
            const product = typeof body.product === 'string' ? body.product.trim().substring(0, 50) : '';
            const rawCategory = typeof body.category === 'string' ? body.category.toLowerCase().trim() : 'bank';
            const category = VALID_CATEGORIES.includes(rawCategory) ? rawCategory : 'bank';
            const currency = (body.currency || 'MYR').toString().toUpperCase().trim().substring(0, 10);
            const amount = Math.max(0, Number(body.amount) || 0);
            const apr = Math.max(0, Number(body.apr) || 0);

            if (!platform || !product) {
                return error("Platform and Product names are required", 400);
            }

            const settings = await db.prepare("SELECT default_usd_rate FROM wealth_settings WHERE user_id = ?").bind(currentUser.id).first();
            const rate = Number(settings?.default_usd_rate) || 4.08;
            const snap = await getOrCreateSnapshot(rate);

            const convRate = currency === 'USD' ? snap.usd_rate : 1.0;
            const amountMyr = Math.round(amount * convRate * 100) / 100;
            const aprAmountMyr = Math.round(((amountMyr * apr) / 100) * 100) / 100;

            const itemId = 'sni_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);

            await db.prepare(`
                INSERT INTO wealth_snapshot_items (id, snapshot_id, platform, product, category, currency, amount, amount_myr, apr, apr_amount_myr)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(itemId, snap.id, platform, product, category, currency, amount, amountMyr, apr, aprAmountMyr).run();

            await recalculateSnapshot(snap.id, snap.usd_rate);

            return json({
                success: true,
                month: targetMonth,
                account: {
                    id: itemId,
                    platform,
                    product,
                    category,
                    currency,
                    amount,
                    amount_myr: amountMyr,
                    apr,
                    apr_amount_myr: aprAmountMyr
                }
            });
        } catch (e) {
            return error("Failed to add asset to month", 500);
        }
    }

    return error("Method not allowed", 405);
}
