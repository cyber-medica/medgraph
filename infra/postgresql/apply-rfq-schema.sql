\set ON_ERROR_STOP on
\if :{?rfq_owner_role}
\else
  \set rfq_owner_role cybermedica_rfq_owner
\endif

SET ROLE :"rfq_owner_role";
\ir ../../services/rfq-intake/sql/001_rfq_leads.sql
RESET ROLE;

\ir rfq-runtime-grants.sql
