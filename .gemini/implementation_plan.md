# Supabase User System Implementation Plan

## Overview
Add user authentication (Supabase Auth), API key management, and usage tracking to LogExplain.

## Architecture

### Database Schema (Supabase)
1. **profiles** — extends Supabase auth.users
   - id (uuid, FK → auth.users)
   - email, full_name
   - created_at, updated_at

2. **api_keys** — user-generated API keys
   - id (uuid, PK)
   - user_id (uuid, FK → profiles)
   - key_hash (text) — SHA-256 hash of the key (stored securely)
   - key_prefix (text) — first 8 chars for display (le_xxxxxxxx...)
   - name (text) — user-defined label
   - is_active (boolean)
   - created_at, expires_at, last_used_at

3. **api_usage** — per-request usage log
   - id (uuid, PK)
   - api_key_id (uuid, FK → api_keys)
   - endpoint (text)
   - status_code (int)
   - response_time_ms (int)
   - created_at (timestamptz)

### Backend Changes
1. Install @supabase/supabase-js
2. Create SupabaseModule (service for DB access)
3. Refactor ApiKeyGuard to validate against Supabase api_keys table
4. Add UsageInterceptor to log every API call
5. Create UserController (profile, keys, usage endpoints)

### Frontend Changes
1. Add auth pages (login, register) to public/
2. Add dashboard page (profile, API keys, usage charts)
3. Protected routes using Supabase Auth JS client

## Implementation Order
1. Supabase setup + tables + RLS
2. Backend: SupabaseModule + refactored guard
3. Backend: User/key/usage endpoints
4. Frontend: Auth pages + Dashboard
