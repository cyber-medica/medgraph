\set ON_ERROR_STOP on

begin;

select set_config('request.jwt.claim.role', 'service_role', true);
select set_config(
  'request.jwt.claims',
  '{"role":"service_role","app_metadata":{"app_role":"service"}}',
  true
);

insert into cloud.user_profiles (id, role, display_name) values
  ('7e90a993-8b30-4e0d-aff4-a257d5a4a179', 'admin', 'Corporate Catalog Admin');

insert into cloud.manufacturers (
  id, code, slug, canonical_name, display_name, description,
  confidence, publication_status
) values (
  'b1000000-0000-4000-8000-000000000010',
  'manufacturer-characteristics-contract', 'characteristics-contract-manufacturer',
  'Characteristics Contract Manufacturer', 'Characteristics Contract Manufacturer',
  'Disposable contract fixture.', 'verified', 'published'
);

insert into cloud.categories (
  id, code, slug, canonical_name, display_name, description,
  level, assignable, confidence, publication_status
) values (
  'b1000000-0000-4000-8000-000000000020',
  'category-characteristics-contract', 'characteristics-contract-category',
  'Characteristics Contract Category', 'Characteristics Contract Category',
  'Disposable contract fixture.', 'leaf', true, 'verified', 'published'
);

insert into cloud.application_areas (
  id, code, slug, canonical_name, display_name, description,
  confidence, publication_status
) values (
  'b1000000-0000-4000-8000-000000000030',
  'characteristics-contract-area', 'characteristics-contract-area',
  'Characteristics Contract Area', 'Characteristics Contract Area',
  'Disposable contract fixture.', 'verified', 'published'
);

insert into cloud.import_runs (
  id, run_key, pipeline_version, environment, status, started_at, completed_at,
  source_manifest
) values (
  'b1000000-0000-4000-8000-000000000040',
  'characteristics-contract-test', 'catalog-admin-characteristics-v1',
  'test', 'completed', '2026-08-03T08:00:00Z', '2026-08-03T08:00:01Z',
  '{}'::jsonb
);

insert into cloud.import_sources (
  id, import_run_id, source_id, source_type, source_location, snapshot,
  checksum_sha256
) values
  (
    'b1000000-0000-4000-8000-000000000041',
    'b1000000-0000-4000-8000-000000000040',
    '330695211247', 'immutable_source_snapshot_v1',
    'local://characteristics-contract-hamilton',
    '{"raw":{"product":{"uid":"330695211247"}}}'::jsonb,
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  ),
  (
    'b1000000-0000-4000-8000-000000000042',
    'b1000000-0000-4000-8000-000000000040',
    'outside-scope', 'immutable_source_snapshot_v1',
    'local://characteristics-contract-unrelated', '{}'::jsonb,
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  );

insert into cloud.products (
  id, slug, title, model, manufacturer_id, category_id, short_description,
  full_description, source_type, source_url, confidence, publication_status,
  source_uid, source_checksum, snapshot_version, created_from_snapshot_at,
  import_batch_key, missing_manufacturer, missing_category, missing_model,
  missing_application_area, catalog_quality_status, catalog_quality_reason,
  updated_at
) values
  (
    'e66a1165-030b-4aa4-a400-959f1ac70fe3',
    'characteristics-contract-hamilton', 'Аппарат ИВЛ Hamilton-T1', 'Hamilton-T1',
    'b1000000-0000-4000-8000-000000000010',
    'b1000000-0000-4000-8000-000000000020',
    'Исходное краткое описание', 'Исходное полное описание',
    'immutable_source_snapshot_v1', 'https://manufacturer.example/hamilton-t1',
    'reviewed', 'draft', '330695211247',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'immutable-source-snapshot-v1', '2026-08-03T08:00:00Z',
    'characteristics-contract-test', false, false, false, false,
    'READY', '{}', '2026-08-03T09:00:00Z'
  ),
  (
    'b1000000-0000-4000-8000-000000000051',
    'characteristics-contract-unrelated', 'Unrelated Product', 'UNRELATED-1',
    'b1000000-0000-4000-8000-000000000010',
    'b1000000-0000-4000-8000-000000000020',
    'Unrelated short', 'Unrelated full', 'immutable_source_snapshot_v1',
    'https://manufacturer.example/unrelated', 'reviewed', 'draft', 'outside-scope',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'immutable-source-snapshot-v1', '2026-08-03T08:00:00Z',
    'characteristics-contract-test', false, false, false, false,
    'READY', '{}', '2026-08-03T09:00:00Z'
  );

