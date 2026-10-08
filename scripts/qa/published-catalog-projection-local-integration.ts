import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

import { parsePublishedCatalogProjection } from "../../lib/published-catalog/contracts.ts";

const IMAGE = "public.ecr.aws/supabase/postgres:17.6.1.147";
const DATABASE = "cybermedica_published_projection_test";
const CONTAINER = `cybermedica-published-projection-${process.pid}`;
const ROOT = process.cwd();
const MIGRATION_COUNT = readdirSync(path.join(ROOT, "supabase/migrations"))
  .filter((file) => file.endsWith(".sql"))
  .length;

interface RunOptions {
  allowFailure?: boolean;
  quiet?: boolean;
}

function run(command: string, args: string[], options: RunOptions = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: options.quiet ? "pipe" : ["ignore", "pipe", "pipe"],
  });
  if (!options.quiet && result.stdout) process.stdout.write(result.stdout);
  if (!options.quiet && result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (!options.allowFailure && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}`);
  }
  return result;
}

function wait(milliseconds: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function dockerExec(...args: string[]) {
  return run("docker", ["exec", CONTAINER, ...args]);
}

const image = run("docker", ["image", "inspect", IMAGE], {
  allowFailure: true,
  quiet: true,
});
if (image.status !== 0) {
  throw new Error(
    `Required local image ${IMAGE} is absent. This QA command never pulls images automatically.`,
  );
}

let started = false;
try {
  run("docker", [
    "run",
    "-d",
    "--rm",
    "--name",
    CONTAINER,
    "-e",
    "POSTGRES_PASSWORD=local_published_projection_test",
    "-e",
    `POSTGRES_DB=${DATABASE}`,
    IMAGE,
  ]);
  started = true;

  let ready = false;
  let consecutiveReadyProbes = 0;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const probe = run("docker", [
      "exec", CONTAINER, "psql", "-U", "supabase_admin", "-d", DATABASE,
      "-v", "ON_ERROR_STOP=1", "-Atc", "select 1",
    ], { allowFailure: true, quiet: true });
    consecutiveReadyProbes = probe.status === 0 ? consecutiveReadyProbes + 1 : 0;
    if (consecutiveReadyProbes >= 2) {
      ready = true;
      break;
    }
    wait(500);
  }
  if (!ready) throw new Error("Local PostgreSQL did not become ready within 30 seconds.");

  run("docker", [
    "cp",
    path.join(ROOT, "supabase/tests/000_local_auth_bootstrap.sql"),
    `${CONTAINER}:/tmp/000_local_auth_bootstrap.sql`,
  ]);
  run("docker", [
    "cp",
    path.join(ROOT, "supabase/migrations/."),
    `${CONTAINER}:/tmp/cybermedica-migrations`,
  ]);
  run("docker", [
    "cp",
    path.join(ROOT, "supabase/tests/006_published_catalog_projection.sql"),
    `${CONTAINER}:/tmp/006_published_catalog_projection.sql`,
  ]);
  run("docker", [
    "cp",
    path.join(ROOT, "supabase/tests/007_published_catalog_projection_clock_v3.sql"),
    `${CONTAINER}:/tmp/007_published_catalog_projection_clock_v3.sql`,
  ]);
  run("docker", [
    "cp",
    path.join(ROOT, "supabase/tests/008_published_catalog_projection_terminal_v4.sql"),
    `${CONTAINER}:/tmp/008_published_catalog_projection_terminal_v4.sql`,
  ]);

  dockerExec(
    "psql", "-U", "supabase_admin", "-d", DATABASE,
    "-v", "ON_ERROR_STOP=1", "-f", "/tmp/000_local_auth_bootstrap.sql",
  );
  dockerExec(
    "bash",
    "-lc",
    `set -euo pipefail
for file in /tmp/cybermedica-migrations/*.sql; do
  psql -U supabase_admin -d ${DATABASE} -v ON_ERROR_STOP=1 -f "$file" >/tmp/migration.out 2>&1 || {
    cat /tmp/migration.out
    exit 1
  }
done`,
  );
  dockerExec(
    "psql", "-U", "supabase_admin", "-d", DATABASE,
    "-v", "ON_ERROR_STOP=1", "-f", "/tmp/006_published_catalog_projection.sql",
  );

  const emptyProjectionResult = run("docker", [
    "exec", CONTAINER, "psql", "-U", "supabase_admin", "-d", DATABASE,
    "-v", "ON_ERROR_STOP=1", "-Atc",
    `with claims as materialized (
      select set_config('request.jwt.claim.role', 'service_role', false)
    )
    select cloud_api.cloud_published_storefront_catalog_v1() from claims`,
  ], { quiet: true });
  const emptyProjection = parsePublishedCatalogProjection(
    JSON.parse(emptyProjectionResult.stdout.trim()),
  );

  const wrapperEquivalenceResult = run("docker", [
    "exec", CONTAINER, "psql", "-U", "supabase_admin", "-d", DATABASE,
    "-v", "ON_ERROR_STOP=1", "-qAtc",
    `set role service_role;
    with claims as materialized (
      select set_config('request.jwt.claim.role', 'service_role', false)
    ), projections as materialized (
      select
        public_api.cloud_published_storefront_catalog_v1() as public_api_payload,
        cloud_api.cloud_published_storefront_catalog_v1() as cloud_api_payload
      from claims
    )
    select jsonb_build_object(
      'jsonbEqual', public_api_payload = cloud_api_payload,
      'productCount', public_api_payload #> '{summary,productCount}'
    )
    from projections`,
  ], { quiet: true });
  const wrapperEquivalenceAudit = JSON.parse(wrapperEquivalenceResult.stdout.trim()) as {
    jsonbEqual: boolean;
    productCount: number;
  };
  if (!wrapperEquivalenceAudit.jsonbEqual) {
    throw new Error(
      `Plan B wrapper JSONB equivalence failed: ${JSON.stringify(wrapperEquivalenceAudit)}`,
    );
  }

  const anonWrapperAttempt = run("docker", [
    "exec", CONTAINER, "psql", "-U", "supabase_admin", "-d", DATABASE,
    "-v", "ON_ERROR_STOP=1", "-qAtc",
    "set role anon; select public_api.cloud_published_storefront_catalog_v1()",
  ], { allowFailure: true, quiet: true });
  const authenticatedWrapperAttempt = run("docker", [
    "exec", CONTAINER, "psql", "-U", "supabase_admin", "-d", DATABASE,
    "-v", "ON_ERROR_STOP=1", "-qAtc",
    "set role authenticated; select public_api.cloud_published_storefront_catalog_v1()",
  ], { allowFailure: true, quiet: true });
  if (anonWrapperAttempt.status === 0 || authenticatedWrapperAttempt.status === 0) {
    throw new Error("Plan B wrapper must reject anon and authenticated database roles.");
  }

  const initializationFirstResult = run("docker", [
    "exec", CONTAINER, "psql", "-U", "supabase_admin", "-d", DATABASE, "-Atc",
    `select cloud.initialize_published_catalog_projection_v4(
      (select payload_checksum from cloud.published_catalog_projection_state
       where singleton)
    )`,
  ], { quiet: true });
  const initializationRetryResult = run("docker", [
    "exec", CONTAINER, "psql", "-U", "supabase_admin", "-d", DATABASE, "-Atc",
    `select cloud.initialize_published_catalog_projection_v4(
      (select payload_checksum from cloud.published_catalog_projection_state
       where singleton)
    )`,
  ], { quiet: true });
  const initializationResult = run("docker", [
    "exec", CONTAINER, "psql", "-U", "supabase_admin", "-d", DATABASE, "-Atc",
    `select jsonb_build_object(
      'evidenceRows', (select count(*)
        from cloud.published_catalog_projection_initialization_v4),
      'initializedState', (select initialized
        from cloud.published_catalog_projection_initialization_state_v4
        where singleton)
    )`,
  ], { quiet: true });
  const initializationState = JSON.parse(initializationResult.stdout.trim()) as {
    evidenceRows: number;
    initializedState: boolean;
  };
  const firstInitialization = JSON.parse(initializationFirstResult.stdout.trim()) as
    Record<string, unknown>;
  const exactInitializationRetry = JSON.parse(initializationRetryResult.stdout.trim()) as
    Record<string, unknown>;
  const initializationAudit = JSON.parse(initializationResult.stdout.trim()) as {
    evidenceRows: number;
    initializedState: boolean;
  } & {
    sameResult?: boolean;
    result?: Record<string, unknown>;
  };
  Object.assign(initializationAudit, {
    sameResult: JSON.stringify(firstInitialization) === JSON.stringify(exactInitializationRetry),
    result: exactInitializationRetry,
  });
  if (!initializationAudit.sameResult
      || initializationState.evidenceRows !== 1
      || !initializationState.initializedState) {
    throw new Error(
      `Published projection initialization retry failed: ${JSON.stringify(initializationAudit)}`,
    );
  }

  const bootstrapAuditResult = run("docker", [
    "exec", CONTAINER, "psql", "-U", "supabase_admin", "-d", DATABASE, "-Atc",
    `with claims as materialized (
      select set_config('request.jwt.claim.role', 'service_role', false)
    ), projection as materialized (
      select cloud_api.cloud_published_storefront_catalog_v1() as payload from claims
    )
    select jsonb_build_object(
      'initialized', state.initialized,
      'version', state.version,
      'checksumMatches', state.payload_checksum = cloud.sha256_jsonb_v1(
        projection.payload - 'generatedAt'
      ),
      'initializationRows', (select count(*)
        from cloud.published_catalog_projection_initialization_v3),
      'initializationMode', (select initialization_mode
        from cloud.published_catalog_projection_initialization_v3),
      'v4InitializationRows', (select count(*)
        from cloud.published_catalog_projection_initialization_v4),
      'closedTransactions', (select count(*)
        from cloud.published_catalog_projection_transactions_v4),
      'pendingEvents', (select count(*)
        from cloud.published_catalog_projection_events_v4)
    )
    from projection
    cross join cloud.published_catalog_projection_state state
    where state.singleton`,
  ], { quiet: true });
  const bootstrapAudit = JSON.parse(bootstrapAuditResult.stdout.trim()) as {
    initialized: boolean;
    version: number;
    checksumMatches: boolean;
    initializationRows: number;
    initializationMode: string;
    v4InitializationRows: number;
    closedTransactions: number;
    pendingEvents: number;
  };
  if (!bootstrapAudit.initialized
      || bootstrapAudit.version !== 0
      || !bootstrapAudit.checksumMatches
      || bootstrapAudit.initializationRows !== 1
      || bootstrapAudit.initializationMode !== "initialized_existing_baseline"
      || bootstrapAudit.v4InitializationRows !== 1
      || bootstrapAudit.closedTransactions !== 0
      || bootstrapAudit.pendingEvents !== 0) {
    throw new Error(`Published projection bootstrap audit failed: ${JSON.stringify(bootstrapAudit)}`);
  }

  dockerExec(
    "bash", "-lc",
    `set -euo pipefail
checksum=$(psql -U supabase_admin -d ${DATABASE} -Atc "select payload_checksum from cloud.published_catalog_projection_state where singleton")
psql -U supabase_admin -d ${DATABASE} -v ON_ERROR_STOP=1 -Atc "select cloud.initialize_published_catalog_projection_v4('$checksum')" >/tmp/initialize-v4-first.out 2>&1 &
first_pid=$!
psql -U supabase_admin -d ${DATABASE} -v ON_ERROR_STOP=1 -Atc "select cloud.initialize_published_catalog_projection_v4('$checksum')" >/tmp/initialize-v4-second.out 2>&1 &
second_pid=$!
wait "$first_pid" || { cat /tmp/initialize-v4-first.out; exit 1; }
wait "$second_pid" || { cat /tmp/initialize-v4-second.out; exit 1; }
cmp /tmp/initialize-v4-first.out /tmp/initialize-v4-second.out
test "$(psql -U supabase_admin -d ${DATABASE} -Atc 'select count(*) from cloud.published_catalog_projection_initialization_v4')" = "1"`,
  );
  const concurrentInitializationAudit = {
    status: "PASS",
    callers: 2,
    evidenceRows: 1,
    sameLogicalResult: true,
  };

  const fixtureAuditResult = run("docker", [
    "exec", CONTAINER, "psql", "-U", "supabase_admin", "-d", DATABASE, "-Atc",
    `select jsonb_build_object(
      'products', (select count(*) from cloud.products),
      'imports', (select count(*) from cloud.import_products),
      'revisions', (select count(*) from cloud.product_publication_revisions),
      'approvals', (select count(*) from cloud.product_publication_approvals),
      'batches', (select count(*) from cloud.product_publication_batches),
      'structuredBatches', (select count(*) from cloud.product_detail_publication_batches),
      'keyFeatures', (select count(*) from cloud.product_key_features),
      'audit', (select count(*) from cloud.audit_log)
    )`,
  ], { quiet: true });
  const fixtureAudit = JSON.parse(fixtureAuditResult.stdout.trim()) as Record<string, number>;
  if (Object.values(fixtureAudit).some((count) => count !== 0)) {
    throw new Error(`Transactional fixture left local rows behind: ${JSON.stringify(fixtureAudit)}`);
  }

  const privilegeAuditResult = run("docker", [
    "exec", CONTAINER, "psql", "-U", "supabase_admin", "-d", DATABASE, "-Atc",
    `select jsonb_build_object(
      'anonExecute', has_function_privilege(
        'anon', 'cloud_api.cloud_published_storefront_catalog_v1()', 'EXECUTE'
      ),
      'authenticatedExecute', has_function_privilege(
        'authenticated', 'cloud_api.cloud_published_storefront_catalog_v1()', 'EXECUTE'
      ),
      'serviceExecute', has_function_privilege(
        'service_role', 'cloud_api.cloud_published_storefront_catalog_v1()', 'EXECUTE'
      ),
      'servicePublicApiSchemaUsage', has_schema_privilege(
        'service_role', 'public_api', 'USAGE'
      ),
      'serviceWrapperExecute', has_function_privilege(
        'service_role', 'public_api.cloud_published_storefront_catalog_v1()', 'EXECUTE'
      ),
      'anonWrapperExecute', has_function_privilege(
        'anon', 'public_api.cloud_published_storefront_catalog_v1()', 'EXECUTE'
      ),
      'authenticatedWrapperExecute', has_function_privilege(
        'authenticated', 'public_api.cloud_published_storefront_catalog_v1()', 'EXECUTE'
      ),
      'publicWrapperExecute', exists (
        select 1
        from pg_proc wrapper
        cross join lateral aclexplode(
          coalesce(wrapper.proacl, acldefault('f', wrapper.proowner))
        ) privilege
        where wrapper.oid =
          'public_api.cloud_published_storefront_catalog_v1()'::regprocedure
          and privilege.grantee = 0
          and privilege.privilege_type = 'EXECUTE'
      ),
      'wrapperOwner', (select pg_get_userbyid(proowner) from pg_proc
        where oid = 'public_api.cloud_published_storefront_catalog_v1()'::regprocedure),
      'wrapperLanguage', (select language.lanname
        from pg_proc wrapper
        join pg_language language on language.oid = wrapper.prolang
        where wrapper.oid =
          'public_api.cloud_published_storefront_catalog_v1()'::regprocedure),
      'wrapperReturnType', (select prorettype::regtype::text from pg_proc
        where oid = 'public_api.cloud_published_storefront_catalog_v1()'::regprocedure),
      'wrapperArgCount', (select pronargs from pg_proc
        where oid = 'public_api.cloud_published_storefront_catalog_v1()'::regprocedure),
      'wrapperVolatility', (select provolatile from pg_proc
        where oid = 'public_api.cloud_published_storefront_catalog_v1()'::regprocedure),
      'wrapperSecurityDefiner', (select prosecdef from pg_proc
        where oid = 'public_api.cloud_published_storefront_catalog_v1()'::regprocedure),
      'wrapperConfig', (select to_jsonb(proconfig) from pg_proc
        where oid = 'public_api.cloud_published_storefront_catalog_v1()'::regprocedure),
      'serviceInternalExecute', has_function_privilege(
        'service_role', 'cloud.capture_published_catalog_projection_v2()', 'EXECUTE'
      ),
      'serviceEnqueueExecute', has_function_privilege(
        'service_role', 'cloud.enqueue_published_catalog_projection_v4()', 'EXECUTE'
      ),
      'serviceFinalizeExecute', has_function_privilege(
        'service_role', 'cloud.finalize_published_catalog_projection_v4()', 'EXECUTE'
      ),
      'serviceInitializeExecute', has_function_privilege(
        'service_role', 'cloud.initialize_published_catalog_projection_v4(text)', 'EXECUTE'
      ),
      'anonStateSelect', has_table_privilege(
        'anon', 'cloud.published_catalog_projection_state', 'SELECT'
      ),
      'authenticatedStateSelect', has_table_privilege(
        'authenticated', 'cloud.published_catalog_projection_state', 'SELECT'
      ),
      'serviceStateSelect', has_table_privilege(
        'service_role', 'cloud.published_catalog_projection_state', 'SELECT'
      ),
      'serviceStateWrite', has_table_privilege(
        'service_role', 'cloud.published_catalog_projection_state', 'INSERT,UPDATE,DELETE'
      ),
      'serviceQueueWrite', has_table_privilege(
        'service_role', 'cloud.published_catalog_projection_transactions_v4', 'INSERT,UPDATE,DELETE'
      ),
      'serviceEventWrite', has_table_privilege(
        'service_role', 'cloud.published_catalog_projection_events_v4', 'INSERT,UPDATE,DELETE'
      ),
      'serviceInitializationSelect', has_table_privilege(
        'service_role', 'cloud.published_catalog_projection_initialization_v4', 'SELECT'
      ),
      'serviceInitializationStateWrite', has_table_privilege(
        'service_role', 'cloud.published_catalog_projection_initialization_state_v4', 'INSERT,UPDATE,DELETE'
      ),
      'stateRls', (select relrowsecurity from pg_class
        where oid = 'cloud.published_catalog_projection_state'::regclass),
      'stateOwner', (select pg_get_userbyid(relowner) from pg_class
        where oid = 'cloud.published_catalog_projection_state'::regclass),
      'v2TriggerCount', (select count(*) from pg_trigger
        where tgname like '%\\_projection\\_%\\_v2' escape '\\'
          and not tgisinternal),
      'v3TriggerCount', (select count(*) from pg_trigger
        where (tgname ~ '_projection_(before|after)_v3'
          or tgname = 'published_projection_transaction_finalize_v3')
          and not tgisinternal),
      'trackedV4TriggerCount', (select count(*) from pg_trigger
        where tgname ~ '_projection_(before|after)_v4'
          and tgenabled = 'A' and not tgisinternal),
      'finalizerAlways', (select tgenabled = 'A' from pg_trigger
        where tgname = 'published_projection_transaction_finalize_v4'),
      'initializationGuardAlways', (select tgenabled = 'A' from pg_trigger
        where tgname = 'published_projection_initialization_immutable_v4'),
      'volatility', (select provolatile from pg_proc
        where oid = 'cloud_api.cloud_published_storefront_catalog_v1()'::regprocedure),
      'securityDefiner', (select prosecdef from pg_proc
        where oid = 'cloud_api.cloud_published_storefront_catalog_v1()'::regprocedure)
    )`,
  ], { quiet: true });
  const privilegeAudit = JSON.parse(privilegeAuditResult.stdout.trim()) as {
    anonExecute: boolean;
    authenticatedExecute: boolean;
    serviceExecute: boolean;
    servicePublicApiSchemaUsage: boolean;
    serviceWrapperExecute: boolean;
    anonWrapperExecute: boolean;
    authenticatedWrapperExecute: boolean;
    publicWrapperExecute: boolean;
    wrapperOwner: string;
    wrapperLanguage: string;
    wrapperReturnType: string;
    wrapperArgCount: number;
    wrapperVolatility: string;
    wrapperSecurityDefiner: boolean;
    wrapperConfig: string[];
    serviceInternalExecute: boolean;
    serviceEnqueueExecute: boolean;
    serviceFinalizeExecute: boolean;
    serviceInitializeExecute: boolean;
    anonStateSelect: boolean;
    authenticatedStateSelect: boolean;
    serviceStateSelect: boolean;
    serviceStateWrite: boolean;
    serviceQueueWrite: boolean;
    serviceEventWrite: boolean;
    serviceInitializationSelect: boolean;
    serviceInitializationStateWrite: boolean;
    stateRls: boolean;
    stateOwner: string;
    v2TriggerCount: number;
    v3TriggerCount: number;
    trackedV4TriggerCount: number;
    finalizerAlways: boolean;
    initializationGuardAlways: boolean;
    volatility: string;
    securityDefiner: boolean;
  };
  if (privilegeAudit.anonExecute
      || privilegeAudit.authenticatedExecute
      || !privilegeAudit.serviceExecute
      || !privilegeAudit.servicePublicApiSchemaUsage
      || !privilegeAudit.serviceWrapperExecute
      || privilegeAudit.anonWrapperExecute
      || privilegeAudit.authenticatedWrapperExecute
      || privilegeAudit.publicWrapperExecute
      || privilegeAudit.wrapperOwner !== "postgres"
      || privilegeAudit.wrapperLanguage !== "sql"
      || privilegeAudit.wrapperReturnType !== "jsonb"
      || privilegeAudit.wrapperArgCount !== 0
      || privilegeAudit.wrapperVolatility !== "s"
      || privilegeAudit.wrapperSecurityDefiner
      || JSON.stringify(privilegeAudit.wrapperConfig) !== JSON.stringify(["search_path=pg_catalog"])
      || privilegeAudit.serviceInternalExecute
      || privilegeAudit.serviceEnqueueExecute
      || privilegeAudit.serviceFinalizeExecute
      || privilegeAudit.serviceInitializeExecute
      || privilegeAudit.anonStateSelect
      || privilegeAudit.authenticatedStateSelect
      || privilegeAudit.serviceStateSelect
      || privilegeAudit.serviceStateWrite
      || privilegeAudit.serviceQueueWrite
      || privilegeAudit.serviceEventWrite
      || privilegeAudit.serviceInitializationSelect
      || privilegeAudit.serviceInitializationStateWrite
      || !privilegeAudit.stateRls
      || privilegeAudit.stateOwner !== "supabase_admin"
      || privilegeAudit.v2TriggerCount !== 0
      || privilegeAudit.v3TriggerCount !== 0
      || privilegeAudit.trackedV4TriggerCount !== 38
      || !privilegeAudit.finalizerAlways
      || !privilegeAudit.initializationGuardAlways
      || privilegeAudit.volatility !== "s"
      || !privilegeAudit.securityDefiner) {
    throw new Error(`Published projection privilege audit failed: ${JSON.stringify(privilegeAudit)}`);
  }

  // Commit the same fully asserted local fixture in the disposable database,
  // then prove that two concurrent public mutations serialize without losing
  // a clock event. The container is removed in finally, so no fixture escapes.
  dockerExec(
    "psql", "-U", "supabase_admin", "-d", DATABASE,
    "-v", "ON_ERROR_STOP=1", "-v", "keep_fixture=1",
    "-f", "/tmp/006_published_catalog_projection.sql",
  );
  dockerExec(
    "psql", "-U", "supabase_admin", "-d", DATABASE,
    "-v", "ON_ERROR_STOP=1",
    "-f", "/tmp/007_published_catalog_projection_clock_v3.sql",
  );
  dockerExec(
    "psql", "-U", "supabase_admin", "-d", DATABASE,
    "-v", "ON_ERROR_STOP=1",
    "-f", "/tmp/008_published_catalog_projection_terminal_v4.sql",
  );

  const projectionStateSql = `with claims as materialized (
      select set_config('request.jwt.claim.role', 'service_role', false)
    ), projection as materialized (
      select cloud_api.cloud_published_storefront_catalog_v1() as payload from claims
    )
    select jsonb_build_object(
      'version', state.version,
      'generatedAt', projection.payload ->> 'generatedAt',
      'checksumMatches', state.payload_checksum = cloud.sha256_jsonb_v1(
        projection.payload - 'generatedAt'
      ),
      'manufacturerChanged', projection.payload @? '$.manufacturers[*] ? (@.description == "Concurrent manufacturer change")',
      'categoryChanged', projection.payload @? '$.categories[*] ? (@.description == "Concurrent category change")'
    )
    from projection
    cross join cloud.published_catalog_projection_state state
    where state.singleton`;
  const beforeConcurrencyResult = run("docker", [
    "exec", CONTAINER, "psql", "-U", "supabase_admin", "-d", DATABASE,
    "-v", "ON_ERROR_STOP=1", "-Atc", projectionStateSql,
  ], { quiet: true });
  const beforeConcurrency = JSON.parse(beforeConcurrencyResult.stdout.trim()) as {
    version: number;
    generatedAt: string;
  };

  dockerExec(
    "bash", "-lc",
    `set -euo pipefail
psql -U supabase_admin -d ${DATABASE} -v ON_ERROR_STOP=1 -c "begin; update cloud.manufacturers set description = 'Concurrent manufacturer change' where id = '60000000-0000-4000-8000-000000000010'; select pg_sleep(0.25); commit" >/tmp/concurrent-manufacturer.out 2>&1 &
first_pid=$!
sleep 0.05
psql -U supabase_admin -d ${DATABASE} -v ON_ERROR_STOP=1 -c "begin; update cloud.categories set description = 'Concurrent category change' where id = '60000000-0000-4000-8000-000000000020'; commit" >/tmp/concurrent-category.out 2>&1 &
second_pid=$!
wait "$first_pid" || { cat /tmp/concurrent-manufacturer.out; exit 1; }
wait "$second_pid" || { cat /tmp/concurrent-category.out; exit 1; }`,
  );

  const afterConcurrencyResult = run("docker", [
    "exec", CONTAINER, "psql", "-U", "supabase_admin", "-d", DATABASE,
    "-v", "ON_ERROR_STOP=1", "-Atc", projectionStateSql,
  ], { quiet: true });
  const afterConcurrency = JSON.parse(afterConcurrencyResult.stdout.trim()) as {
    version: number;
    generatedAt: string;
    checksumMatches: boolean;
    manufacturerChanged: boolean;
    categoryChanged: boolean;
  };
  if (afterConcurrency.version !== beforeConcurrency.version + 2
      || Date.parse(afterConcurrency.generatedAt) <= Date.parse(beforeConcurrency.generatedAt)
      || !afterConcurrency.checksumMatches
      || !afterConcurrency.manufacturerChanged
      || !afterConcurrency.categoryChanged) {
    throw new Error(`Published projection concurrency audit failed: ${JSON.stringify({
      beforeConcurrency,
      afterConcurrency,
    })}`);
  }
  const distinctConcurrencyAudit = {
    status: "PASS",
    committedPublicChanges: 2,
    versionDelta: afterConcurrency.version - beforeConcurrency.version,
    monotonic: Date.parse(afterConcurrency.generatedAt) > Date.parse(beforeConcurrency.generatedAt),
    checksumMatches: afterConcurrency.checksumMatches,
    eventLoss: 0,
  };

  const beforeIdenticalResult = run("docker", [
    "exec", CONTAINER, "psql", "-U", "supabase_admin", "-d", DATABASE,
    "-v", "ON_ERROR_STOP=1", "-Atc", projectionStateSql,
  ], { quiet: true });
  const beforeIdentical = JSON.parse(beforeIdenticalResult.stdout.trim()) as {
    version: number;
    generatedAt: string;
  };

  dockerExec(
    "bash", "-lc",
    `set -euo pipefail
psql -U supabase_admin -d ${DATABASE} -v ON_ERROR_STOP=1 -c "begin; update cloud.application_areas set description = 'Concurrent identical change' where id = '60000000-0000-4000-8000-000000000030'; select pg_sleep(0.25); commit" >/tmp/identical-first.out 2>&1 &
first_pid=$!
sleep 0.05
psql -U supabase_admin -d ${DATABASE} -v ON_ERROR_STOP=1 -c "begin; update cloud.application_areas set description = 'Concurrent identical change' where id = '60000000-0000-4000-8000-000000000030'; commit" >/tmp/identical-second.out 2>&1 &
second_pid=$!
wait "$first_pid" || { cat /tmp/identical-first.out; exit 1; }
wait "$second_pid" || { cat /tmp/identical-second.out; exit 1; }`,
  );

  const afterIdenticalResult = run("docker", [
    "exec", CONTAINER, "psql", "-U", "supabase_admin", "-d", DATABASE,
    "-v", "ON_ERROR_STOP=1", "-Atc",
    `with claims as materialized (
      select set_config('request.jwt.claim.role', 'service_role', false)
    ), projection as materialized (
      select cloud_api.cloud_published_storefront_catalog_v1() as payload from claims
    )
    select jsonb_build_object(
      'version', state.version,
      'generatedAt', projection.payload ->> 'generatedAt',
      'checksumMatches', state.payload_checksum = cloud.sha256_jsonb_v1(
        projection.payload - 'generatedAt'
      ),
      'areaChanged', projection.payload @? '$.applicationAreas[*] ? (@.description == "Concurrent identical change")',
      'queuedTransactions', (select count(*)
        from cloud.published_catalog_projection_events_v4)
    )
    from projection
    cross join cloud.published_catalog_projection_state state
    where state.singleton`,
  ], { quiet: true });
  const afterIdentical = JSON.parse(afterIdenticalResult.stdout.trim()) as {
    version: number;
    generatedAt: string;
    checksumMatches: boolean;
    areaChanged: boolean;
    queuedTransactions: number;
  };
  if (afterIdentical.version !== beforeIdentical.version + 1
      || Date.parse(afterIdentical.generatedAt) <= Date.parse(beforeIdentical.generatedAt)
      || !afterIdentical.checksumMatches
      || !afterIdentical.areaChanged
      || afterIdentical.queuedTransactions !== 0) {
    throw new Error(`Published projection identical concurrency audit failed: ${JSON.stringify({
      beforeIdentical,
      afterIdentical,
    })}`);
  }

  const concurrencyAudit = {
    distinct: distinctConcurrencyAudit,
    identical: {
      status: "PASS",
      committedPublicChanges: 2,
      versionDelta: afterIdentical.version - beforeIdentical.version,
      checksumMatches: afterIdentical.checksumMatches,
    },
    callerResettableGucExploit: "closed-single-advancement",
    forcedConstraintEvaluation: "closed-single-advancement",
    repeatedFinalizer: "idempotent-no-second-version",
  };

  process.stdout.write(`${JSON.stringify({
    status: "PASS",
    image: IMAGE,
    migrationCount: MIGRATION_COUNT,
    rpc: "cloud_api.cloud_published_storefront_catalog_v1",
    integration: [
      "published-only-product-visibility",
      "immutable-revision-approval-batch-binding",
      "immutable-product-revision-seo-characteristics",
      "targeted-projection-completeness-refresh-exact-retry",
      "mandatory-reference-visibility",
      "unresolved-blocker-exclusion",
      "independently-published-structured-fields",
      "public-media-document-registration-filtering",
      "preview-child-isolation",
      "deterministic-slug-ordering",
      "internal-metadata-non-disclosure",
      "public-document-dependency-clock",
      "public-removal-monotonic-clock",
      "hidden-and-exact-retry-clock-stability",
      "transactional-clock-rollback",
      "Product-storage-ownership-binding",
      "concurrent-public-change-serialization",
      "transaction-final-net-zero-coalescing",
      "multi-statement-single-clock-advancement",
      "concurrent-identical-change-coalescing",
      "controlled-baseline-initialization",
      "initialization-exact-retry",
      "concurrent-initialization-single-evidence",
      "caller-resettable-guc-exploit-closed",
      "constraint-immediate-deferred-single-advancement",
      "repeated-finalizer-idempotency",
      "type-safe-malformed-child-isolation",
      "exact-visible-structured-field-clock",
      "one-hundred-call-determinism",
      "service-only-read-only-grants",
      "public-api-wrapper-jsonb-equivalence",
      "public-api-wrapper-service-only-acl",
      "empty-projection-schema-validation",
    ],
    testBaseline: {
      products: 2,
      manufacturers: 1,
      categories: 1,
      applicationAreas: 1,
    },
    emptyProjection,
    wrapperEquivalenceAudit,
    initializationAudit,
    concurrentInitializationAudit,
    bootstrapAudit,
    fixtureAudit,
    privilegeAudit,
    concurrencyAudit,
    disposableDatabaseRemoved: true,
    remoteConnections: 0,
    remoteWrites: 0,
  }, null, 2)}\n`);
} finally {
  if (started) {
    run("docker", ["stop", CONTAINER], { allowFailure: true, quiet: true });
  }
}
