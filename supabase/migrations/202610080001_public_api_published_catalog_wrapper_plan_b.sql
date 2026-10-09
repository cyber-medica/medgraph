-- Plan B: expose the authoritative published Catalog RPC through the effective
-- PostgREST schema without changing the underlying projection or its ACL.

begin;

create or replace function public_api.cloud_published_storefront_catalog_v1()
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select cloud_api.cloud_published_storefront_catalog_v1()
$$;

alter function public_api.cloud_published_storefront_catalog_v1()
  owner to postgres;

grant usage on schema public_api to service_role;

revoke all on function public_api.cloud_published_storefront_catalog_v1()
  from public, anon, authenticated;
grant execute on function public_api.cloud_published_storefront_catalog_v1()
  to service_role;

comment on function public_api.cloud_published_storefront_catalog_v1() is
  'Service-only, read-only thin wrapper for the authoritative published Storefront catalog projection.';

commit;