insert into cloud.product_descriptions (
  id, product_id, locale, short_description, full_description, confidence, updated_at
) values
  (
    'b1000000-0000-4000-8000-000000000060',
    'e66a1165-030b-4aa4-a400-959f1ac70fe3', 'ru',
    'Исходное краткое описание', 'Исходное полное описание', 'reviewed',
    '2026-08-03T09:00:00Z'
  ),
  (
    'b1000000-0000-4000-8000-000000000061',
    'b1000000-0000-4000-8000-000000000051', 'ru',
    'Unrelated short', 'Unrelated full', 'reviewed', '2026-08-03T09:00:00Z'
  );

insert into cloud.product_application_areas (product_id, application_area_id) values
  ('e66a1165-030b-4aa4-a400-959f1ac70fe3', 'b1000000-0000-4000-8000-000000000030'),
  ('b1000000-0000-4000-8000-000000000051', 'b1000000-0000-4000-8000-000000000030');

insert into cloud.product_characteristics (
  product_id, key, display_name, raw_value, normalized_value, sort_order,
  confidence, source_reference, reviewer_status
) values
  ('e66a1165-030b-4aa4-a400-959f1ac70fe3', 'public-jsonld-1', 'Категория', 'Реанимация', 'Реанимация', 0, 'reviewed', 'fixture:category', 'approved'),
  ('e66a1165-030b-4aa4-a400-959f1ac70fe3', 'public-jsonld-2', 'Тип товара', 'Аппарат ИВЛ', 'Аппарат ИВЛ', 1, 'reviewed', 'fixture:type', 'approved'),
  ('e66a1165-030b-4aa4-a400-959f1ac70fe3', 'public-jsonld-3', 'Страна производства', 'Швейцария', 'Швейцария', 2, 'reviewed', 'fixture:country', 'approved');

create temporary table characteristics_contract_before on commit drop as
select
  to_jsonb(product) as product_row,
  to_jsonb(description) as description_row,
  product.source_checksum,
  (select snapshot from cloud.import_sources where source_id = '330695211247') as raw_snapshot,
  (select to_jsonb(state) from cloud.published_catalog_projection_state state where singleton) as projection_state,
  (select count(*) from cloud.product_publication_revisions) as revisions,
  (select count(*) from cloud.review_decisions) as decisions,
  (select count(*) from cloud.product_publication_approvals) as approvals,
  (select count(*) from cloud.product_publication_batches) as batches,
  (select to_jsonb(other_product) from cloud.products other_product where id = 'b1000000-0000-4000-8000-000000000051') as unrelated
from cloud.products product
join cloud.product_descriptions description
  on description.product_id = product.id and description.locale = 'ru'
where product.id = 'e66a1165-030b-4aa4-a400-959f1ac70fe3';

create temporary table characteristics_contract_payload on commit drop as
select jsonb_agg(jsonb_build_object(
  'key', case when item <= 3 then 'public-jsonld-' || item else 'ventilator.spec-' || item end,
  'label', 'Характеристика ' || item,
  'value', 'Значение ' || item,
  'unit', case when item = 5 then 'кг' else null end,
  'group', case when item <= 3 then 'Основные сведения' else 'Технические характеристики' end,
  'groupSortOrder', case when item <= 3 then 0 else 10 end,
  'itemSortOrder', item * 10,
  'contentKind', 'technical_specification',
  'recordOrigin', 'authoritative_wave_1_preparation',
  'sourceUrl', 'https://manufacturer.example/hamilton-t1/specification.pdf',
  'evidenceLocation', 'Section ' || item,
  'confidence', 'High',
  'configurationDependency', null,
  'optional', false,
  'notes', null
) order by item) as payload
from generate_series(1, 10) item;

do $$
declare
  payload jsonb;
