-- CyberMedica Production Launch Release v1.
-- Exact, manifest-bound import and lifecycle orchestration for the accepted
-- 43-Product Stage release. No browser-supplied Product scope is accepted.

begin;

create or replace function cloud.validate_structured_product_detail_candidate_v1(p_payload jsonb)
returns void
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  item jsonb;
  normalized_label text;
begin
  if jsonb_typeof(p_payload) is distinct from 'object'
     or p_payload ->> 'schemaVersion' is distinct from '1'
     or jsonb_typeof(p_payload -> 'product') is distinct from 'object'
     or coalesce(p_payload #>> '{product,id}', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or jsonb_typeof(p_payload -> 'keyFeatures') is distinct from 'array'
     or jsonb_typeof(p_payload -> 'specifications') is distinct from 'array' then
    raise exception 'invalid Structured Product Detail v1 candidate' using errcode = '22023';
  end if;

  if jsonb_array_length(p_payload -> 'keyFeatures') > 100
     or jsonb_array_length(p_payload -> 'specifications') > 500 then
    raise exception 'Structured Product Detail candidate exceeds field limits' using errcode = '22023';
  end if;

  if (select count(*) <> count(distinct value ->> 'key') from jsonb_array_elements(p_payload -> 'keyFeatures'))
     or (select count(*) <> count(distinct value ->> 'key') from jsonb_array_elements(p_payload -> 'specifications')) then
    raise exception 'Structured Product Detail field keys must be unique' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_payload -> 'keyFeatures') loop
    if coalesce(item ->> 'key', '') !~ '^[a-z0-9][a-z0-9._-]{0,127}$'
       or nullif(btrim(item ->> 'text'), '') is null
       or item ->> 'text' ~* '</?[a-z][^>]*>'
       or coalesce((item ->> 'sortOrder')::integer, -1) < 0
       or nullif(btrim(item #>> '{source,type}'), '') is null
       or nullif(btrim(item #>> '{source,ref}'), '') is null
       or item #>> '{source,type}' ~* '</?[a-z][^>]*>'
       or item #>> '{source,ref}' ~* '</?[a-z][^>]*>'
       or (item #>> '{source,url}' is not null and item #>> '{source,url}' !~ '^https://') then
      raise exception 'invalid structured key feature %', item ->> 'key' using errcode = '22023';
    end if;
  end loop;

  for item in select value from jsonb_array_elements(p_payload -> 'specifications') loop
    normalized_label := regexp_replace(lower(btrim(item ->> 'label')), '\s+', ' ', 'g');
    if coalesce(item ->> 'key', '') !~ '^[a-z0-9][a-z0-9._-]{0,127}$'
       or nullif(btrim(item ->> 'label'), '') is null
       or nullif(btrim(item ->> 'value'), '') is null
       or item ->> 'label' ~* '</?[a-z][^>]*>'
       or item ->> 'value' ~* '</?[a-z][^>]*>'
       or coalesce((item ->> 'sortOrder')::integer, -1) < 0
       or normalized_label = any(array[
         'артикул','категория','модель','область применения','применение',
         'производитель','регистрационное удостоверение','страна производства',
         'тип товара','цена','application area','category','country',
         'country of origin','manufacturer','model','product type',
         'registration number','sku','price'
       ])
       or nullif(btrim(item #>> '{source,type}'), '') is null
       or nullif(btrim(item #>> '{source,ref}'), '') is null
       or item #>> '{source,type}' ~* '</?[a-z][^>]*>'
       or item #>> '{source,ref}' ~* '</?[a-z][^>]*>'
       or (item #>> '{source,url}' is not null and item #>> '{source,url}' !~ '^https://')
       or (item -> 'group' is not null and item -> 'group' <> 'null'::jsonb and (
         coalesce(item #>> '{group,key}', '') !~ '^[a-z0-9][a-z0-9._-]{0,127}$'
         or nullif(btrim(item #>> '{group,title}'), '') is null
         or item #>> '{group,title}' ~* '</?[a-z][^>]*>'
         or coalesce((item #>> '{group,sortOrder}')::integer, -1) < 0
       )) then
      raise exception 'invalid structured specification %', item ->> 'key' using errcode = '22023';
    end if;
  end loop;
end
$$;

create or replace function cloud.production_launch_release_scope_v1()
returns uuid[]
language sql
immutable
set search_path = pg_catalog
as $$
  select array[
    '0d7cb9c7-4560-5904-8ca1-6d6c309fb836'::uuid,
    '0dcbcb9e-a41e-508f-9d22-83cf26a85250'::uuid,
    '11a809ac-071d-502b-ad44-6fcd67ce400d'::uuid,
    '1d63227c-1f5e-5bce-91f0-e60e10cc804a'::uuid,
    '1f5ea387-9f9e-5e45-b2a2-7e52e3389ac8'::uuid,
    '2a43d10d-1e8c-5f73-b230-be3e954bc7a5'::uuid,
    '2fa94eb5-7a68-5e3a-a269-29ebf8199ff9'::uuid,
    '3f162b99-c61b-5f0e-bb1b-f8b9fab1f2a0'::uuid,
    '40385d54-1b6f-5324-8977-ed6dda2ac1d0'::uuid,
    '4698d385-d61b-5ead-b0a1-3de09e0558b2'::uuid,
    '492f7475-56b4-5a2e-bd9e-76d1a4191673'::uuid,
    '4978cfe6-047f-59a8-a9e5-1b45c9583b52'::uuid,
    '576aacfb-d003-51a3-bb21-9847ea9e863a'::uuid,
    '598bb29f-f5ca-5253-be7d-ae3887a708d2'::uuid,
    '59a2d5cb-81d5-51ab-b654-00ce5c26a934'::uuid,
    '59bd4807-41f1-5db0-9c90-8e4bcb05be35'::uuid,
    '5b333fd2-763f-500a-8138-5d5f2cc1d531'::uuid,
    '625b0514-c2d7-5940-9c8d-2e53793aa96a'::uuid,
    '63705465-45a0-5697-b749-eeccbe11895f'::uuid,
    '653872c6-5bf6-556f-a9a2-b93eeb9a496c'::uuid,
    '766b6369-5558-5449-8af2-084114700ab2'::uuid,
    '7df4c0c0-1baf-5dd5-879b-98b5599f4c16'::uuid,
    '83034406-2c66-5bcb-9b0d-10771c36118f'::uuid,
    '88111db4-3918-51f3-81c1-0d1ec46d5cf8'::uuid,
    '88284115-1b45-5660-a12d-05e6856164db'::uuid,
    '8e5c9a3e-5f6d-5174-85a9-a74a4fbcd0ee'::uuid,
    '994afd79-f81a-54df-9cc1-3e7702cf6d5b'::uuid,
    '99747c2c-f8f3-5e9d-88be-55b1ac9a16d7'::uuid,
    '9b544377-49eb-58a1-a595-6bf7ebc1006b'::uuid,
    '9f8d400f-2060-548a-bd7c-84e989430bb0'::uuid,
    'a30b5630-a2f6-544b-aa82-3472d63dfa7a'::uuid,
    'a8dafbd9-eaf1-5170-8733-b19796c38abd'::uuid,
    'b69aba8d-0e4c-563f-b342-5282fd36c232'::uuid,
    'cdbe8f0d-ff6c-5a1b-a2ae-d8d33a1960d6'::uuid,
    'd341c796-df53-5cdc-a32a-b69a07aa785c'::uuid,
    'd3a495be-6056-5545-87ac-19ac561d49ab'::uuid,
    'db929220-3767-5a38-a5e5-32c746aac25b'::uuid,
    'df001769-ac68-5890-827f-5977a723c5ed'::uuid,
    'e541bffe-ad1d-5f0e-a84a-e39771497438'::uuid,
    'e7714457-0243-5bc2-b354-f7cb4da1f4c3'::uuid,
    'f43d0e8f-9f7e-536c-966e-8817f939c9f3'::uuid,
    'f8ae3e2a-5baa-5ddd-a36a-3165df8c604c'::uuid,
    'fe0ac882-1b38-5b7c-9892-8d8b2b6f6c5e'::uuid
  ]
$$;

create or replace function cloud.production_launch_release_assert_manifest_v1(
  p_manifest jsonb,
  p_manifest_sha256 text
)
returns void
language plpgsql
immutable
set search_path = pg_catalog, cloud
as $$
declare
  manifest_ids uuid[];
begin
  if p_manifest_sha256 <> 'aa66f41be007cab08f16015d1a158e0381eca32c8e98afaa4a33452155ccc309'
     or p_manifest ->> 'schemaVersion' <> 'cybermedica-production-launch-release-manifest-v1'
     or p_manifest ->> 'version' <> 'production-launch-release-v1'
     or p_manifest ->> 'operationKey' <> 'production-launch-catalog-import-v1'
     or (p_manifest ->> 'candidateCount')::integer <> 43
     or (p_manifest ->> 'expectedFinalPublishedCount')::integer <> 114
     or jsonb_typeof(p_manifest -> 'products') <> 'array'
     or jsonb_array_length(p_manifest -> 'products') <> 43 then
    raise exception 'Production launch manifest metadata is invalid' using errcode = '22023';
  end if;

  select array_agg((item ->> 'id')::uuid order by (item ->> 'id')::uuid)
  into manifest_ids
  from jsonb_array_elements(p_manifest -> 'products') item;
  if manifest_ids is distinct from cloud.production_launch_release_scope_v1()
     or (select count(distinct item ->> 'sourceUid') from jsonb_array_elements(p_manifest -> 'products') item) <> 43
     or (select count(distinct item ->> 'slug') from jsonb_array_elements(p_manifest -> 'products') item) <> 43
     or (select coalesce(sum(jsonb_array_length(item -> 'structuredDetail' -> 'keyFeatures')), 0)
         from jsonb_array_elements(p_manifest -> 'products') item) <> 255
     or (select coalesce(sum(jsonb_array_length(item -> 'structuredDetail' -> 'specifications')), 0)
         from jsonb_array_elements(p_manifest -> 'products') item) <> 294
     or (select coalesce(sum(jsonb_array_length(item -> 'media')), 0)
         from jsonb_array_elements(p_manifest -> 'products') item) <> 155 then
    raise exception 'Production launch manifest scope is invalid' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_manifest -> 'products') item
    where nullif(btrim(item ->> 'sourceUid'), '') is null
       or nullif(btrim(item ->> 'slug'), '') is null
       or nullif(btrim(item ->> 'title'), '') is null
       or nullif(btrim(item ->> 'model'), '') is null
       or nullif(btrim(item ->> 'shortDescription'), '') is null
       or nullif(btrim(item ->> 'fullDescription'), '') is null
       or nullif(btrim(item ->> 'seoTitle'), '') is null
       or nullif(btrim(item ->> 'seoDescription'), '') is null
       or item ->> 'seoTitle' ~* 'cybermedica'
       or item ->> 'seoDescription' ~* 'cybermedica'
       or item ->> 'sourceUrl' !~ '^https://'
       or jsonb_array_length(item -> 'applicationAreaIds') = 0
       or jsonb_array_length(item -> 'media') = 0
       or item #>> '{structuredDetail,product,id}' <> item ->> 'id'
       or item #>> '{structuredDetail,product,sourceUid}' <> item ->> 'sourceUid'
  ) then
    raise exception 'Production launch manifest contains incomplete Product content' using errcode = '22023';
  end if;
end
$$;

create or replace function cloud.production_launch_release_assert_corporate_reviewer_v1()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, auth, cloud
as $$
declare
  reviewer_id constant uuid := '7e90a993-8b30-4e0d-aff4-a257d5a4a179'::uuid;
begin
  if auth.role() <> 'authenticated'
     or auth.uid() is distinct from reviewer_id
     or lower(coalesce(auth.jwt() ->> 'email', '')) <> 'cybermedicaooo@gmail.com'
     or not exists (
       select 1 from cloud.user_profiles profile
       where profile.id = reviewer_id and profile.role = 'admin'
     ) then
    raise exception 'Corporate admin session is required' using errcode = '42501';
  end if;
  return reviewer_id;
end
$$;

create or replace function cloud.production_launch_release_import_v1(
  p_manifest jsonb,
  p_manifest_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, cloud, extensions
as $$
declare
  run_id uuid;
  source_id uuid;
  import_product_id uuid;
  product_value jsonb;
  reference_value jsonb;
  media_value jsonb;
  application_area_value jsonb;
  product_id uuid;
  source_checksum text;
  existing_products integer;
  imported integer := 0;
begin
  if not cloud.is_service_request() then
    raise exception 'Production launch import requires service role' using errcode = '42501';
  end if;
  perform cloud.production_launch_release_assert_manifest_v1(p_manifest, p_manifest_sha256);
  perform pg_advisory_xact_lock(hashtextextended('production-launch-catalog-import-v1', 0));

  select count(*) into existing_products
  from cloud.products where id = any(cloud.production_launch_release_scope_v1());
  if exists (select 1 from cloud.import_runs where run_key = 'production-launch-catalog-import-v1') then
    if existing_products = 43
       and (select count(*) from cloud.publication_candidates candidate
            join cloud.import_products imported_product on imported_product.id = candidate.import_product_id
            where imported_product.import_run_id = (
              select id from cloud.import_runs where run_key = 'production-launch-catalog-import-v1'
            )) = 43 then
      return jsonb_build_object(
        'status', 'already_complete', 'products', 43,
        'manifestSha256', p_manifest_sha256
      );
    end if;
    raise exception 'Production launch import is partially applied' using errcode = '55000';
  end if;
  if existing_products <> 0
     or exists (
       select 1 from cloud.products product
       join jsonb_array_elements(p_manifest -> 'products') item
         on product.slug = item ->> 'slug' or product.source_uid = item ->> 'sourceUid'
     ) then
    raise exception 'Production launch Product identity collision' using errcode = '23505';
  end if;

  for reference_value in
    select value from jsonb_array_elements(p_manifest #> '{references,manufacturers}')
  loop
    if reference_value ->> 'action' = 'reuse' then
      if not exists (
        select 1 from cloud.manufacturers reference
        where reference.id = (reference_value ->> 'id')::uuid
          and reference.display_name = reference_value ->> 'name'
          and reference.publication_status = 'published'
          and reference.archived_at is null
      ) then
        raise exception 'Manufacturer reuse binding drift' using errcode = '55000';
      end if;
    else
      insert into cloud.manufacturers (
        id, code, slug, canonical_name, display_name, description,
        confidence, publication_status, migration_batch_key
      ) values (
        (reference_value ->> 'id')::uuid, reference_value ->> 'code',
        reference_value ->> 'slug', reference_value ->> 'name',
        reference_value ->> 'name', reference_value ->> 'description',
        'reviewed', 'published', 'production-launch-catalog-import-v1'
      );
    end if;
  end loop;

  for reference_value in
    select value from jsonb_array_elements(p_manifest #> '{references,categories}')
  loop
    if reference_value ->> 'action' = 'reuse' then
      if not exists (
        select 1 from cloud.categories reference
        where reference.id = (reference_value ->> 'id')::uuid
          and reference.display_name = reference_value ->> 'name'
          and reference.publication_status = 'published'
          and reference.assignable and reference.archived_at is null
      ) then
        raise exception 'Category reuse binding drift' using errcode = '55000';
      end if;
    else
      insert into cloud.categories (
        id, code, slug, canonical_name, display_name, description,
        level, assignable, confidence, publication_status, sort_order,
        migration_batch_key
      ) values (
        (reference_value ->> 'id')::uuid, reference_value ->> 'code',
        reference_value ->> 'slug', reference_value ->> 'name',
        reference_value ->> 'name', reference_value ->> 'description',
        'leaf', true, 'reviewed', 'published', 900,
        'production-launch-catalog-import-v1'
      );
    end if;
  end loop;

  for reference_value in
    select value from jsonb_array_elements(p_manifest #> '{references,applicationAreas}')
  loop
    if reference_value ->> 'action' = 'reuse' then
      if not exists (
        select 1 from cloud.application_areas reference
        where reference.id = (reference_value ->> 'id')::uuid
          and reference.display_name = reference_value ->> 'name'
          and reference.publication_status = 'published'
          and reference.archived_at is null
      ) then
        raise exception 'Application-area reuse binding drift' using errcode = '55000';
      end if;
    else
      insert into cloud.application_areas (
        id, code, slug, canonical_name, display_name, description,
        confidence, publication_status, migration_batch_key
      ) values (
        (reference_value ->> 'id')::uuid, reference_value ->> 'code',
        reference_value ->> 'slug', reference_value ->> 'name',
        reference_value ->> 'name', reference_value ->> 'description',
        'reviewed', 'published', 'production-launch-catalog-import-v1'
      );
    end if;
  end loop;

  insert into cloud.import_runs (
    run_key, pipeline_version, environment, status, started_at, completed_at,
    initiated_by, source_manifest, configuration, summary
  ) values (
    'production-launch-catalog-import-v1', 'production-launch-release-v1',
    'production', 'completed_with_warnings', clock_timestamp(), clock_timestamp(),
    '7e90a993-8b30-4e0d-aff4-a257d5a4a179'::uuid,
    jsonb_build_object(
      'manifestSha256', p_manifest_sha256,
      'acceptedStageCommit', p_manifest ->> 'acceptedStageCommit',
      'candidateCount', 43
    ),
    jsonb_build_object('scope', 'exact_manifest', 'lifecycle', 'review_required'),
    jsonb_build_object('imported', 43, 'warnings', 86, 'blockingErrors', 0)
  ) returning id into run_id;

  for product_value in select value from jsonb_array_elements(p_manifest -> 'products') loop
    product_id := (product_value ->> 'id')::uuid;
    source_checksum := cloud.sha256_jsonb_v1(product_value -> 'sourceSnapshot');

    insert into cloud.import_sources (
      import_run_id, source_id, source_type, source_location, snapshot, checksum_sha256
    ) values (
      run_id, product_value ->> 'sourceUid', product_value ->> 'sourceType',
      product_value ->> 'sourceUrl', product_value -> 'sourceSnapshot', source_checksum
    ) returning id into source_id;

    insert into cloud.products (
      id, slug, title, model, manufacturer_id, category_id,
      short_description, full_description, source_type, source_url, confidence,
      publication_status, source_uid, source_checksum, snapshot_version,
      created_from_snapshot_at, legacy_metadata, import_batch_key, needs_review,
      review_reason, missing_manufacturer, missing_category,
      missing_application_area, missing_characteristics, missing_registration,
      missing_documents, missing_media, import_warnings, review_state,
      seo_title, seo_description, updated_by, missing_model,
      catalog_quality_status, catalog_quality_reason
    ) values (
      product_id, product_value ->> 'slug', product_value ->> 'title',
      product_value ->> 'model', (product_value ->> 'manufacturerId')::uuid,
      (product_value ->> 'categoryId')::uuid,
      product_value ->> 'shortDescription', product_value ->> 'fullDescription',
      product_value ->> 'sourceType', product_value ->> 'sourceUrl', 'reviewed',
      'draft', product_value ->> 'sourceUid', source_checksum,
      product_value ->> 'snapshotVersion', clock_timestamp(),
      jsonb_build_object(
        'acceptedStageCommit', p_manifest ->> 'acceptedStageCommit',
        'acceptedMasterCorrective', p_manifest ->> 'acceptedMasterCorrective',
        'sourceSnapshot', product_value -> 'sourceSnapshot',
        'mediaEvidence', product_value -> 'media'
      ),
      'production-launch-catalog-import-v1', true,
      array['missing_registration', 'missing_documents'],
      false, false, false, false, true, true, false,
      array['missing_registration', 'missing_documents'], 'pending',
      product_value ->> 'seoTitle', product_value ->> 'seoDescription',
      'cybermedicaooo@gmail.com', false, 'READY',
      array['missing_registration', 'missing_documents']
    );

    insert into cloud.product_descriptions (
      product_id, locale, short_description, full_description, confidence
    ) values (
      product_id, 'ru', product_value ->> 'shortDescription',
      product_value ->> 'fullDescription', 'reviewed'
    );

    for application_area_value in
      select value from jsonb_array_elements(product_value -> 'applicationAreaIds')
    loop
      if not exists (
        select 1 from cloud.application_areas area
        where area.id = (application_area_value #>> '{}')::uuid
          and area.publication_status = 'published' and area.archived_at is null
      ) then
        raise exception 'Product application-area binding drift' using errcode = '55000';
      end if;
      insert into cloud.product_application_areas (product_id, application_area_id)
      values (product_id, (application_area_value #>> '{}')::uuid);
    end loop;

    for media_value in select value from jsonb_array_elements(product_value -> 'media') loop
      if media_value ->> 'publicUrl' !~ '^https://cyber-medica\.ru/media/'
         or media_value ->> 'checksumSha256' !~ '^[a-f0-9]{64}$' then
        raise exception 'Product media evidence is invalid' using errcode = '22023';
      end if;
      insert into cloud.product_media (
        product_id, source_url, role, media_format, sort_order, import_batch_key
      ) values (
        product_id, media_value ->> 'publicUrl', media_value ->> 'role',
        media_value ->> 'format', (media_value ->> 'sortOrder')::integer,
        'production-launch-catalog-import-v1'
      );
    end loop;

    perform cloud.validate_structured_product_detail_candidate_v1(
      product_value -> 'structuredDetail'
    );

    insert into cloud.import_products (
      import_run_id, import_source_id, source_id, legacy_slug, status,
      identity_status, manufacturer_status, category_status, readiness_status,
      extracted_product, normalized_candidate, publication_candidate,
      existing_product_id
    ) values (
      run_id, source_id, product_value ->> 'sourceUid', product_value ->> 'slug',
      'ready_for_review', 'exact', 'resolved', 'resolved', 'ready',
      product_value -> 'sourceSnapshot', product_value,
      product_value -> 'structuredDetail', product_id
    ) returning id into import_product_id;

    insert into cloud.review_items (import_product_id, status, priority)
    values (import_product_id, 'pending', 'high');

    insert into cloud.publication_candidates (
      import_product_id, target_product_id, schema_version, candidate_data,
      validation_status, blocking_error_count, warning_count
    ) values (
      import_product_id, product_id, 1, product_value -> 'structuredDetail',
      'valid', 0, 2
    );

    insert into cloud.import_warnings (
      import_product_id, code, field_path, message, metadata
    ) values
      (import_product_id, 'missing_registration', 'registration',
       'Регистрационные сведения требуют отдельной проверки.', '{}'::jsonb),
      (import_product_id, 'missing_documents', 'documents',
       'Документы требуют отдельной проверки.', '{}'::jsonb);

    imported := imported + 1;
  end loop;

  if imported <> 43 then
    raise exception 'Production launch import count drift' using errcode = '55000';
  end if;

  insert into cloud.audit_log (
    actor_id, action, entity_type, entity_id, before_data, after_data, source, request_id
  ) values (
    '7e90a993-8b30-4e0d-aff4-a257d5a4a179'::uuid, 'create', 'import_run', run_id,
    null, jsonb_build_object('products', imported, 'manifestSha256', p_manifest_sha256),
    'cloud_api.production_launch_release_import_v1',
    'production-launch-catalog-import-v1'
  );

  return jsonb_build_object(
    'status', 'completed', 'importRunId', run_id, 'products', imported,
    'manifestSha256', p_manifest_sha256
  );
end
$$;

create or replace function cloud.production_launch_release_create_structured_revisions_v1(
  p_manifest_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, cloud
as $$
declare
  candidate record;
  result_value jsonb;
  results jsonb := '[]'::jsonb;
  existing_count integer;
begin
  if not cloud.is_service_request() then
    raise exception 'Structured revision creation requires service role' using errcode = '42501';
  end if;
  if p_manifest_sha256 <> 'aa66f41be007cab08f16015d1a158e0381eca32c8e98afaa4a33452155ccc309'
     or (select count(*) from cloud.products where id = any(cloud.production_launch_release_scope_v1())) <> 43 then
    raise exception 'Production launch structured revision scope is invalid' using errcode = '22023';
  end if;
  select count(*) into existing_count
  from cloud.product_detail_candidate_revisions
  where product_id = any(cloud.production_launch_release_scope_v1());
  if existing_count > 0 then
    if existing_count <> 43
       or (select count(distinct product_id) from cloud.product_detail_candidate_revisions
           where product_id = any(cloud.production_launch_release_scope_v1())) <> 43 then
      raise exception 'Structured revision state is partial or duplicated' using errcode = '55000';
    end if;
    select jsonb_agg(jsonb_build_object(
      'candidateRevisionId', revision.id,
      'candidateId', revision.candidate_id,
      'productId', revision.product_id,
      'revisionNumber', revision.revision_number,
      'schemaVersion', revision.schema_version,
      'payloadChecksum', revision.payload_checksum,
      'productIdentityChecksum', revision.product_identity_checksum,
      'idempotent', true
    ) order by revision.product_id) into results
    from cloud.product_detail_candidate_revisions revision
    where revision.product_id = any(cloud.production_launch_release_scope_v1());
    return jsonb_build_object('status', 'already_complete', 'revisions', results);
  end if;
  for candidate in
    select publication_candidate.id, publication_candidate.target_product_id
    from cloud.publication_candidates publication_candidate
    where publication_candidate.target_product_id = any(cloud.production_launch_release_scope_v1())
    order by publication_candidate.target_product_id
  loop
    result_value := cloud.create_structured_product_detail_revision_v1(
      candidate.id, '7e90a993-8b30-4e0d-aff4-a257d5a4a179'::uuid
    );
    results := results || jsonb_build_array(result_value);
  end loop;
  if jsonb_array_length(results) <> 43 then
    raise exception 'Structured revision creation count drift' using errcode = '55000';
  end if;
  return jsonb_build_object(
    'status', case when exists (
      select 1 from jsonb_array_elements(results) item where (item ->> 'idempotent')::boolean = false
    ) then 'completed' else 'already_complete' end,
    'revisions', results
  );
end
$$;

create or replace function cloud.production_launch_release_review_structured_v1(
  p_manifest_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, auth, cloud, extensions
as $$
declare
  reviewer_id uuid;
  caller_claims jsonb := auth.jwt();
  revision_row record;
  review_item_id uuid;
  item jsonb;
  approved_at_value timestamptz;
  inserted_decisions integer := 0;
  approvals_created integer := 0;
begin
  reviewer_id := cloud.production_launch_release_assert_corporate_reviewer_v1();
  if p_manifest_sha256 <> 'aa66f41be007cab08f16015d1a158e0381eca32c8e98afaa4a33452155ccc309' then
    raise exception 'Production launch manifest digest mismatch' using errcode = '22023';
  end if;

  if (select count(*) from cloud.product_detail_candidate_revisions
      where product_id = any(cloud.production_launch_release_scope_v1())) <> 43 then
    raise exception 'Structured revisions are incomplete' using errcode = '55000';
  end if;

  if (select count(*) from cloud.product_detail_candidate_revision_approvals approval
      join cloud.product_detail_candidate_revisions revision
        on revision.id = approval.candidate_revision_id
      where revision.product_id = any(cloud.production_launch_release_scope_v1())) = 43 then
    return jsonb_build_object(
      'status', 'already_complete', 'approvals', 43,
      'decisions', (select count(*) from cloud.review_decisions decision
        join cloud.product_detail_candidate_revisions revision
          on revision.id = decision.candidate_revision_id
        where revision.product_id = any(cloud.production_launch_release_scope_v1())
          and decision.decision_type = 'structured_field')
    );
  end if;

  if exists (
    select 1 from cloud.review_decisions decision
    join cloud.product_detail_candidate_revisions revision
      on revision.id = decision.candidate_revision_id
    where revision.product_id = any(cloud.production_launch_release_scope_v1())
  ) or exists (
    select 1 from cloud.product_detail_candidate_revision_approvals approval
    join cloud.product_detail_candidate_revisions revision
      on revision.id = approval.candidate_revision_id
    where revision.product_id = any(cloud.production_launch_release_scope_v1())
  ) then
    raise exception 'Structured review is partially applied' using errcode = '55000';
  end if;

  -- Projection reconciliation is a service-only internal boundary. The
  -- authenticated corporate identity was captured and verified above; only
  -- the transaction-local role claim is elevated for trigger execution.
  perform set_config(
    'request.jwt.claims',
    jsonb_set(caller_claims, '{role}', to_jsonb('service_role'::text), true)::text,
    true
  );

  for revision_row in
    select detail_revision.*, candidate.import_product_id
    from cloud.product_detail_candidate_revisions detail_revision
    join cloud.publication_candidates candidate on candidate.id = detail_revision.candidate_id
    where detail_revision.product_id = any(cloud.production_launch_release_scope_v1())
    order by detail_revision.product_id
  loop
    select id into review_item_id
    from cloud.review_items where import_product_id = revision_row.import_product_id for update;
    if review_item_id is null then
      raise exception 'Structured review item binding is missing' using errcode = '55000';
    end if;
    approved_at_value := clock_timestamp();

    for item in select value from jsonb_array_elements(revision_row.candidate_payload -> 'keyFeatures') loop
      insert into cloud.review_decisions (
        review_item_id, decision_type, field_path, proposed_value, approved_value,
        decision, reviewer_id, rationale, candidate_revision_id,
        approved_payload_checksum, product_identity_checksum, created_at
      ) values (
        review_item_id, 'structured_field',
        'structuredProductDetail.keyFeatures.' || (item ->> 'key'),
        item, item, 'approve', reviewer_id,
        'Product Owner accepted the exact Stage catalog for Production launch.',
        revision_row.id, revision_row.payload_checksum, revision_row.product_identity_checksum,
        approved_at_value
      );
      inserted_decisions := inserted_decisions + 1;
    end loop;

    for item in select value from jsonb_array_elements(revision_row.candidate_payload -> 'specifications') loop
      insert into cloud.review_decisions (
        review_item_id, decision_type, field_path, proposed_value, approved_value,
        decision, reviewer_id, rationale, candidate_revision_id,
        approved_payload_checksum, product_identity_checksum, created_at
      ) values (
        review_item_id, 'structured_field',
        'structuredProductDetail.specifications.' || (item ->> 'key'),
        item, item, 'approve', reviewer_id,
        'Product Owner accepted the exact Stage catalog for Production launch.',
        revision_row.id, revision_row.payload_checksum, revision_row.product_identity_checksum,
        approved_at_value
      );
      inserted_decisions := inserted_decisions + 1;
    end loop;

    update cloud.publication_candidates set
      validation_status = 'approved', approved_by = reviewer_id,
      approved_at = approved_at_value, updated_at = approved_at_value
    where id = revision_row.candidate_id and candidate_data = revision_row.candidate_payload;
    if not found then
      raise exception 'Structured candidate changed after revision creation' using errcode = '55000';
    end if;

    insert into cloud.product_detail_candidate_revision_approvals (
      candidate_revision_id, review_item_id, payload_checksum,
      product_identity_checksum, decision, reviewer_id, approved_at
    ) values (
      revision_row.id, review_item_id, revision_row.payload_checksum,
      revision_row.product_identity_checksum, 'approve', reviewer_id, approved_at_value
    );
    update cloud.review_items set
      status = 'approved', assigned_to = reviewer_id,
      reviewed_at = approved_at_value, updated_at = approved_at_value
    where id = review_item_id;
    approvals_created := approvals_created + 1;
  end loop;

  if approvals_created <> 43 or inserted_decisions <> 549 then
    raise exception 'Structured review count drift' using errcode = '55000';
  end if;
  return jsonb_build_object(
    'status', 'completed', 'approvals', approvals_created,
    'decisions', inserted_decisions, 'reviewerId', reviewer_id
  );
end
$$;

create or replace function cloud.production_launch_release_publish_structured_v1(
  p_manifest_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, cloud
as $$
declare
  revision_row record;
  result_value jsonb;
  results jsonb := '[]'::jsonb;
  existing_count integer;
begin
  if not cloud.is_service_request() then
    raise exception 'Structured publication requires service role' using errcode = '42501';
  end if;
  if p_manifest_sha256 <> 'aa66f41be007cab08f16015d1a158e0381eca32c8e98afaa4a33452155ccc309'
     or (select count(*) from cloud.product_detail_candidate_revision_approvals approval
         join cloud.product_detail_candidate_revisions detail_revision
           on detail_revision.id = approval.candidate_revision_id
         where detail_revision.product_id = any(cloud.production_launch_release_scope_v1())) <> 43 then
    raise exception 'Structured publication scope is not fully approved' using errcode = '55000';
  end if;
  select count(*) into existing_count
  from cloud.product_detail_publication_batches batch
  where batch.product_id = any(cloud.production_launch_release_scope_v1())
    and batch.status = 'published';
  if existing_count > 0 then
    if existing_count <> 43
       or (select count(distinct batch.product_id)
           from cloud.product_detail_publication_batches batch
           where batch.product_id = any(cloud.production_launch_release_scope_v1())
             and batch.status = 'published') <> 43 then
      raise exception 'Structured publication state is partial or duplicated' using errcode = '55000';
    end if;
    select jsonb_agg(jsonb_build_object(
      'publicationBatchId', batch.id,
      'candidateId', batch.candidate_id,
      'candidateRevisionId', batch.candidate_revision_id,
      'productId', batch.product_id,
      'status', batch.status,
      'keyFeatureCount', coalesce((batch.result_summary ->> 'keyFeatureCount')::integer, 0),
      'specificationCount', coalesce((batch.result_summary ->> 'specificationCount')::integer, 0),
      'idempotent', true
    ) order by batch.product_id) into results
    from cloud.product_detail_publication_batches batch
    where batch.product_id = any(cloud.production_launch_release_scope_v1())
      and batch.status = 'published';
    return jsonb_build_object('status', 'already_complete', 'publications', results);
  end if;
  for revision_row in
    select detail_revision.id, detail_revision.product_id
    from cloud.product_detail_candidate_revisions detail_revision
    where detail_revision.product_id = any(cloud.production_launch_release_scope_v1())
    order by detail_revision.product_id
  loop
    result_value := cloud.publish_structured_product_detail_v2(
      revision_row.id, 1,
      'production-launch-structured-' || revision_row.product_id::text,
      '7e90a993-8b30-4e0d-aff4-a257d5a4a179'::uuid
    );
    results := results || jsonb_build_array(result_value);
  end loop;
  if jsonb_array_length(results) <> 43 then
    raise exception 'Structured publication count drift' using errcode = '55000';
  end if;
  return jsonb_build_object(
    'status', case when exists (
      select 1 from jsonb_array_elements(results) item where (item ->> 'idempotent')::boolean = false
    ) then 'completed' else 'already_complete' end,
    'publications', results
  );
end
$$;

create or replace function cloud.production_launch_release_create_product_revisions_v1(
  p_manifest_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, cloud
as $$
declare
  product_id_value uuid;
  result_value jsonb;
  results jsonb := '[]'::jsonb;
  existing_count integer;
begin
  if not cloud.is_service_request() then
    raise exception 'Product revision creation requires service role' using errcode = '42501';
  end if;
  if p_manifest_sha256 <> 'aa66f41be007cab08f16015d1a158e0381eca32c8e98afaa4a33452155ccc309'
     or (select count(*) from cloud.product_detail_publication_batches
         where product_id = any(cloud.production_launch_release_scope_v1())
           and status = 'published') <> 43 then
    raise exception 'Structured Product Detail publication is incomplete' using errcode = '55000';
  end if;
  select count(*) into existing_count
  from cloud.product_publication_revisions
  where product_id = any(cloud.production_launch_release_scope_v1());
  if existing_count > 0 then
    if existing_count <> 43
       or (select count(distinct product_id) from cloud.product_publication_revisions
           where product_id = any(cloud.production_launch_release_scope_v1())) <> 43 then
      raise exception 'Product revision state is partial or duplicated' using errcode = '55000';
    end if;
    select jsonb_agg(jsonb_build_object(
      'candidateRevisionId', revision.id,
      'productId', revision.product_id,
      'reviewItemId', revision.review_item_id,
      'revisionNumber', revision.revision_number,
      'schemaVersion', revision.schema_version,
      'candidatePayloadChecksum', revision.candidate_payload_checksum,
      'payloadChecksum', revision.payload_checksum,
      'productIdentityChecksum', revision.product_identity_checksum,
      'idempotent', true
    ) order by revision.product_id) into results
    from cloud.product_publication_revisions revision
    where revision.product_id = any(cloud.production_launch_release_scope_v1());
    return jsonb_build_object('status', 'already_complete', 'revisions', results);
  end if;
  foreach product_id_value in array cloud.production_launch_release_scope_v1() loop
    result_value := cloud.create_product_publication_revision_v1(
      product_id_value,
      'production-launch-product-' || product_id_value::text || '-revision-1',
      cloud.trusted_product_publication_service_actor_v1()
    );
    results := results || jsonb_build_array(result_value);
  end loop;
  if jsonb_array_length(results) <> 43 then
    raise exception 'Product revision creation count drift' using errcode = '55000';
  end if;
  return jsonb_build_object(
    'status', case when exists (
      select 1 from jsonb_array_elements(results) item where (item ->> 'idempotent')::boolean = false
    ) then 'completed' else 'already_complete' end,
    'revisions', results
  );
end
$$;

create or replace function cloud.production_launch_release_review_products_v1(
  p_manifest_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, auth, cloud
as $$
declare
  reviewer_id_value uuid;
  caller_claims jsonb := auth.jwt();
  revision_row record;
  result_value jsonb;
  results jsonb := '[]'::jsonb;
  decision_id_value uuid;
  existing_decision cloud.review_decisions%rowtype;
  product cloud.products%rowtype;
  created_new boolean;
begin
  reviewer_id_value := cloud.production_launch_release_assert_corporate_reviewer_v1();
  if p_manifest_sha256 <> 'aa66f41be007cab08f16015d1a158e0381eca32c8e98afaa4a33452155ccc309'
     or (select count(*) from cloud.product_publication_revisions
         where product_id = any(cloud.production_launch_release_scope_v1())) <> 43 then
    raise exception 'Product publication revisions are incomplete' using errcode = '55000';
  end if;
  if (select count(*) from cloud.review_decisions decision
      join cloud.product_publication_revisions revision
        on revision.id = decision.product_publication_revision_id
      where revision.product_id = any(cloud.production_launch_release_scope_v1())
        and decision.decision_type = 'product_publication'
        and decision.decision = 'approve'
        and decision.reviewer_id = reviewer_id_value) = 43 then
    select jsonb_agg(jsonb_build_object(
      'reviewDecisionId', decision.id,
      'candidateRevisionId', revision.id,
      'productId', revision.product_id,
      'reviewerId', decision.reviewer_id,
      'payloadChecksum', revision.payload_checksum,
      'idempotent', true
    ) order by revision.product_id) into results
    from cloud.review_decisions decision
    join cloud.product_publication_revisions revision
      on revision.id = decision.product_publication_revision_id
    where revision.product_id = any(cloud.production_launch_release_scope_v1())
      and decision.decision_type = 'product_publication'
      and decision.decision = 'approve'
      and decision.reviewer_id = reviewer_id_value;
    return jsonb_build_object(
      'status', 'already_complete', 'decisions', results,
      'reviewerId', reviewer_id_value
    );
  end if;
  perform set_config(
    'request.jwt.claims',
    jsonb_set(caller_claims, '{role}', to_jsonb('service_role'::text), true)::text,
    true
  );

  for revision_row in
    select * from cloud.product_publication_revisions
    where product_id = any(cloud.production_launch_release_scope_v1())
    order by product_id
  loop
    perform pg_advisory_xact_lock(hashtextextended(revision_row.product_id::text, 2));
    select * into product from cloud.products
    where id = revision_row.product_id for update;
    if product.publication_status <> 'in_review'
       or product.current_product_publication_revision_id is distinct from revision_row.id
       or cloud.product_publication_identity_snapshot_v1(product.id)
            is distinct from revision_row.product_identity
       or cloud.product_publication_candidate_payload_v1(product.id)
            is distinct from revision_row.candidate_payload then
      raise exception 'Product review revision is no longer current' using errcode = '55000';
    end if;

    select * into existing_decision
    from cloud.review_decisions decision
    where decision.product_publication_revision_id = revision_row.id
      and decision.reviewer_id = reviewer_id_value
      and decision.decision_type = 'product_publication'
      and decision.decision = 'approve';
    created_new := not found;
    if created_new then
      insert into cloud.review_decisions (
        review_item_id, decision_type, field_path, proposed_value, approved_value,
        decision, reviewer_id, rationale, product_publication_revision_id,
        approved_payload_checksum, product_identity_checksum
      ) values (
        revision_row.review_item_id, 'product_publication', 'product',
        revision_row.candidate_payload, revision_row.candidate_payload, 'approve',
        reviewer_id_value,
        'Product Owner accepted the exact Stage catalog for Production launch.',
        revision_row.id, revision_row.payload_checksum,
        revision_row.product_identity_checksum
      ) returning id into decision_id_value;
    else
      if existing_decision.rationale <>
           'Product Owner accepted the exact Stage catalog for Production launch.'
         or existing_decision.approved_payload_checksum <> revision_row.payload_checksum
         or existing_decision.product_identity_checksum <> revision_row.product_identity_checksum then
        raise exception 'Product review replay differs from immutable decision' using errcode = '23505';
      end if;
      decision_id_value := existing_decision.id;
    end if;
    result_value := jsonb_build_object(
      'reviewDecisionId', decision_id_value,
      'candidateRevisionId', revision_row.id,
      'productId', revision_row.product_id,
      'reviewerId', reviewer_id_value,
      'payloadChecksum', revision_row.payload_checksum,
      'idempotent', not created_new
    );
    results := results || jsonb_build_array(result_value);
  end loop;
  if jsonb_array_length(results) <> 43 then
    raise exception 'Product review count drift' using errcode = '55000';
  end if;
  return jsonb_build_object(
    'status', case when exists (
      select 1 from jsonb_array_elements(results) item where (item ->> 'idempotent')::boolean = false
    ) then 'completed' else 'already_complete' end,
    'decisions', results, 'reviewerId', reviewer_id_value
  );
end
$$;

create or replace function cloud.production_launch_release_publish_products_v1(
  p_manifest_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, cloud
as $$
declare
  revision_row record;
  decision_id uuid;
  approval_value jsonb;
  publication_value jsonb;
  approvals jsonb := '[]'::jsonb;
  publications jsonb := '[]'::jsonb;
  already_complete boolean;
begin
  if not cloud.is_service_request() then
    raise exception 'Product publication requires service role' using errcode = '42501';
  end if;
  if p_manifest_sha256 <> 'aa66f41be007cab08f16015d1a158e0381eca32c8e98afaa4a33452155ccc309' then
    raise exception 'Production launch manifest digest mismatch' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('production-launch-product-publication-v1', 0));

  already_complete := (select count(*) from cloud.products
    where id = any(cloud.production_launch_release_scope_v1())
      and publication_status = 'published') = 43;
  if already_complete then
    return jsonb_build_object(
      'status', 'already_complete', 'published', 43,
      'totalPublished', (select count(*) from cloud.products where publication_status = 'published')
    );
  end if;

  if (select count(*) from cloud.products
      where id = any(cloud.production_launch_release_scope_v1())
        and publication_status = 'in_review') <> 43
     or (select count(*) from cloud.product_publication_revisions revision
         join cloud.review_decisions decision
           on decision.product_publication_revision_id = revision.id
          and decision.decision_type = 'product_publication'
          and decision.decision = 'approve'
          and decision.reviewer_id = '7e90a993-8b30-4e0d-aff4-a257d5a4a179'::uuid
         where revision.product_id = any(cloud.production_launch_release_scope_v1())) <> 43
     or exists (
       select 1 from cloud.product_publication_approvals approval
       join cloud.product_publication_revisions revision
         on revision.id = approval.candidate_revision_id
       where revision.product_id = any(cloud.production_launch_release_scope_v1())
     )
     or exists (
       select 1 from cloud.product_publication_batches batch
       where batch.product_id = any(cloud.production_launch_release_scope_v1())
     ) then
    raise exception 'Product publication wave is not an exact clean 43-Product scope' using errcode = '55000';
  end if;

  for revision_row in
    select * from cloud.product_publication_revisions
    where product_id = any(cloud.production_launch_release_scope_v1())
    order by product_id
  loop
    select decision.id into decision_id
    from cloud.review_decisions decision
    where decision.product_publication_revision_id = revision_row.id
      and decision.decision_type = 'product_publication'
      and decision.decision = 'approve';
    approval_value := cloud.approve_product_publication_decision_v1(revision_row.id, decision_id);
    publication_value := cloud.publish_product_v1(
      revision_row.id,
      'production-launch-publication-' || revision_row.product_id::text,
      cloud.trusted_product_publication_service_actor_v1()
    );
    approvals := approvals || jsonb_build_array(approval_value);
    publications := publications || jsonb_build_array(publication_value);
  end loop;

  if jsonb_array_length(approvals) <> 43
     or jsonb_array_length(publications) <> 43
     or (select count(*) from cloud.products where publication_status = 'published') <> 114 then
    raise exception 'Production launch publication count drift' using errcode = '55000';
  end if;
  return jsonb_build_object(
    'status', 'completed', 'approvals', approvals, 'publications', publications,
    'published', 43, 'totalPublished', 114
  );
end
$$;

create or replace function cloud_api.production_launch_release_import_v1(
  p_manifest jsonb,
  p_manifest_sha256 text
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, cloud
as $$
  select cloud.production_launch_release_import_v1(p_manifest, p_manifest_sha256)
$$;

create or replace function cloud_api.production_launch_release_create_structured_revisions_v1(
  p_manifest_sha256 text
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, cloud
as $$
  select cloud.production_launch_release_create_structured_revisions_v1(p_manifest_sha256)
$$;

create or replace function cloud_api.production_launch_release_review_structured_v1(
  p_manifest_sha256 text
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, cloud
as $$
  select cloud.production_launch_release_review_structured_v1(p_manifest_sha256)
$$;

create or replace function cloud_api.production_launch_release_publish_structured_v1(
  p_manifest_sha256 text
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, cloud
as $$
  select cloud.production_launch_release_publish_structured_v1(p_manifest_sha256)
$$;

create or replace function cloud_api.production_launch_release_create_product_revisions_v1(
  p_manifest_sha256 text
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, cloud
as $$
  select cloud.production_launch_release_create_product_revisions_v1(p_manifest_sha256)
$$;

create or replace function cloud_api.production_launch_release_review_products_v1(
  p_manifest_sha256 text
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, cloud
as $$
  select cloud.production_launch_release_review_products_v1(p_manifest_sha256)
$$;

create or replace function cloud_api.production_launch_release_publish_products_v1(
  p_manifest_sha256 text
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, cloud
as $$
  select cloud.production_launch_release_publish_products_v1(p_manifest_sha256)
$$;

alter function cloud.validate_structured_product_detail_candidate_v1(jsonb) owner to postgres;
alter function cloud.production_launch_release_scope_v1() owner to postgres;
alter function cloud.production_launch_release_assert_manifest_v1(jsonb, text) owner to postgres;
alter function cloud.production_launch_release_assert_corporate_reviewer_v1() owner to postgres;
alter function cloud.production_launch_release_import_v1(jsonb, text) owner to postgres;
alter function cloud.production_launch_release_create_structured_revisions_v1(text) owner to postgres;
alter function cloud.production_launch_release_review_structured_v1(text) owner to postgres;
alter function cloud.production_launch_release_publish_structured_v1(text) owner to postgres;
alter function cloud.production_launch_release_create_product_revisions_v1(text) owner to postgres;
alter function cloud.production_launch_release_review_products_v1(text) owner to postgres;
alter function cloud.production_launch_release_publish_products_v1(text) owner to postgres;
alter function cloud_api.production_launch_release_import_v1(jsonb, text) owner to postgres;
alter function cloud_api.production_launch_release_create_structured_revisions_v1(text) owner to postgres;
alter function cloud_api.production_launch_release_review_structured_v1(text) owner to postgres;
alter function cloud_api.production_launch_release_publish_structured_v1(text) owner to postgres;
alter function cloud_api.production_launch_release_create_product_revisions_v1(text) owner to postgres;
alter function cloud_api.production_launch_release_review_products_v1(text) owner to postgres;
alter function cloud_api.production_launch_release_publish_products_v1(text) owner to postgres;

revoke all on function cloud.validate_structured_product_detail_candidate_v1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function cloud.production_launch_release_scope_v1()
  from public, anon, authenticated, service_role;
revoke all on function cloud.production_launch_release_assert_manifest_v1(jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function cloud.production_launch_release_assert_corporate_reviewer_v1()
  from public, anon, authenticated, service_role;
revoke all on function cloud.production_launch_release_import_v1(jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function cloud.production_launch_release_create_structured_revisions_v1(text)
  from public, anon, authenticated, service_role;
revoke all on function cloud.production_launch_release_review_structured_v1(text)
  from public, anon, authenticated, service_role;
revoke all on function cloud.production_launch_release_publish_structured_v1(text)
  from public, anon, authenticated, service_role;
revoke all on function cloud.production_launch_release_create_product_revisions_v1(text)
  from public, anon, authenticated, service_role;
revoke all on function cloud.production_launch_release_review_products_v1(text)
  from public, anon, authenticated, service_role;
revoke all on function cloud.production_launch_release_publish_products_v1(text)
  from public, anon, authenticated, service_role;

revoke all on function cloud_api.production_launch_release_import_v1(jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function cloud_api.production_launch_release_create_structured_revisions_v1(text)
  from public, anon, authenticated, service_role;
revoke all on function cloud_api.production_launch_release_review_structured_v1(text)
  from public, anon, authenticated, service_role;
revoke all on function cloud_api.production_launch_release_publish_structured_v1(text)
  from public, anon, authenticated, service_role;
revoke all on function cloud_api.production_launch_release_create_product_revisions_v1(text)
  from public, anon, authenticated, service_role;
revoke all on function cloud_api.production_launch_release_review_products_v1(text)
  from public, anon, authenticated, service_role;
revoke all on function cloud_api.production_launch_release_publish_products_v1(text)
  from public, anon, authenticated, service_role;

grant execute on function cloud_api.production_launch_release_import_v1(jsonb, text)
  to service_role;
grant execute on function cloud_api.production_launch_release_create_structured_revisions_v1(text)
  to service_role;
grant execute on function cloud_api.production_launch_release_review_structured_v1(text)
  to authenticated;
grant execute on function cloud_api.production_launch_release_publish_structured_v1(text)
  to service_role;
grant execute on function cloud_api.production_launch_release_create_product_revisions_v1(text)
  to service_role;
grant execute on function cloud_api.production_launch_release_review_products_v1(text)
  to authenticated;
grant execute on function cloud_api.production_launch_release_publish_products_v1(text)
  to service_role;

comment on function cloud_api.production_launch_release_import_v1(jsonb, text) is
  'Exact 43-Product accepted Stage import. Service-only and manifest-bound.';
comment on function cloud_api.production_launch_release_review_structured_v1(text) is
  'Exact accepted Stage structured-field review through the active corporate admin session.';
comment on function cloud_api.production_launch_release_review_products_v1(text) is
  'Exact accepted Stage Product review through the active corporate admin session.';
comment on function cloud_api.production_launch_release_publish_products_v1(text) is
  'Atomic exact 43-Product Approval and Publication wave.';

commit;
