BEGIN;

CREATE TABLE IF NOT EXISTS public.rfq_leads (
  id uuid PRIMARY KEY,
  company text NOT NULL CHECK (char_length(company) BETWEEN 1 AND 160),
  contact_name text NOT NULL CHECK (char_length(contact_name) BETWEEN 1 AND 120),
  phone text CHECK (phone IS NULL OR char_length(phone) BETWEEN 1 AND 40),
  email text CHECK (email IS NULL OR char_length(email) BETWEEN 3 AND 160),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 3000),
  product_id text,
  product_slug text,
  product_title text,
  product_model text,
  product_manufacturer text,
  source_path text NOT NULL CHECK (
    source_path LIKE '/%'
    AND source_path NOT LIKE '//%'
    AND position('?' IN source_path) = 0
    AND position('#' IN source_path) = 0
  ),
  attribution jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(attribution) = 'object'),
  consent_version text NOT NULL,
  consent_text_sha256 text NOT NULL CHECK (consent_text_sha256 ~ '^[0-9a-f]{64}$'),
  policy_version text NOT NULL,
  consent_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivery_status text NOT NULL DEFAULT 'pending' CHECK (
    delivery_status IN ('pending', 'delivered', 'failed')
  ),
  delivery_attempts integer NOT NULL DEFAULT 0 CHECK (delivery_attempts >= 0),
  last_delivery_error text,
  delivery_next_attempt_at timestamptz NOT NULL DEFAULT now(),
  delivery_locked_at timestamptz,
  delivery_lock_token uuid,
  delivered_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (phone IS NOT NULL OR email IS NOT NULL),
  CHECK (
    (product_id IS NULL AND product_slug IS NULL AND product_title IS NULL AND product_model IS NULL)
    OR
    (product_id IS NOT NULL AND product_slug IS NOT NULL AND product_title IS NOT NULL AND product_model IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS rfq_leads_delivery_queue_idx
  ON public.rfq_leads (delivery_next_attempt_at, created_at)
  WHERE delivery_status IN ('pending', 'failed');

REVOKE ALL ON TABLE public.rfq_leads FROM PUBLIC;

COMMIT;

-- The rollout runbook creates a dedicated LOGIN role and grants only:
--   SELECT, INSERT on public.rfq_leads; and
--   UPDATE on the delivery-state columns used by the retry worker.
-- No database credential or environment-specific role name belongs in this file.
