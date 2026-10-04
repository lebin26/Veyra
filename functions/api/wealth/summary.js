/**
 * /api/wealth/summary
 * Month-Centric Master Aggregator for Wealth Tracker (Cloudflare D1)
 * Supports monthly statistics, fine-tuning, and historical archiving.
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

    if (request.method !== 'GET') {
        return error("Method not allowed", 405);
    }

    try {
        const url = new URL(request.url);
        const now = new Date();
        const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const rawMonth = url.searchParams.get('month');
        const month = (rawMonth && /^\d{4}-\d{2}$/.test(rawMonth)) ? rawMonth : defaultMonth;

        // 1. User Settings & Live Query Rate
        const settings = await db.prepare(
            "SELECT default_usd_rate, target_savings_rate FROM wealth_settings WHERE user_id = ?"
        ).bind(currentUser.id).first();
        const rawRate = Number(url.searchParams.get('rate'));
        const queryRate = (rawRate && Number.isFinite(rawRate) && rawRate > 0) ? rawRate : null;
        const baseUsdRate = queryRate || Number(settings?.default_usd_rate) || 4.08;
        const targetSavingsRate = Number(settings?.target_savings_rate) || 40.0;

        // 2. Fetch all recorded snapshot months for this user (Archives list)
        const allSnapshotsRes = await db.prepare(`
            SELECT id, month, usd_rate, total_net_worth_myr, estimated_apr_myr, weighted_roi, notes, created_at
            FROM wealth_snapshots
            WHERE user_id = ?
            ORDER BY month ASC
        `).bind(currentUser.id).all();

        const allSnapshots = allSnapshotsRes.results || [];
        const availableMonths = allSnapshots.map(s => s.month);

        // 3. Find snapshot for the requested month
        let currentSnapshot = allSnapshots.find(s => s.month === month) || null;
        let accounts = [];
        let usdRate = currentSnapshot ? currentSnapshot.usd_rate : baseUsdRate;
        let totalNetWorthMyr = currentSnapshot ? currentSnapshot.total_net_worth_myr : 0;
        let totalEstimatedAprMyr = currentSnapshot ? currentSnapshot.estimated_apr_myr : 0;
        let weightedRoi = currentSnapshot ? currentSnapshot.weighted_roi : 0;

        if (currentSnapshot) {
            // Read items from snapshot
            const itemsRes = await db.prepare(`
                SELECT id, platform, product, category, currency, amount, amount_myr, apr, apr_amount_myr
                FROM wealth_snapshot_items
                WHERE snapshot_id = ?
                ORDER BY platform ASC, product ASC
            `).bind(currentSnapshot.id).all();

            accounts = (itemsRes.results || []).map(r => ({
                id: r.id,
                platform: r.platform,
                product: r.product,
                category: r.category,
                currency: r.currency,
                amount: Number(r.amount) || 0,
                amount_myr: Number(r.amount_myr) || 0,
                apr: Number(r.apr) || 0,
                apr_amount_myr: Number(r.apr_amount_myr) || 0
            }));
        } else {
            // Check if there are live accounts to seed this month
            const liveRes = await db.prepare(`
                SELECT id, platform, product, category, currency, amount, apr, notes
                FROM wealth_accounts
                WHERE user_id = ?
                ORDER BY platform ASC, product ASC
            `).bind(currentUser.id).all();

            if (liveRes.results && liveRes.results.length > 0) {
                accounts = liveRes.results.map(r => {
                    const amt = Number(r.amount) || 0;
                    const apr = Number(r.apr) || 0;
                    const rate = r.currency === 'USD' ? usdRate : 1.0;
                    const myr = Math.round(amt * rate * 100) / 100;
                    const aprAmt = Math.round(((myr * apr) / 100) * 100) / 100;
                    totalNetWorthMyr += myr;
                    totalEstimatedAprMyr += aprAmt;
                    return {
                        id: r.id,
                        platform: r.platform,
                        product: r.product,
                        category: r.category,
                        currency: r.currency,
                        amount: amt,
                        amount_myr: myr,
                        apr,
                        apr_amount_myr: aprAmt
                    };
                });
                totalNetWorthMyr = Math.round(totalNetWorthMyr * 100) / 100;
                totalEstimatedAprMyr = Math.round(totalEstimatedAprMyr * 100) / 100;
                weightedRoi = totalNetWorthMyr > 0 ? Math.round(((totalEstimatedAprMyr / totalNetWorthMyr) * 100) * 100) / 100 : 0;
            }
        }

        // 4. Breakdown computation for charts
        const categoryMap = {};
        const platformMap = {};
        accounts.forEach(a => {
            const cat = a.category || 'bank';
            categoryMap[cat] = (categoryMap[cat] || 0) + a.amount_myr;
            const plat = a.platform || 'Other';
            platformMap[plat] = (platformMap[plat] || 0) + a.amount_myr;
        });

        const categoryBreakdown = Object.entries(categoryMap).map(([cat, val]) => ({
            category: cat,
            amount_myr: Math.round(val * 100) / 100,
            percentage: totalNetWorthMyr > 0 ? Math.round(((val / totalNetWorthMyr) * 100) * 10) / 10 : 0
        })).sort((a,b) => b.amount_myr - a.amount_myr);

        const platformBreakdown = Object.entries(platformMap).map(([plat, val]) => ({
            platform: plat,
            amount_myr: Math.round(val * 100) / 100,
            percentage: totalNetWorthMyr > 0 ? Math.round(((val / totalNetWorthMyr) * 100) * 10) / 10 : 0
        })).sort((a,b) => b.amount_myr - a.amount_myr);

        const topApr = [...accounts].filter(a => a.apr > 0 && a.amount_myr > 0).sort((a,b) => b.apr - a.apr).slice(0, 3);

        // 5. Growth vs Previous Month
        const previousSnapshot = allSnapshots.filter(s => s.month < month).sort((a,b) => b.month.localeCompare(a.month))[0] || null;
        let deltaRm = 0;
        let growthRate = 0;
        if (previousSnapshot && previousSnapshot.total_net_worth_myr > 0 && totalNetWorthMyr > 0) {
            deltaRm = Math.round((totalNetWorthMyr - previousSnapshot.total_net_worth_myr) * 100) / 100;
            growthRate = Math.round(((deltaRm / previousSnapshot.total_net_worth_myr) * 100) * 100) / 100;
        }

        const isCurrentMonth = month === defaultMonth;
        const isArchived = !isCurrentMonth && currentSnapshot !== null;
        const needsInit = accounts.length === 0;

        return json({
            month,
            is_current_month: isCurrentMonth,
            is_archived: isArchived,
            needs_init: needsInit,
            usd_rate: usdRate,
            available_months: availableMonths,
            last_recorded_month: previousSnapshot ? previousSnapshot.month : null,
            portfolio: {
                total_net_worth_myr: totalNetWorthMyr,
                estimated_apr_myr: totalEstimatedAprMyr,
                weighted_roi: weightedRoi,
                accounts_count: accounts.length,
                accounts
            },
            growth: {
                delta_rm: deltaRm,
                growth_rate: growthRate,
                previous_month: previousSnapshot ? previousSnapshot.month : null,
                previous_net_worth: previousSnapshot ? previousSnapshot.total_net_worth_myr : null
            },
            analytics: {
                category_breakdown: categoryBreakdown,
                platform_breakdown: platformBreakdown,
                history_snapshots: allSnapshots
            },
            insights: {
                top_apr_contributors: topApr
            }
        });
    } catch (e) {
        return error("Failed to compile month summary", 500);
    }
}
