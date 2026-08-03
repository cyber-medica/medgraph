-- Catalog Admin deterministic characteristics patch contract v1.
-- Adds a closed authoring layer for the exact Published Characteristics Wave 1
-- scope. Draft authoring state is deliberately separate from immutable
-- publication revisions and the published projection.

begin;

create table cloud.catalog_admin_product_characteristic_drafts_v1 (
  product_id uuid primary key references cloud.products(id) on delete restrict,
  contract_version text not null
    check (contract_version = 'catalog-admin-characteristics-patch-v1'),
  locale text not null check (locale = 'ru'),
  product_patch jsonb not null check (jsonb_typeof(product_patch) = 'object'),
  description_patch jsonb not null check (jsonb_typeof(description_patch) = 'object'),
  characteristics jsonb not null check (
    jsonb_typeof(characteristics) = 'array'
    and jsonb_array_length(characteristics) = 10
  ),
  payload_checksum text not null check (payload_checksum ~ '^[0-9a-f]{64}$'),
  base_product_updated_at timestamptz not null,
  actor_id uuid not null check (
    actor_id = '7e90a993-8b30-4e0d-aff4-a257d5a4a179'::uuid
  ),
  request_id text not null check (char_length(btrim(request_id)) between 8 and 200),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint catalog_admin_characteristic_draft_scope_v1 check (
    product_id in (
      'e66a1165-030b-4aa4-a400-959f1ac70fe3'::uuid,
      '00e3f62b-797b-40ff-bf9f-9d1750828ca4'::uuid,
      'f61a0496-0434-41ab-8ca3-0f79c19ab0aa'::uuid,
      '224ee705-5dea-429f-ab10-1ef9153e94fc'::uuid,
      'b7f07e3e-5cdd-4988-b2a4-423bed321f46'::uuid,
      '76840838-c759-40eb-a1ef-e329e9091714'::uuid,
      'c6ba9c45-f6e8-4b2f-9f32-38335ee52bfe'::uuid,
      '48f7d071-c8e4-4bc9-96c4-fc12672ca183'::uuid,
      '4e1a370b-4e53-4ee6-b590-823d1ad0e087'::uuid,
      'ae1e448d-f266-4d5d-9d42-e2c22a2d54c8'::uuid,
      '7866179e-e753-411b-8e9e-409b109b66d2'::uuid,
      'e34f16f0-723c-4710-aab3-fb03d9fd9b84'::uuid,
      'dc511122-9b03-4a91-83c6-eb08e27a7b74'::uuid,
      '760b9466-dcb6-4fd5-a821-eb4bf8203e77'::uuid,
      '79b6082c-b63e-4c8e-9769-36383747b57b'::uuid
    )
  ),
  constraint catalog_admin_characteristic_draft_clock_v1 check (
    updated_at >= created_at
  )
);

alter table cloud.catalog_admin_product_characteristic_drafts_v1
  enable row level security;
revoke all on table cloud.catalog_admin_product_characteristic_drafts_v1
  from public, anon, authenticated, service_role;

create or replace function cloud.apply_catalog_admin_characteristics_draft_v1(
  p_product_id uuid,
  p_base_payload jsonb
)
returns jsonb
language plpgsql
stable
set search_path = pg_catalog, cloud
as $$
declare
  draft cloud.catalog_admin_product_characteristic_drafts_v1%rowtype;
  result jsonb := p_base_payload;
  descriptions_value jsonb;
  characteristics_value jsonb;
