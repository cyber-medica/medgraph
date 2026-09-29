\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS public.internal_users (
  id uuid PRIMARY KEY,
  normalized_email text NOT NULL UNIQUE CHECK (
    normalized_email = lower(btrim(normalized_email))
    AND char_length(normalized_email) BETWEEN 3 AND 160
    AND normalized_email ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@cyber-medica\.ru$'
  ),
  role text NOT NULL CHECK (role IN ('admin', 'reviewer')),
  display_name text CHECK (
    display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 160
  ),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.internal_login_challenges (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.internal_users(id),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at),
  CHECK (expires_at <= created_at + interval '15 minutes'),
  CHECK (used_at IS NULL OR used_at >= created_at)
);

CREATE TABLE IF NOT EXISTS public.internal_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.internal_users(id),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at),
  CHECK (expires_at <= created_at + interval '12 hours'),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE TABLE IF NOT EXISTS public.internal_auth_audit (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES public.internal_users(id),
  event_type text NOT NULL CHECK (char_length(event_type) BETWEEN 1 AND 80),
  session_id uuid REFERENCES public.internal_sessions(id),
  target text CHECK (target IS NULL OR char_length(target) BETWEEN 1 AND 200),
  result text NOT NULL CHECK (result IN ('allowed', 'denied', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS internal_login_challenges_user_created_idx
  ON public.internal_login_challenges (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS internal_sessions_user_active_idx
  ON public.internal_sessions (user_id, expires_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS internal_auth_audit_user_created_idx
  ON public.internal_auth_audit (user_id, created_at DESC);

REVOKE ALL ON TABLE public.internal_users FROM PUBLIC;
REVOKE ALL ON TABLE public.internal_login_challenges FROM PUBLIC;
REVOKE ALL ON TABLE public.internal_sessions FROM PUBLIC;
REVOKE ALL ON TABLE public.internal_auth_audit FROM PUBLIC;

COMMIT;

-- Runtime roles and grants are intentionally outside P2A. Apply this migration
-- only as the existing database owner during a separately approved rollout.