begin
  select stored.payload into payload from characteristics_contract_payload stored;

  perform set_config('request.jwt.claim.role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    perform cloud_api.catalog_admin_patch_product_characteristics_v1(
      'e66a1165-030b-4aa4-a400-959f1ac70fe3', '2026-08-03T09:00:00Z', 'ru',
      '{}'::jsonb, '{}'::jsonb, payload,
      '7e90a993-8b30-4e0d-aff4-a257d5a4a179', 'anonymous-rejected'
    );
    raise exception 'anonymous characteristics patch was accepted';
  exception when sqlstate '42501' then null;
  end;

  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role","app_metadata":{"app_role":"service"}}', true);
  begin
    perform cloud_api.catalog_admin_patch_product_characteristics_v1(
      'e66a1165-030b-4aa4-a400-959f1ac70fe3', '2026-08-03T09:00:00Z', 'ru',
      '{}'::jsonb, '{}'::jsonb, payload,
      'b1000000-0000-4000-8000-000000000099', 'wrong-actor-rejected'
    );
    raise exception 'non-corporate actor was accepted';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform cloud_api.catalog_admin_patch_product_characteristics_v1(
      'e66a1165-030b-4aa4-a400-959f1ac70fe3', '2026-08-03T09:00:00Z', 'en',
      '{}'::jsonb, '{}'::jsonb, payload,
      '7e90a993-8b30-4e0d-aff4-a257d5a4a179', 'wrong-locale-rejected'
    );
    raise exception 'non-ru locale was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform cloud_api.catalog_admin_patch_product_characteristics_v1(
      'e66a1165-030b-4aa4-a400-959f1ac70fe3', '2026-08-03T08:59:59Z', 'ru',
      '{}'::jsonb, '{}'::jsonb, payload,
      '7e90a993-8b30-4e0d-aff4-a257d5a4a179', 'stale-rejected'
    );
    raise exception 'stale characteristics patch was accepted';
  exception when sqlstate '40001' then null;
  end;
  begin
    perform cloud_api.catalog_admin_patch_product_characteristics_v1(
      'e66a1165-030b-4aa4-a400-959f1ac70fe3', '2026-08-03T09:00:00Z', 'ru',
      '{}'::jsonb, '{}'::jsonb, '[]'::jsonb,
      '7e90a993-8b30-4e0d-aff4-a257d5a4a179', 'empty-set-rejected'
    );
    raise exception 'empty characteristic set was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform cloud_api.catalog_admin_patch_product_characteristics_v1(
      'e66a1165-030b-4aa4-a400-959f1ac70fe3', '2026-08-03T09:00:00Z', 'ru',
      '{}'::jsonb, '{}'::jsonb,
      jsonb_set(payload, '{0,label}', '""'::jsonb),
      '7e90a993-8b30-4e0d-aff4-a257d5a4a179', 'malformed-rejected'
    );
    raise exception 'malformed characteristic was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform cloud_api.catalog_admin_patch_product_characteristics_v1(
      'e66a1165-030b-4aa4-a400-959f1ac70fe3', '2026-08-03T09:00:00Z', 'ru',
      '{}'::jsonb, '{}'::jsonb,
      jsonb_set(payload, '{1,key}', payload #> '{0,key}'),
      '7e90a993-8b30-4e0d-aff4-a257d5a4a179', 'duplicate-key-rejected'
    );
    raise exception 'duplicate characteristic key was accepted';
  exception when sqlstate '23505' then null;
  end;
  begin
    perform cloud_api.catalog_admin_patch_product_characteristics_v1(
      'b1000000-0000-4000-8000-000000000051', '2026-08-03T09:00:00Z', 'ru',
      '{}'::jsonb, '{}'::jsonb, payload,
      '7e90a993-8b30-4e0d-aff4-a257d5a4a179', 'outside-scope-rejected'
    );
    raise exception 'Product mismatch was accepted';
  exception when sqlstate '42501' then null;
  end;
end
$$;

create temporary table characteristics_contract_result on commit drop as
select cloud_api.catalog_admin_patch_product_characteristics_v1(
  'e66a1165-030b-4aa4-a400-959f1ac70fe3',
  '2026-08-03T09:00:00Z',
  'ru',
  jsonb_build_object(
    'seoDescription', 'Транспортный аппарат ИВЛ Hamilton-T1 для медицинских учреждений.'
  ),
  jsonb_build_object(
    'shortDescription', 'Hamilton-T1 — транспортный аппарат ИВЛ.',
    'fullDescription', '<p>Нейтральное подтверждённое описание Hamilton-T1.</p>'
  ),
  (select payload from characteristics_contract_payload),
  '7e90a993-8b30-4e0d-aff4-a257d5a4a179',
  'catalog-characteristics-hamilton-v1'
) as result;

do $$
declare
  payload jsonb;
  first_result jsonb;
  replay_result jsonb;
  candidate_one jsonb;
  candidate_two jsonb;
  before_row record;
