-- Catalog Admin characteristics projection isolation corrective v1.
-- Keeps published-catalog eligibility bound to the immutable live Product
-- candidate while exposing the approved authoring draft only through an
-- explicit, private helper for the next revision operation.

begin;

create or replace function cloud.product_publication_candidate_payload_v1(
  p_product_id uuid
)
returns jsonb
language sql
stable
set search_path = pg_catalog, cloud
as $$
  select cloud.product_publication_candidate_payload_pre_admin_v1(p_product_id)
$$;

create or replace function cloud.product_publication_candidate_with_admin_draft_v1(
  p_product_id uuid
)
returns jsonb
language sql
stable
set search_path = pg_catalog, cloud
as $$
  select cloud.apply_catalog_admin_characteristics_draft_v1(
    p_product_id,
    cloud.product_publication_candidate_payload_pre_admin_v1(p_product_id)
  )
$$;

alter function cloud.product_publication_candidate_payload_v1(uuid)
  owner to postgres;
alter function cloud.product_publication_candidate_with_admin_draft_v1(uuid)
  owner to postgres;

revoke all on function cloud.product_publication_candidate_payload_v1(uuid)
  from public, anon, authenticated, service_role;
revoke all on function cloud.product_publication_candidate_with_admin_draft_v1(uuid)
  from public, anon, authenticated, service_role;

comment on function cloud.product_publication_candidate_with_admin_draft_v1(uuid) is
  'Private exact-scope authoring helper. Applies a validated Characteristics Wave 1 draft to the immutable Product candidate without changing published-catalog eligibility or lifecycle state.';

commit;
