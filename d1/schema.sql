-- ==========================================================================
-- Cloudflare D1 SQLite Database Schema
-- Database ID: 0f431065-816e-41e4-b428-43d59ac1a090
-- Pre-seeded Admin: lebin26 (Password: 12141214@Aa, Role: admin, Plan: pro)
-- ==========================================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    plan_id TEXT NOT NULL DEFAULT 'pro',
    plan_expires_at TEXT DEFAULT NULL,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. Sessions Table (Stateful token sessions for instant revocation)
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- 3. Apps Registry
CREATE TABLE IF NOT EXISTS apps (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    access_level TEXT NOT NULL DEFAULT 'members_only' CHECK (access_level IN ('public', 'members_only')),
    is_active INTEGER NOT NULL DEFAULT 1
);

INSERT OR IGNORE INTO apps (key, name, access_level, is_active) VALUES
    ('lot_size_calculator', 'Lot Size Calculator', 'public', 1),
    ('trading_journal', 'Trading Journal', 'members_only', 1);

-- 4. User App Overrides (Admin Entitlements)
CREATE TABLE IF NOT EXISTS user_app_overrides (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    app_key TEXT NOT NULL REFERENCES apps(key) ON DELETE CASCADE,
    is_enabled INTEGER DEFAULT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, app_key)
);

-- 5. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT,
    target_user_id TEXT,
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. Trades (Multi-tenant isolated by user_id and mode: live vs backtest)
CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode TEXT NOT NULL DEFAULT 'live' CHECK (mode IN ('live', 'backtest')),
    book_id TEXT,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL', 'LONG', 'SHORT')),
    entry_price REAL NOT NULL,
    exit_price REAL NOT NULL,
    lot_size REAL NOT NULL,
    pnl REAL NOT NULL,
    pnl_percentage REAL,
    entry_time TEXT NOT NULL,
    exit_time TEXT NOT NULL,
    strategy TEXT,
    notes TEXT,
    tags TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trades_user_mode ON trades(user_id, mode);
CREATE INDEX IF NOT EXISTS idx_trades_entry_time ON trades(entry_time);

-- 7. Trade Screenshots
CREATE TABLE IF NOT EXISTS trade_screenshots (
    id TEXT PRIMARY KEY,
    trade_id TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    caption TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_screenshots_trade ON trade_screenshots(trade_id);

-- 8. Backtest Books
CREATE TABLE IF NOT EXISTS backtest_books (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    initial_capital REAL NOT NULL DEFAULT 10000.0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 9. Trading Strategies
CREATE TABLE IF NOT EXISTS strategies (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    rules TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 10. Daily Journals
CREATE TABLE IF NOT EXISTS daily_journals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    pre_market_notes TEXT,
    post_market_notes TEXT,
    daily_rating INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, date)
);

-- ==========================================================================
-- Seed Initial Administrator Account: lebin26 (12141214@Aa)
-- Salt: e2f3089e417bad4111ad52983e4af032
-- PBKDF2-SHA256 (100k iters): ff7d0398cfb196ac58481c63adb544b20a5b8e62f14561605f43669d9eeb4add
-- ==========================================================================
INSERT INTO users (
    id,
    username,
    email,
    password_hash,
    password_salt,
    display_name,
    role,
    status,
    plan_id,
    must_change_password,
    created_at,
    updated_at
) VALUES (
    'usr_admin_lebin26',
    'lebin26',
    'lebin26@veyra.app',
    'ff7d0398cfb196ac58481c63adb544b20a5b8e62f14561605f43669d9eeb4add',
    'e2f3089e417bad4111ad52983e4af032',
    'lebin26',
    'admin',
    'active',
    'pro',
    0,
    datetime('now'),
    datetime('now')
)
ON CONFLICT(username) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    password_salt = EXCLUDED.password_salt,
    role = 'admin',
    status = 'active',
    plan_id = 'pro',
    must_change_password = 0,
    updated_at = datetime('now');