begin
  select * into draft
  from cloud.catalog_admin_product_characteristic_drafts_v1
  where product_id = p_product_id;
  if not found then
    return result;
  end if;

  if draft.product_patch ? 'title' then
    result := jsonb_set(result, '{product,title}', draft.product_patch -> 'title', true);
  end if;
  if draft.product_patch ? 'model' then
    result := jsonb_set(result, '{product,model}', draft.product_patch -> 'model', true);
  end if;
  if draft.product_patch ? 'seoTitle' then
    result := jsonb_set(result, '{product,seoTitle}', draft.product_patch -> 'seoTitle', true);
  end if;
  if draft.product_patch ? 'seoDescription' then
    result := jsonb_set(result, '{product,seoDescription}', draft.product_patch -> 'seoDescription', true);
  end if;
  if draft.description_patch ? 'shortDescription' then
    result := jsonb_set(
      result, '{product,shortDescription}',
      draft.description_patch -> 'shortDescription', true
    );
  end if;
  if draft.description_patch ? 'fullDescription' then
    result := jsonb_set(
      result, '{product,fullDescription}',
      draft.description_patch -> 'fullDescription', true
    );
  end if;

  select jsonb_agg(
    case
      when description.item ->> 'locale' = 'ru' then
        description.item
        || case when draft.description_patch ? 'shortDescription'
             then jsonb_build_object(
               'shortDescription', draft.description_patch ->> 'shortDescription'
             ) else '{}'::jsonb end
        || case when draft.description_patch ? 'fullDescription'
             then jsonb_build_object(
               'fullDescription', draft.description_patch ->> 'fullDescription'
             ) else '{}'::jsonb end
      else description.item
    end
    order by description.ordinality
  ) into descriptions_value
  from jsonb_array_elements(coalesce(result -> 'descriptions', '[]'::jsonb))
    with ordinality as description(item, ordinality);
  result := jsonb_set(result, '{descriptions}', coalesce(descriptions_value, '[]'::jsonb), true);

  select jsonb_agg(
    jsonb_build_object(
      'key', characteristic.item ->> 'key',
      'contentKind', 'technical_specification',
      'recordOrigin', 'legacy',
      'editorialRecordOrigin', characteristic.item ->> 'recordOrigin',
      'label', characteristic.item ->> 'label',
      'value', characteristic.item ->> 'value',
      'unit', characteristic.item -> 'unit',
      'group', jsonb_build_object(
        'key', 'group-' || lpad(characteristic.item ->> 'groupSortOrder', 3, '0'),
        'title', characteristic.item ->> 'group',
        'sortOrder', (characteristic.item ->> 'groupSortOrder')::integer
      ),
      'sortOrder', (characteristic.item ->> 'itemSortOrder')::integer,
      'source', jsonb_build_object(
        'type', 'official_evidence',
        'ref', characteristic.item ->> 'evidenceLocation',
        'url', characteristic.item ->> 'sourceUrl'
      ),
      'configurationDependency', characteristic.item -> 'configurationDependency',
      'optional', coalesce(characteristic.item -> 'optional', 'false'::jsonb),
      'notes', characteristic.item -> 'notes'
    ) order by
      (characteristic.item ->> 'groupSortOrder')::integer,
      (characteristic.item ->> 'itemSortOrder')::integer,
      characteristic.item ->> 'key'
  ) into characteristics_value
  from jsonb_array_elements(draft.characteristics) characteristic(item);
  result := jsonb_set(result, '{characteristics}', characteristics_value, true);

  return result;
end
$$;

alter function cloud.product_publication_candidate_payload_v1(uuid)
  rename to product_publication_candidate_payload_pre_admin_v1;

create function cloud.product_publication_candidate_payload_v1(p_product_id uuid)
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

