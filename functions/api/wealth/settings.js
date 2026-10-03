/**
 * /api/wealth/settings
 * User wealth configuration (USD rate, target savings rate)
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

    // GET /api/wealth/settings
    if (method === 'GET') {
        try {
            const settings = await db.prepare(
                "SELECT default_usd_rate, target_savings_rate FROM wealth_settings WHERE user_id = ?"
            ).bind(currentUser.id).first();

            return json({
                default_usd_rate: Number(settings?.default_usd_rate) || 4.08,
                target_savings_rate: Number(settings?.target_savings_rate) || 40.0
            });
        } catch (e) {
            return error("Failed to load settings", 500);
        }
    }

    // POST or PUT /api/wealth/settings
    if (method === 'POST' || method === 'PUT') {
        try {
            const body = await request.json();
            const defaultUsdRate = Math.max(0.1, Number(body.default_usd_rate) || 4.08);
            const targetSavingsRate = Math.max(0, Math.min(100, Number(body.target_savings_rate) || 40.0));

            await db.prepare(`
                INSERT INTO wealth_settings (user_id, default_usd_rate, target_savings_rate, updated_at)
                VALUES (?, ?, ?, datetime('now'))
                ON CONFLICT(user_id) DO UPDATE SET
                    default_usd_rate = excluded.default_usd_rate,
                    target_savings_rate = excluded.target_savings_rate,
                    updated_at = datetime('now')
            `).bind(currentUser.id, defaultUsdRate, targetSavingsRate).run();

            return json({
                success: true,
                settings: {
                    default_usd_rate: defaultUsdRate,
                    target_savings_rate: targetSavingsRate
                }
            });
        } catch (e) {
            return error("Failed to save settings", 500);
        }
    }

    return error("Method not allowed", 405);
}
