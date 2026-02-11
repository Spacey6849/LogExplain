-- ═══════════════════════════════════════════════════════════════
-- LogExplain — Supabase Database Setup
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────
-- 1. Profiles table (extends auth.users)
-- ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       TEXT NOT NULL DEFAULT '',
    full_name   TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ────────────────────────────────────────────────────
-- 2. API Keys table
-- ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_keys (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    key_hash     TEXT NOT NULL UNIQUE,      -- SHA-256 hash of the actual key
    key_prefix   TEXT NOT NULL,             -- First 11 chars for display (le_xxxxxxxx)
    name         TEXT NOT NULL DEFAULT 'Default Key',
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    expires_at   TIMESTAMPTZ               -- NULL = never expires
);

-- Index for fast key lookups during API auth
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.api_keys(user_id);

-- ────────────────────────────────────────────────────
-- 3. API Usage table
-- ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_usage (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id       UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
    endpoint         TEXT NOT NULL,
    status_code      INTEGER NOT NULL,
    response_time_ms INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for usage queries
CREATE INDEX IF NOT EXISTS idx_api_usage_key     ON public.api_usage(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created ON public.api_usage(created_at);

-- ────────────────────────────────────────────────────
-- 4. Row Level Security (RLS)
-- ────────────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE public.profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- API Keys: users can CRUD their own keys
CREATE POLICY "Users can view own API keys"
    ON public.api_keys FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create API keys"
    ON public.api_keys FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API keys"
    ON public.api_keys FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own API keys"
    ON public.api_keys FOR DELETE
    USING (auth.uid() = user_id);

-- API Usage: users can view usage for their own keys
CREATE POLICY "Users can view own usage"
    ON public.api_usage FOR SELECT
    USING (
        api_key_id IN (
            SELECT id FROM public.api_keys WHERE user_id = auth.uid()
        )
    );

-- Service role can do everything (used by our API backend)
-- No additional policies needed — service_role bypasses RLS.

-- ────────────────────────────────────────────────────
-- Done! ✅
-- ────────────────────────────────────────────────────
