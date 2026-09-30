-- ==========================================================================
-- Migration: 0001_initial_schema.sql
-- Veyra Trading System - Multi-tenant Security & RBAC Schema
-- Target: Supabase (PostgreSQL 15+)
-- ==========================================================================

-- Enable pgcrypto extension for UUIDs and secure cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------------------------
-- 1. Helper Security Functions (SECURITY DEFINER to avoid RLS recursion)
-- --------------------------------------------------------------------------

-- Check if current authenticated user is an active Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
  );
$$;

-- --------------------------------------------------------------------------
-- 2. Profiles Table (1-to-1 extension of Supabase auth.users)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    username TEXT UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    plan_id TEXT NOT NULL DEFAULT 'free',
    plan_expires_at TIMESTAMPTZ DEFAULT NULL, -- NULL = Lifetime/Never expires
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(lower(username));
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_plan_id ON public.profiles(plan_id);

-- --------------------------------------------------------------------------
-- 3. Three-Tier Entitlements Model: Plans, Apps, and Overrides
-- --------------------------------------------------------------------------

-- Tier 2: Plans Definition Table (Ready for Stripe / Payment integration)
CREATE TABLE IF NOT EXISTS public.plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tier 3: Sub-Apps Registry Table
CREATE TABLE IF NOT EXISTS public.apps (
    key TEXT PRIMARY KEY, -- 'lot_size_calculator', 'trading_journal', etc.
    name TEXT NOT NULL,
    access_level TEXT NOT NULL DEFAULT 'members_only' CHECK (access_level IN ('public', 'members_only')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default Entitlements per Plan
CREATE TABLE IF NOT EXISTS public.plan_app_entitlements (
    plan_id TEXT NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
    app_key TEXT NOT NULL REFERENCES public.apps(key) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    max_trades INTEGER DEFAULT NULL,       -- NULL = Unlimited
    max_storage_mb INTEGER DEFAULT NULL,   -- Screenshot storage allowance in MB (NULL = Unlimited)
    PRIMARY KEY (plan_id, app_key)
);

-- User-level Overrides by Admin (Highest Precedence)
CREATE TABLE IF NOT EXISTS public.user_app_overrides (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    app_key TEXT NOT NULL REFERENCES public.apps(key) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT NULL,       -- NULL = Inherit Plan, TRUE/FALSE = Explicit override
    custom_max_trades INTEGER DEFAULT NULL,
    custom_storage_mb INTEGER DEFAULT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, app_key)
);

-- --------------------------------------------------------------------------
-- 4. Initial Seed Data: Plans & Sub-Apps
-- --------------------------------------------------------------------------
INSERT INTO public.plans (id, name, description, is_active) VALUES
    ('free', 'Free Member', 'Basic access to core risk calculations and sample tracking', TRUE),
    ('pro', 'Pro Trader', 'Unlimited journal logging, backtesting books, and cloud screenshots', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.apps (key, name, access_level, is_active) VALUES
    ('lot_size_calculator', 'Position Size Calculator', 'public', TRUE),
    ('trading_journal', 'Trading Journal & Backtesting', 'members_only', TRUE),
    ('risk_planner', 'Risk Planner', 'members_only', TRUE),
    ('market_radar', 'Market Radar', 'members_only', TRUE)
ON CONFLICT (key) DO NOTHING;

-- Default entitlements: Free vs Pro
INSERT INTO public.plan_app_entitlements (plan_id, app_key, is_enabled, max_trades, max_storage_mb) VALUES
    ('free', 'lot_size_calculator', TRUE, NULL, NULL),
    ('free', 'trading_journal', TRUE, 50, 20),
    ('free', 'risk_planner', FALSE, NULL, NULL),
    ('free', 'market_radar', FALSE, NULL, NULL),
    ('pro', 'lot_size_calculator', TRUE, NULL, NULL),
    ('pro', 'trading_journal', TRUE, NULL, 500),
    ('pro', 'risk_planner', TRUE, NULL, NULL),
    ('pro', 'market_radar', TRUE, NULL, NULL)
ON CONFLICT (plan_id, app_key) DO NOTHING;

-- --------------------------------------------------------------------------
-- 5. Audit Logging Table
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'user_created', 'plan_changed', 'status_changed', 'session_revoked', 'password_reset_issued', etc.
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- --------------------------------------------------------------------------
-- 6. Multi-Tenant Trading Data Tables (Multi-User Partitioning with strict user_id)
-- --------------------------------------------------------------------------

-- Trades Table (Strictly partitioned by mode: 'live' or 'backtest')
CREATE TABLE IF NOT EXISTS public.trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('live', 'backtest')),
    book_id UUID DEFAULT NULL,
    date TIMESTAMPTZ NOT NULL,
    symbol TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('long', 'short')),
    entry_price NUMERIC,
    exit_price NUMERIC,
    lots NUMERIC,
    pnl NUMERIC,
    r_multiple NUMERIC,
    commission NUMERIC DEFAULT 0,
    setup TEXT,
    strategy_id UUID DEFAULT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trades_user_mode ON public.trades(user_id, mode);
