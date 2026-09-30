/**
 * functions/api/_utils.js
 * Native Web Crypto security utilities and D1 session handlers for Cloudflare Pages.
 * Zero npm dependencies, runs directly in Cloudflare edge V8 isolate.
 */

export function json(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            ...headers
        }
    });
}

export function error(message, status = 400) {
    return json({ success: false, error: message }, status);
}

/**
 * Hash password with PBKDF2 HMAC-SHA256 (100,000 iterations)
 */
export async function hashPassword(password, saltHex = null) {
    const enc = new TextEncoder();
    let saltBytes;
    if (saltHex) {
        saltBytes = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    } else {
        saltBytes = crypto.getRandomValues(new Uint8Array(16));
    }

    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
    );

    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt: saltBytes,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        256
    );

    const hash = Array.from(new Uint8Array(derivedBits))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    const salt = Array.from(saltBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    return { hash, salt };
}

/**
 * Verify password against stored hash and salt
 */
export async function verifyPassword(password, storedHash, storedSalt) {
    const { hash } = await hashPassword(password, storedSalt);
    return hash === storedHash;
}

/**
 * Create a session token in D1
 */
export async function createSession(db, userId, days = 30) {
    const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    const expiresAt = expiryDate.toISOString();

    await db.prepare(
        "INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, datetime('now'))"
    ).bind(token, userId, expiresAt).run();

    return { token, expiresAt };
}

/**
 * Extract authenticated user and profile from request
 */
export async function getUserFromRequest(request, db) {
    if (!db) return null;

    let token = null;

    // 1. Check Authorization: Bearer <token>
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
    }

    // 2. Check Cookie: veyra_session=<token>
    if (!token) {
        const cookieHeader = request.headers.get('Cookie');
        if (cookieHeader) {
            const match = cookieHeader.match(/veyra_session=([a-f0-9]{64})/);
            if (match) token = match[1];
        }
    }

    if (!token) return null;

    // Look up session and active user in D1
    const row = await db.prepare(`
        SELECT u.id, u.username, u.email, u.display_name, u.role, u.status, u.plan_id, u.plan_expires_at, u.must_change_password
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = ? AND s.expires_at > datetime('now')
    `).bind(token).first();

    return row || null;
}
