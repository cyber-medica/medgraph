\set ON_ERROR_STOP on
\if :{?rfq_database}
\else
  \set rfq_database cybermedica_rfq
\endif
\if :{?rfq_owner_role}
\else
  \set rfq_owner_role cybermedica_rfq_owner
\endif
\if :{?rfq_runtime_role}
\else
  \set rfq_runtime_role cybermedica_rfq_runtime
\endif

BEGIN;

REVOKE CONNECT ON DATABASE :"rfq_database" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"rfq_database" TO :"rfq_owner_role";
GRANT CONNECT ON DATABASE :"rfq_database" TO :"rfq_runtime_role";

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM :"rfq_runtime_role";
GRANT USAGE ON SCHEMA public TO :"rfq_runtime_role";

REVOKE ALL ON TABLE public.rfq_leads FROM PUBLIC;
REVOKE ALL ON TABLE public.rfq_leads FROM :"rfq_runtime_role";
GRANT SELECT, INSERT ON TABLE public.rfq_leads TO :"rfq_runtime_role";
GRANT UPDATE (
  delivery_status,
  delivery_attempts,
  last_delivery_error,
  delivery_next_attempt_at,
  delivery_locked_at,
  delivery_lock_token,
  delivered_at,
  updated_at
) ON TABLE public.rfq_leads TO :"rfq_runtime_role";

COMMIT;

-- Expected for cybermedica_rfq_runtime:
--   has_table_privilege(..., 'SELECT,INSERT') = true
--   has_table_privilege(..., 'DELETE,TRUNCATE,TRIGGER,REFERENCES') = false
--   has_schema_privilege(..., 'USAGE') = true
--   has_schema_privilege(..., 'CREATE') = false
-- The migration must be run as cybermedica_rfq_owner so the runtime role owns
-- neither the database/schema nor public.rfq_leads.
