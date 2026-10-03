-- ==========================================================================
-- Cloudflare D1 SQLite Database Schema
-- Database configuration and bindings are managed by wrangler.toml
-- Admin Bootstrap: Configure via Cloudflare Pages Environment Variables:
--   ADMIN_INITIAL_USERNAME and ADMIN_INITIAL_PASSWORD
-- ==========================================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    password_plain TEXT DEFAULT NULL,
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
    ('lot_size_calculator', 'Position Size Calculator', 'public', 1),
    ('trading_journal', 'Trading Journal', 'members_only', 1),
    ('wealth_tracker', 'Wealth Tracker', 'members_only', 1);

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
    mood TEXT,
    market_condition TEXT,
    lessons TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, date)
);

-- 11. Trading Playbooks (Strategy rulebook & setup definitions)
CREATE TABLE IF NOT EXISTS playbooks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    market TEXT NOT NULL DEFAULT 'ALL',
    timeframe TEXT NOT NULL DEFAULT '5M',
    direction TEXT NOT NULL DEFAULT 'BOTH' CHECK (direction IN ('LONG', 'SHORT', 'BOTH')),
    rules TEXT,
    risk_model TEXT DEFAULT '1R',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    is_shared INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_playbooks_user ON playbooks(user_id);

-- 12. Notebook Entries (Trading psychology, mistakes, lessons, research)
CREATE TABLE IF NOT EXISTS notebook_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'mistakes', 'psychology', 'market', 'lessons')),
    tags TEXT,
    linked_trade_id TEXT,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notebook_user ON notebook_entries(user_id);

-- 13. Progress Tracker Goals
CREATE TABLE IF NOT EXISTS progress_goals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    metric_type TEXT NOT NULL,
    target_value REAL NOT NULL,
    current_value REAL NOT NULL DEFAULT 0.0,
    unit TEXT DEFAULT '%',
    deadline TEXT,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'achieved', 'behind')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_goals_user ON progress_goals(user_id);

-- 14. Broker Connections (Sync accounts)
CREATE TABLE IF NOT EXISTS broker_connections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    broker TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_number TEXT,
    status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'syncing', 'failed', 'disconnected')),
    last_sync TEXT,
    next_sync TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_broker_connections_user ON broker_connections(user_id);

-- ==========================================================================
-- 11. Wealth Tracker (Multi-tenant isolated by user_id)
-- ==========================================================================

-- Live Portfolio Holdings
CREATE TABLE IF NOT EXISTS wealth_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    product TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'bank' CHECK (category IN ('cash', 'bank', 'crypto', 'investment', 'trading')),
    currency TEXT NOT NULL DEFAULT 'MYR',
    amount REAL NOT NULL DEFAULT 0.0,
    apr REAL NOT NULL DEFAULT 0.0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_wealth_accounts_user ON wealth_accounts(user_id);

-- Monthly Net Worth Snapshots
CREATE TABLE IF NOT EXISTS wealth_snapshots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month TEXT NOT NULL,
    usd_rate REAL NOT NULL DEFAULT 4.08,
    total_net_worth_myr REAL NOT NULL DEFAULT 0.0,
    estimated_apr_myr REAL NOT NULL DEFAULT 0.0,
    weighted_roi REAL NOT NULL DEFAULT 0.0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, month)
);
CREATE INDEX IF NOT EXISTS idx_wealth_snapshots_user_month ON wealth_snapshots(user_id, month);

-- Monthly Snapshot Account Details
CREATE TABLE IF NOT EXISTS wealth_snapshot_items (
    id TEXT PRIMARY KEY,
    snapshot_id TEXT NOT NULL REFERENCES wealth_snapshots(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    product TEXT NOT NULL,
    category TEXT NOT NULL,
    currency TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0.0,
    amount_myr REAL NOT NULL DEFAULT 0.0,
    apr REAL NOT NULL DEFAULT 0.0,
    apr_amount_myr REAL NOT NULL DEFAULT 0.0
);
CREATE INDEX IF NOT EXISTS idx_wealth_snapshot_items_snap ON wealth_snapshot_items(snapshot_id);

-- Monthly Cashflows (Income & Expenses)
CREATE TABLE IF NOT EXISTS wealth_cashflows (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0.0,
    description TEXT,
    entry_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_wealth_cashflows_user_month ON wealth_cashflows(user_id, month);

-- User Wealth Settings
CREATE TABLE IF NOT EXISTS wealth_settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    default_usd_rate REAL NOT NULL DEFAULT 4.08,
    target_savings_rate REAL DEFAULT 40.0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ==========================================================================
-- Initial Administrator Bootstrap
-- DO NOT seed hardcoded credentials here. Instead:
-- 1. Deploy the Worker with ADMIN_USERNAME and ADMIN_PASSWORD set as
--    Cloudflare Worker Secrets (wrangler secret put ADMIN_USERNAME etc.).
-- 2. On first login with those credentials, the Worker auto-provisions
--    the admin account in D1 with a securely hashed password.
-- 3. After first login, delete the secrets from Cloudflare dashboard
--    (they are no longer needed).
-- ==========================================================================