create or replace function cloud.catalog_admin_patch_product_characteristics_v1(
  p_product_id uuid,
  p_expected_updated_at timestamptz,
  p_locale text,
  p_product_patch jsonb,
  p_description_patch jsonb,
  p_characteristics jsonb,
  p_actor_id uuid,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, cloud, extensions
as $$
declare
  allowed_product_fields constant text[] := array[
    'title', 'model', 'seoTitle', 'seoDescription'
  ];
  allowed_description_fields constant text[] := array[
    'shortDescription', 'fullDescription'
  ];
  allowed_characteristic_fields constant text[] := array[
    'key', 'label', 'value', 'unit', 'group', 'groupSortOrder',
    'itemSortOrder', 'contentKind', 'recordOrigin', 'sourceUrl',
    'evidenceLocation', 'confidence', 'configurationDependency',
    'optional', 'notes'
  ];
  product_row cloud.products%rowtype;
  canonical_description cloud.product_descriptions%rowtype;
  previous_draft cloud.catalog_admin_product_characteristic_drafts_v1%rowtype;
  normalized_characteristics jsonb;
  payload_checksum_value text;
  effective_updated_at timestamptz;
  change_timestamp timestamptz;
  field_name text;
  characteristic_count integer;
begin
  if not cloud.is_service_request() then
    raise exception 'catalog admin characteristics patch requires service role'
      using errcode = '42501';
  end if;
  if p_actor_id is distinct from '7e90a993-8b30-4e0d-aff4-a257d5a4a179'::uuid then
    raise exception 'corporate Catalog Admin actor is required' using errcode = '42501';
  end if;
  if p_locale is distinct from 'ru' then
    raise exception 'only canonical locale ru is supported' using errcode = '22023';
  end if;
  if p_expected_updated_at is null then
    raise exception 'expectedUpdatedAt is required' using errcode = '22023';
  end if;
  if char_length(coalesce(btrim(p_request_id), '')) not between 8 and 200 then
    raise exception 'request id is required' using errcode = '22023';
  end if;
  if jsonb_typeof(p_product_patch) <> 'object'
     or jsonb_typeof(p_description_patch) <> 'object' then
    raise exception 'Product and description patches must be objects' using errcode = '22023';
  end if;
  for field_name in select jsonb_object_keys(p_product_patch) loop
    if not field_name = any(allowed_product_fields) then
      raise exception 'immutable or unsupported Product field: %', field_name using errcode = '22023';
    end if;
  end loop;
  for field_name in select jsonb_object_keys(p_description_patch) loop
    if not field_name = any(allowed_description_fields) then
      raise exception 'immutable or unsupported description field: %', field_name using errcode = '22023';
    end if;
  end loop;
  if exists (
    select 1 from jsonb_each(p_product_patch) field
    where jsonb_typeof(field.value) <> 'string'
      or nullif(btrim(field.value #>> '{}'), '') is null
  ) or exists (
    select 1 from jsonb_each(p_description_patch) field
    where jsonb_typeof(field.value) <> 'string'
      or nullif(btrim(field.value #>> '{}'), '') is null
  ) then
    raise exception 'Product and description patch values must be non-empty strings'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_characteristics) <> 'array'
     or jsonb_array_length(p_characteristics) <> 10 then
    raise exception 'exactly ten characteristics are required' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_characteristics) characteristic(item)
    where jsonb_typeof(characteristic.item) <> 'object'
      or exists (
        select 1 from jsonb_object_keys(characteristic.item) supplied(field)
        where not supplied.field = any(allowed_characteristic_fields)
      )
      or jsonb_typeof(characteristic.item -> 'key') <> 'string'
      or char_length(btrim(characteristic.item ->> 'key')) not between 3 and 120
      or characteristic.item ->> 'key' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or (characteristic.item ->> 'key') !~ '^[A-Za-z][A-Za-z0-9_.-]*$'
      or jsonb_typeof(characteristic.item -> 'label') <> 'string'
      or char_length(btrim(characteristic.item ->> 'label')) not between 1 and 200
      or jsonb_typeof(characteristic.item -> 'value') <> 'string'
      or char_length(btrim(characteristic.item ->> 'value')) not between 1 and 2000
      or jsonb_typeof(characteristic.item -> 'group') <> 'string'
      or char_length(btrim(characteristic.item ->> 'group')) not between 1 and 200
      or jsonb_typeof(characteristic.item -> 'groupSortOrder') <> 'number'
      or (characteristic.item ->> 'groupSortOrder') !~ '^[0-9]+$'
      or jsonb_typeof(characteristic.item -> 'itemSortOrder') <> 'number'
      or (characteristic.item ->> 'itemSortOrder') !~ '^[0-9]+$'
      or characteristic.item ->> 'contentKind' <> 'technical_specification'
      or characteristic.item ->> 'recordOrigin' <> 'authoritative_wave_1_preparation'
      or characteristic.item ->> 'confidence' <> 'High'
      or jsonb_typeof(characteristic.item -> 'sourceUrl') <> 'string'
      or characteristic.item ->> 'sourceUrl' !~ '^https://[^[:space:]]+$'
      or jsonb_typeof(characteristic.item -> 'evidenceLocation') <> 'string'
      or char_length(btrim(characteristic.item ->> 'evidenceLocation')) not between 1 and 500
      or (characteristic.item ? 'unit' and jsonb_typeof(characteristic.item -> 'unit') not in ('null', 'string'))
      or (characteristic.item ? 'configurationDependency' and jsonb_typeof(characteristic.item -> 'configurationDependency') not in ('null', 'string'))
      or (characteristic.item ? 'optional' and jsonb_typeof(characteristic.item -> 'optional') <> 'boolean')
      or (characteristic.item ? 'notes' and jsonb_typeof(characteristic.item -> 'notes') not in ('null', 'string'))
  ) then
    raise exception 'characteristic payload is malformed or unsupported' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_characteristics) characteristic(item)
    group by lower(btrim(characteristic.item ->> 'key')) having count(*) > 1
  ) then
    raise exception 'duplicate characteristic key' using errcode = '23505';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_characteristics) characteristic(item)
    group by
      (characteristic.item ->> 'groupSortOrder')::integer,
      (characteristic.item ->> 'itemSortOrder')::integer
    having count(*) > 1
  ) then
    raise exception 'duplicate characteristic item order within group' using errcode = '23505';
  end if;

  if p_product_id not in (
    'e66a1165-030b-4aa4-a400-959f1ac70fe3'::uuid,
    '00e3f62b-797b-40ff-bf9f-9d1750828ca4'::uuid,
    'f61a0496-0434-41ab-8ca3-0f79c19ab0aa'::uuid,
    '224ee705-5dea-429f-ab10-1ef9153e94fc'::uuid,
    'b7f07e3e-5cdd-4988-b2a4-423bed321f46'::uuid,
    '76840838-c759-40eb-a1ef-e329e9091714'::uuid,
    'c6ba9c45-f6e8-4b2f-9f32-38335ee52bfe'::uuid,
    '48f7d071-c8e4-4bc9-96c4-fc12672ca183'::uuid,
    '4e1a370b-4e53-4ee6-b590-823d1ad0e087'::uuid,
    'ae1e448d-f266-4d5d-9d42-e2c22a2d54c8'::uuid,
    '7866179e-e753-411b-8e9e-409b109b66d2'::uuid,
    'e34f16f0-723c-4710-aab3-fb03d9fd9b84'::uuid,
    'dc511122-9b03-4a91-83c6-eb08e27a7b74'::uuid,
    '760b9466-dcb6-4fd5-a821-eb4bf8203e77'::uuid,
    '79b6082c-b63e-4c8e-9769-36383747b57b'::uuid
  ) then
    raise exception 'Product is outside Characteristics Wave 1 scope' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_product_id::text, 31));
  select * into product_row from cloud.products
  where id = p_product_id for update;
  if not found then
    raise exception 'Product does not exist' using errcode = 'P0002';
  end if;
  select * into canonical_description from cloud.product_descriptions
  where product_id = p_product_id and locale = 'ru' for update;
  if not found then
    raise exception 'canonical ru Product description is missing' using errcode = 'P0002';
  end if;
  select * into previous_draft
  from cloud.catalog_admin_product_characteristic_drafts_v1
  where product_id = p_product_id for update;

  select jsonb_agg(characteristic.item order by
    (characteristic.item ->> 'groupSortOrder')::integer,
    (characteristic.item ->> 'itemSortOrder')::integer,
    characteristic.item ->> 'key'
  ), count(*) into normalized_characteristics, characteristic_count
  from jsonb_array_elements(p_characteristics) characteristic(item);
  payload_checksum_value := cloud.sha256_jsonb_v1(jsonb_build_object(
    'contractVersion', 'catalog-admin-characteristics-patch-v1',
    'productId', p_product_id,
    'locale', p_locale,
    'productPatch', p_product_patch,
    'descriptionPatch', p_description_patch,
    'characteristics', normalized_characteristics
  ));

  if previous_draft.product_id is not null
     and previous_draft.payload_checksum = payload_checksum_value then
    return jsonb_build_object(
      'status', 'already_applied',
      'productId', p_product_id,
      'draftUpdatedAt', previous_draft.updated_at,
      'payloadChecksum', previous_draft.payload_checksum,
      'characteristicCount', jsonb_array_length(previous_draft.characteristics)
    );
  end if;

  effective_updated_at := coalesce(previous_draft.updated_at, product_row.updated_at);
  if effective_updated_at is distinct from p_expected_updated_at then
    raise exception 'stale Catalog Admin characteristics patch' using errcode = '40001';
  end if;
  change_timestamp := greatest(clock_timestamp(), effective_updated_at + interval '1 microsecond');

  insert into cloud.catalog_admin_product_characteristic_drafts_v1 (
    product_id, contract_version, locale, product_patch, description_patch,
    characteristics, payload_checksum, base_product_updated_at, actor_id,
    request_id, created_at, updated_at
  ) values (
    p_product_id, 'catalog-admin-characteristics-patch-v1', p_locale,
    p_product_patch, p_description_patch, normalized_characteristics,
    payload_checksum_value, product_row.updated_at, p_actor_id, btrim(p_request_id),
    change_timestamp, change_timestamp
  ) on conflict (product_id) do update set
    product_patch = excluded.product_patch,
    description_patch = excluded.description_patch,
    characteristics = excluded.characteristics,
    payload_checksum = excluded.payload_checksum,
    base_product_updated_at = excluded.base_product_updated_at,
    actor_id = excluded.actor_id,
    request_id = excluded.request_id,
    updated_at = excluded.updated_at;

  insert into cloud.audit_log (
    actor_id, action, entity_type, entity_id, before_data, after_data, source, request_id
  ) values (
    p_actor_id, 'update', 'catalog_admin_product_characteristics_draft', p_product_id,
    case when previous_draft.product_id is null then null else jsonb_build_object(
      'payloadChecksum', previous_draft.payload_checksum,
      'characteristicCount', jsonb_array_length(previous_draft.characteristics),
      'draftUpdatedAt', previous_draft.updated_at
    ) end,
    jsonb_build_object(
      'payloadChecksum', payload_checksum_value,
      'characteristicCount', characteristic_count,
      'draftUpdatedAt', change_timestamp
    ),
    'cloud_api.catalog_admin_patch_product_characteristics_v1',
    btrim(p_request_id)
  );

  return jsonb_build_object(
    'status', 'applied',
    'productId', p_product_id,
    'baseProductUpdatedAt', product_row.updated_at,
    'draftUpdatedAt', change_timestamp,
    'payloadChecksum', payload_checksum_value,
    'characteristicCount', characteristic_count
  );
