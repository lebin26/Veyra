/**
 * src/index.js
 * Universal Worker Entrypoint for Cloudflare Workers & Static Assets.
 * Routes /api/ calls directly to Cloudflare D1 and serves static frontend assets.
 */
import { onRequestPost as loginPost } from '../functions/api/auth/login.js';
import { onRequestGet as meGet } from '../functions/api/auth/me.js';
import { onRequestPost as logoutPost } from '../functions/api/auth/logout.js';
import { onRequestPost as changePasswordPost } from '../functions/api/auth/change-password.js';
import { onRequest as adminUsersHandler } from '../functions/api/admin/users.js';
import { onRequest as tradesIndexHandler } from '../functions/api/trades/index.js';
import { onRequest as singleTradeHandler } from '../functions/api/trades/[id].js';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const context = { request, env, ctx, params: {} };

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Max-Age': '86400'
                }
            });
        }

        // Authentication Endpoints
        if (path === '/api/auth/login' && request.method === 'POST') {
            return loginPost(context);
        }
        if (path === '/api/auth/me' && request.method === 'GET') {
            return meGet(context);
        }
        if (path === '/api/auth/logout' && request.method === 'POST') {
            return logoutPost(context);
        }
        if (path === '/api/auth/change-password' && request.method === 'POST') {
            return changePasswordPost(context);
        }

        // Admin Management Endpoint
        if (path === '/api/admin/users') {
            return adminUsersHandler(context);
        }

        // Trades Endpoints
        if (path === '/api/trades') {
            return tradesIndexHandler(context);
        }
        const tradeMatch = path.match(/^\/api\/trades\/([^/]+)$/);
        if (tradeMatch) {
            context.params.id = tradeMatch[1];
            return singleTradeHandler(context);
        }

        // Default redirect from / to /main-page/index.html
        if (path === '/' || path === '/index.html') {
            if (env.ASSETS) {
                const mainPageReq = new Request(new URL('/main-page/index.html', request.url), request);
                return env.ASSETS.fetch(mainPageReq);
            }
        }

        // Serve Static Frontend Assets (HTML, CSS, JS) via Cloudflare Workers Assets
        if (env.ASSETS) {
            return env.ASSETS.fetch(request);
        }

        return new Response('Not found', { status: 404 });
    }
};
