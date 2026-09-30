/**
 * functions/api/_utils.js
 * Native Web Crypto security utilities and D1 session handlers for Cloudflare Workers.
 * Zero npm dependencies — runs directly in Cloudflare edge V8 isolate.
 */

export function json(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            // Restrict CORS to same origin only — no wildcard in production
            'Access-Control-Allow-Origin': 'same-origin',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'X-Content-Type-Options': 'nosniff',
            ...headers
        }
    });
}

export function error(message, status = 400) {
    // Never leak internal details — return only the message passed by the caller
    return json({ success: false, error: message }, status);
}

/**
 * Hash password with PBKDF2 HMAC-SHA256 (310,000 iterations — OWASP 2023 recommendation)
 */
export async function hashPassword(password, saltHex = null) {
    const enc = new TextEncoder();
    let saltBytes;
    if (saltHex) {
        saltBytes = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    } else {
        saltBytes = crypto.getRandomValues(new Uint8Array(32)); // 256-bit salt
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
            iterations: 310000,
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
 * Constant-time password comparison (prevent timing attacks)
 */
export async function verifyPassword(password, storedHash, storedSalt) {
    const { hash } = await hashPassword(password, storedSalt);
    // Constant-time comparison using crypto.subtle
    const enc = new TextEncoder();
    const a = enc.encode(hash);
    const b = enc.encode(storedHash);
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a[i] ^ b[i];
    }
    return diff === 0;
}

/**
 * Create a cryptographically random session token in D1
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
 * Extract authenticated user from request — validates against D1 session store only.
 * NO hardcoded credentials or token bypass — all auth goes through the database.
 */
export async function getUserFromRequest(request, db) {
    let token = null;

    // 1. Check Authorization: Bearer <token>
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const candidate = authHeader.substring(7).trim();
        if (candidate) token = candidate;
    }

    // 2. Check HttpOnly cookie: veyra_session=<token>
    if (!token) {
        const cookieHeader = request.headers.get('Cookie');
        if (cookieHeader) {
            const match = cookieHeader.match(/veyra_session=([a-zA-Z0-9_-]{16,64})/);
            if (match) token = match[1];
        }
    }

    if (!token || !db) return null;

    // Validate token format (alphanumeric up to 64 chars)
    if (!/^[a-zA-Z0-9_-]{16,64}$/.test(token)) return null;

    try {
        const row = await db.prepare(`
            SELECT u.id, u.username, u.email, u.display_name, u.role, u.status, u.plan_id, u.plan_expires_at, u.must_change_password
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.id = ? AND s.expires_at > datetime('now') AND u.status = 'active'
        `).bind(token).first();

        return row || null;
    } catch (e) {
        return null;
    }
}