begin
  select stored.payload into payload from characteristics_contract_payload stored;
  select result into first_result from characteristics_contract_result;
  select * into before_row from characteristics_contract_before;

  replay_result := cloud_api.catalog_admin_patch_product_characteristics_v1(
    'e66a1165-030b-4aa4-a400-959f1ac70fe3',
    '2026-08-03T09:00:00Z', 'ru',
    jsonb_build_object(
      'seoDescription', 'Транспортный аппарат ИВЛ Hamilton-T1 для медицинских учреждений.'
    ),
    jsonb_build_object(
      'shortDescription', 'Hamilton-T1 — транспортный аппарат ИВЛ.',
      'fullDescription', '<p>Нейтральное подтверждённое описание Hamilton-T1.</p>'
    ),
    payload, '7e90a993-8b30-4e0d-aff4-a257d5a4a179',
    'catalog-characteristics-hamilton-v1-replay'
  );
  if first_result ->> 'status' <> 'applied'
     or replay_result ->> 'status' <> 'already_applied'
     or first_result ->> 'payloadChecksum' <> replay_result ->> 'payloadChecksum' then
    raise exception 'same payload was not idempotent';
  end if;

  candidate_one := cloud.product_publication_candidate_payload_v1(
    'e66a1165-030b-4aa4-a400-959f1ac70fe3'
  );
  candidate_two := cloud.product_publication_candidate_payload_v1(
    'e66a1165-030b-4aa4-a400-959f1ac70fe3'
  );
  if candidate_one is distinct from candidate_two
     or jsonb_array_length(candidate_one -> 'characteristics') <> 10
     or candidate_one #>> '{product,shortDescription}'
        <> 'Hamilton-T1 — транспортный аппарат ИВЛ.'
     or candidate_one #>> '{product,seoDescription}'
        <> 'Транспортный аппарат ИВЛ Hamilton-T1 для медицинских учреждений.'
     or candidate_one -> 'characteristics' @? '$[*] ? (@.editorialRecordOrigin != "authoritative_wave_1_preparation")' then
    raise exception 'candidate characteristics are not deterministic';
  end if;

  if (select to_jsonb(product) from cloud.products product
      where id = 'e66a1165-030b-4aa4-a400-959f1ac70fe3')
       is distinct from before_row.product_row
     or (select to_jsonb(description) from cloud.product_descriptions description
         where product_id = 'e66a1165-030b-4aa4-a400-959f1ac70fe3' and locale = 'ru')
       is distinct from before_row.description_row then
    raise exception 'authoring draft changed the current Product or canonical published row';
  end if;
  if (select source_checksum from cloud.products
      where id = 'e66a1165-030b-4aa4-a400-959f1ac70fe3')
       is distinct from before_row.source_checksum
     or (select snapshot from cloud.import_sources where source_id = '330695211247')
       is distinct from before_row.raw_snapshot then
    raise exception 'immutable provenance changed';
  end if;
  if (select to_jsonb(state) from cloud.published_catalog_projection_state state where singleton)
       is distinct from before_row.projection_state then
    raise exception 'published projection state changed';
  end if;
  if (select count(*) from cloud.product_publication_revisions) <> before_row.revisions
     or (select count(*) from cloud.review_decisions) <> before_row.decisions
     or (select count(*) from cloud.product_publication_approvals) <> before_row.approvals
     or (select count(*) from cloud.product_publication_batches) <> before_row.batches then
    raise exception 'lifecycle evidence changed';
  end if;
  if (select to_jsonb(product) from cloud.products product
      where id = 'b1000000-0000-4000-8000-000000000051')
       is distinct from before_row.unrelated then
    raise exception 'unrelated Product changed';
  end if;
  if (select count(*) from cloud.catalog_admin_product_characteristic_drafts_v1) <> 1
     or (select jsonb_array_length(characteristics)
         from cloud.catalog_admin_product_characteristic_drafts_v1
         where product_id = 'e66a1165-030b-4aa4-a400-959f1ac70fe3') <> 10
     or (select count(*) from cloud.audit_log
         where entity_type = 'catalog_admin_product_characteristics_draft') <> 1 then
    raise exception 'characteristics draft or audit evidence mismatch';
  end if;

  begin
    perform cloud_api.catalog_admin_patch_product_characteristics_v1(
      'e66a1165-030b-4aa4-a400-959f1ac70fe3',
      (first_result ->> 'draftUpdatedAt')::timestamptz, 'ru',
      '{"publicationStatus":"draft"}'::jsonb,
      '{"shortDescription":"Must roll back"}'::jsonb,
      payload, '7e90a993-8b30-4e0d-aff4-a257d5a4a179',
      'invalid-partial-write-rejected'
    );
    raise exception 'invalid patch left a partial write';
  exception when sqlstate '22023' then null;
  end;
  if (select payload_checksum from cloud.catalog_admin_product_characteristic_drafts_v1
      where product_id = 'e66a1165-030b-4aa4-a400-959f1ac70fe3')
       <> first_result ->> 'payloadChecksum' then
    raise exception 'invalid patch left a partial write';
  end if;
end
$$;

select jsonb_pretty(jsonb_build_object(
  'status', 'PASS',
  'contract', 'catalog-admin-characteristics-patch-v1',
  'drafts', (select count(*) from cloud.catalog_admin_product_characteristic_drafts_v1),
  'candidateCharacteristics', jsonb_array_length(
    cloud.product_publication_candidate_payload_v1(
      'e66a1165-030b-4aa4-a400-959f1ac70fe3'
    ) -> 'characteristics'
  ),
  'lifecycleWrites', 0,
  'projectionWrites', 0
));

rollback;