end
$$;

create or replace function cloud_api.catalog_admin_patch_product_characteristics_v1(
  p_product_id uuid,
  p_expected_updated_at timestamptz,
  p_locale text,
  p_product_patch jsonb,
  p_description_patch jsonb,
  p_characteristics jsonb,
  p_actor_id uuid,
  p_request_id text
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, cloud
as $$
  select cloud.catalog_admin_patch_product_characteristics_v1(
    p_product_id, p_expected_updated_at, p_locale, p_product_patch,
    p_description_patch, p_characteristics, p_actor_id, p_request_id
  )
$$;

alter table cloud.catalog_admin_product_characteristic_drafts_v1 owner to postgres;
alter function cloud.apply_catalog_admin_characteristics_draft_v1(uuid,jsonb) owner to postgres;
alter function cloud.product_publication_candidate_payload_pre_admin_v1(uuid) owner to postgres;
alter function cloud.product_publication_candidate_payload_v1(uuid) owner to postgres;
alter function cloud.catalog_admin_patch_product_characteristics_v1(
  uuid,timestamptz,text,jsonb,jsonb,jsonb,uuid,text
) owner to postgres;
alter function cloud_api.catalog_admin_patch_product_characteristics_v1(
  uuid,timestamptz,text,jsonb,jsonb,jsonb,uuid,text
) owner to postgres;

revoke all on function cloud.apply_catalog_admin_characteristics_draft_v1(uuid,jsonb)
  from public, anon, authenticated, service_role;
revoke all on function cloud.product_publication_candidate_payload_pre_admin_v1(uuid)
  from public, anon, authenticated, service_role;
revoke all on function cloud.product_publication_candidate_payload_v1(uuid)
  from public, anon, authenticated, service_role;
revoke all on function cloud.catalog_admin_patch_product_characteristics_v1(
  uuid,timestamptz,text,jsonb,jsonb,jsonb,uuid,text
) from public, anon, authenticated, service_role;
revoke all on function cloud_api.catalog_admin_patch_product_characteristics_v1(
  uuid,timestamptz,text,jsonb,jsonb,jsonb,uuid,text
) from public, anon, authenticated;
grant execute on function cloud_api.catalog_admin_patch_product_characteristics_v1(
  uuid,timestamptz,text,jsonb,jsonb,jsonb,uuid,text
) to service_role;

comment on table cloud.catalog_admin_product_characteristic_drafts_v1 is
  'Closed Wave 1 authoring state. It is not lifecycle evidence and is never read by the published projection.';
comment on function cloud_api.catalog_admin_patch_product_characteristics_v1(
  uuid,timestamptz,text,jsonb,jsonb,jsonb,uuid,text
) is
  'Service-only, corporate-actor, exact-scope deterministic Product characteristics draft patch. Creates no revision or publication evidence.';

commit;