CREATE INDEX IF NOT EXISTS idx_trades_user_date ON public.trades(user_id, date DESC);

-- Trade Screenshots Table (Storage metadata, file stored in private S3 bucket)
CREATE TABLE IF NOT EXISTS public.trade_screenshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id UUID NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL, -- e.g. "{user_id}/{mode}/{trade_id}/{uuid}.jpg"
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_screenshots_trade ON public.trade_screenshots(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_screenshots_user ON public.trade_screenshots(user_id);

-- Backtest Books Table
CREATE TABLE IF NOT EXISTS public.backtest_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    initial_balance NUMERIC DEFAULT 10000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backtest_books_user ON public.backtest_books(user_id);

-- Strategies Table
CREATE TABLE IF NOT EXISTS public.strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    rules JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strategies_user ON public.strategies(user_id);

-- Daily Journals Table
CREATE TABLE IF NOT EXISTS public.daily_journals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    pre_market_notes TEXT,
    post_market_notes TEXT,
    daily_rating INTEGER CHECK (daily_rating BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_journals_user_date ON public.daily_journals(user_id, date DESC);

-- --------------------------------------------------------------------------
-- 7. Automatic Profile Creation Trigger on Supabase User Signup/Invite
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    is_first_user BOOLEAN;
    user_role TEXT := 'user';
BEGIN
    -- If there are no users in profiles, make the very first user the admin
    SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO is_first_user;
    IF is_first_user THEN
        user_role := 'admin';
    END IF;

    INSERT INTO public.profiles (
        id, 
        email, 
        username,
        display_name, 
        role, 
        status, 
        plan_id, 
        must_change_password
    )
    VALUES (
        new.id,
        new.email,
        lower(COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))),
        COALESCE(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
        user_role,
        'active',
        CASE WHEN user_role = 'admin' THEN 'pro' ELSE 'free' END,
        COALESCE((new.raw_user_meta_data->>'must_change_password')::boolean, FALSE)
    );
    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- --------------------------------------------------------------------------
-- 8. Row Level Security (RLS) Policies
-- --------------------------------------------------------------------------

-- Enable RLS across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_app_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_app_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backtest_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_journals ENABLE ROW LEVEL SECURITY;

-- 8.1 PROFILES POLICIES
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update own display_name"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id OR public.is_admin())
    WITH CHECK (auth.uid() = id OR public.is_admin());

CREATE POLICY "Admins have full access to profiles"
    ON public.profiles FOR ALL
    USING (public.is_admin());

-- 8.2 PLANS & APPS (Public read for active plans/apps)
CREATE POLICY "Anyone can view active plans"
    ON public.plans FOR SELECT
    USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "Anyone can view active apps"
    ON public.apps FOR SELECT
    USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "Anyone can view plan entitlements"
    ON public.plan_app_entitlements FOR SELECT
    USING (TRUE);

CREATE POLICY "Admins can manage plans and apps"
    ON public.plans FOR ALL
    USING (public.is_admin());

CREATE POLICY "Admins can manage app catalog"
    ON public.apps FOR ALL
    USING (public.is_admin());

CREATE POLICY "Admins can manage plan entitlements"
    ON public.plan_app_entitlements FOR ALL
    USING (public.is_admin());

CREATE POLICY "Users can view own overrides"
    ON public.user_app_overrides FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admins can manage user overrides"
    ON public.user_app_overrides FOR ALL
    USING (public.is_admin());

-- 8.3 AUDIT LOGS (Admin only read/write)
CREATE POLICY "Admins can view audit logs"
    ON public.audit_logs FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Admins and service role can insert audit logs"
    ON public.audit_logs FOR INSERT
    WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

-- 8.4 USER TRADING DATA (Airtight Isolation via auth.uid() = user_id)
CREATE POLICY "Users own their trades"
    ON public.trades FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users own their trade screenshots"
    ON public.trade_screenshots FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users own their backtest books"
    ON public.backtest_books FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users own their strategies"
    ON public.strategies FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users own their daily journals"
    ON public.daily_journals FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- 9. Storage Bucket Configuration (SQL setup for Supabase Storage)
-- --------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) 
VALUES ('journal-screenshots', 'journal-screenshots', FALSE)
ON CONFLICT (id) DO UPDATE SET public = FALSE;

-- Storage RLS: Users can only upload, read, and delete within their own user_id directory
CREATE POLICY "User Screenshots Upload Policy"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'journal-screenshots' 
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "User Screenshots Read Policy"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'journal-screenshots' 
        AND (
            (storage.foldername(name))[1] = auth.uid()::text
            OR public.is_admin()
        )
    );

CREATE POLICY "User Screenshots Delete Policy"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'journal-screenshots' 
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
