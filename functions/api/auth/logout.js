/**
 * POST /api/auth/logout
 * Destroys session in Cloudflare D1 and clears cookie.
 */
import { json } from '../_utils.js';

export async function onRequestPost(context) {
    const { request, env } = context;
    const db = env.DB;

    try {
        let token = null;
        const authHeader = request.headers.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7).trim();
        }
        if (!token) {
            const cookieHeader = request.headers.get('Cookie');
            if (cookieHeader) {
                const match = cookieHeader.match(/veyra_session=([a-f0-9]{64})/);
                if (match) token = match[1];
            }
        }

        if (token && db) {
            await db.prepare("DELETE FROM sessions WHERE id = ?").bind(token).run();
        }

        return json({ success: true }, 200, {
            'Set-Cookie': 'veyra_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure'
        });
    } catch (e) {
        return json({ success: true });
    }
}
