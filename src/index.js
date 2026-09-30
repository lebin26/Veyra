/**
 * src/index.js
 * Universal Worker Entrypoint for Cloudflare Workers & Static Assets.
 * Routes /api/ calls directly to Cloudflare D1 and serves static frontend assets.
 * Security: Adds security headers to all responses, restricts CORS to same-origin.
 */
import { onRequestPost as loginPost } from '../functions/api/auth/login.js';
import { onRequestGet as meGet } from '../functions/api/auth/me.js';
import { onRequestPost as logoutPost } from '../functions/api/auth/logout.js';
import { onRequestPost as changePasswordPost } from '../functions/api/auth/change-password.js';
import { onRequest as adminUsersHandler } from '../functions/api/admin/users.js';
import { onRequest as tradesIndexHandler } from '../functions/api/trades/index.js';
import { onRequest as singleTradeHandler } from '../functions/api/trades/[id].js';

// Security headers applied to all responses
const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '0', // CSP replaces this
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'"
    ].join('; ')
};

function addSecurityHeaders(response) {
    const newHeaders = new Headers(response.headers);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
        newHeaders.set(k, v);
    }
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
    });
}

// Known /api/ paths — reject everything else at the Worker level
const API_PATHS = new Set([
    '/api/auth/login',
    '/api/auth/me',
    '/api/auth/logout',
    '/api/auth/change-password',
    '/api/admin/users',
    '/api/admin/app-overrides',
    '/api/trades'
]);

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const context = { request, env, ctx, params: {} };

        // Block CORS preflight with same-origin policy
        // API routes only accept requests from the same origin
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': url.origin,
                    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Max-Age': '3600',
                    'Vary': 'Origin'
                }
            });
        }

        // Block all /api/ paths not in the known whitelist
        if (path.startsWith('/api/')) {
            const tradeIdMatch = path.match(/^\/api\/trades\/([a-zA-Z0-9_\-]{1,80})$/);

            if (path === '/api/auth/login' && request.method === 'POST') {
                return addSecurityHeaders(await loginPost(context));
            }
            if (path === '/api/auth/me' && request.method === 'GET') {
                return addSecurityHeaders(await meGet(context));
            }
            if (path === '/api/auth/logout' && request.method === 'POST') {
                return addSecurityHeaders(await logoutPost(context));
            }
            if (path === '/api/auth/change-password' && request.method === 'POST') {
                return addSecurityHeaders(await changePasswordPost(context));
            }
            if (path === '/api/admin/users') {
                return addSecurityHeaders(await adminUsersHandler(context));
            }
            if (path === '/api/trades') {
                return addSecurityHeaders(await tradesIndexHandler(context));
            }
            if (tradeIdMatch) {
                context.params.id = tradeIdMatch[1];
                return addSecurityHeaders(await singleTradeHandler(context));
            }

            // Any unmatched /api/ path → 404
            return new Response(JSON.stringify({ error: 'Not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Serve /main-page/index.html at root
        if (path === '/' || path === '/index.html') {
            if (env.ASSETS) {
                const mainPageReq = new Request(new URL('/main-page/index.html', request.url), request);
                const resp = await env.ASSETS.fetch(mainPageReq);
                return addSecurityHeaders(resp);
            }
        }

        // Serve static frontend assets via Cloudflare Workers Assets
        if (env.ASSETS) {
            const resp = await env.ASSETS.fetch(request);
            // Add security headers to HTML pages only
            const contentType = resp.headers.get('Content-Type') || '';
            if (contentType.includes('text/html')) {
                return addSecurityHeaders(resp);
            }
            return resp;
        }

        return new Response('Not found', { status: 404 });
    }
};
