import { spawnSync } from "node:child_process";
import path from "node:path";

const IMAGE = "postgres:17.6-alpine";
const ADMIN_ROLE = "postgres";
const DATABASE = "cybermedica_rfq_test";
const OWNER_ROLE = "cybermedica_rfq_owner_test";
const RUNTIME_ROLE = "cybermedica_rfq_runtime_test";
const CONTAINER = `cybermedica-rfq-postgres17-${process.pid}`;
const ROOT = process.cwd();

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

function psql(sql: string, allowFailure = false) {
  return run("docker", [
    "exec",
    CONTAINER,
    "psql",
    "-U",
    ADMIN_ROLE,
    "-d",
    DATABASE,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    sql,
  ], { allowFailure, quiet: allowFailure });
}

function requirePermissionDenied(result: ReturnType<typeof run>, operation: string) {
  if (result.status === 0 || !/permission denied/iu.test(result.stderr || "")) {
    throw new Error(`${operation} was not denied for the runtime role.`);
  }
}

const image = run("docker", ["image", "inspect", IMAGE], {
  allowFailure: true,
  quiet: true,
});
if (image.status !== 0) {
  throw new Error(`Required local image ${IMAGE} is absent. This QA command never pulls images.`);
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
    "POSTGRES_PASSWORD=local-rfq-postgres17-test-only",
    "-e",
    `POSTGRES_DB=${DATABASE}`,
    IMAGE,
  ]);
  started = true;

  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const probe = run("docker", [
      "exec",
      CONTAINER,
      "psql",
      "-U",
      ADMIN_ROLE,
      "-d",
      DATABASE,
      "-Atc",
      "select 1",
    ], { allowFailure: true, quiet: true });
    if (probe.status === 0) {
      ready = true;
      break;
    }
    wait(500);
  }
  if (!ready) throw new Error("Disposable PostgreSQL 17 did not become ready.");

  const version = psql("SHOW server_version;");
  if (!/\b17\./u.test(version.stdout)) {
    throw new Error("Disposable database is not PostgreSQL 17.");
  }

  psql(`
    CREATE ROLE ${OWNER_ROLE} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
      NOINHERIT NOREPLICATION NOBYPASSRLS;
    CREATE ROLE ${RUNTIME_ROLE} LOGIN PASSWORD 'local-rfq-runtime-test-only'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
    ALTER DATABASE ${DATABASE} OWNER TO ${OWNER_ROLE};
  `);

  dockerExec("mkdir", "-p", "/tmp/services/rfq-intake", "/tmp/infra");
  run("docker", [
    "cp",
    path.join(ROOT, "services/rfq-intake/sql"),
    `${CONTAINER}:/tmp/services/rfq-intake/sql`,
  ]);
  run("docker", [
    "cp",
    path.join(ROOT, "infra/postgresql"),
    `${CONTAINER}:/tmp/infra/postgresql`,
  ]);
  dockerExec(
    "psql",
    "-U",
    ADMIN_ROLE,
    "-d",
    DATABASE,
    "-v",
    "ON_ERROR_STOP=1",
    "-v",
    `rfq_database=${DATABASE}`,
    "-v",
    `rfq_owner_role=${OWNER_ROLE}`,
    "-v",
    `rfq_runtime_role=${RUNTIME_ROLE}`,
    "-f",
    "/tmp/infra/postgresql/apply-rfq-schema.sql",
  );

  psql(`
    SET ROLE ${RUNTIME_ROLE};
    INSERT INTO public.rfq_leads (
      id, company, contact_name, email, message, source_path, attribution,
      consent_version, consent_text_sha256, policy_version, consent_at, created_at
    ) VALUES (
      '11111111-1111-4111-8111-111111111111',
      'LOCAL POSTGRESQL 17 TEST',
      'Synthetic test',
      'test@example.invalid',
      'Do not process',
      '/request',
      '{"landingPath":"/request"}'::jsonb,
      'rfq-consent-2026-09-17-v3',
      repeat('0', 64),
      'privacy-policy-2026-09-17-v3',
      now(),
      now()
    ) RETURNING id;
    SELECT id FROM public.rfq_leads
      WHERE id = '11111111-1111-4111-8111-111111111111';
    UPDATE public.rfq_leads
      SET delivery_status = 'failed', updated_at = now()
      WHERE id = '11111111-1111-4111-8111-111111111111';
    RESET ROLE;
  `);

  requirePermissionDenied(psql(
    `SET ROLE ${RUNTIME_ROLE}; DELETE FROM public.rfq_leads WHERE false;`,
    true,
  ), "DELETE");
  requirePermissionDenied(psql(
    `SET ROLE ${RUNTIME_ROLE}; CREATE TABLE public.must_not_exist (id integer);`,
    true,
  ), "schema CREATE");
  requirePermissionDenied(psql(
    `SET ROLE ${RUNTIME_ROLE}; UPDATE public.rfq_leads SET company = company WHERE false;`,
    true,
  ), "PII column UPDATE");

  const audit = psql(`
    SELECT jsonb_build_object(
      'databaseOwner', pg_get_userbyid((SELECT datdba FROM pg_database WHERE datname = current_database())),
      'tableOwner', pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = 'public.rfq_leads'::regclass)),
      'runtimeOwnsTable', pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = 'public.rfq_leads'::regclass)) = '${RUNTIME_ROLE}',
      'runtimeMemberOfOwner', pg_has_role('${RUNTIME_ROLE}', '${OWNER_ROLE}', 'MEMBER'),
      'runtimeDelete', has_table_privilege('${RUNTIME_ROLE}', 'public.rfq_leads', 'DELETE'),
      'runtimeSchemaCreate', has_schema_privilege('${RUNTIME_ROLE}', 'public', 'CREATE'),
      'runtimeInsert', has_table_privilege('${RUNTIME_ROLE}', 'public.rfq_leads', 'INSERT'),
      'runtimeSelect', has_table_privilege('${RUNTIME_ROLE}', 'public.rfq_leads', 'SELECT'),
      'deliveryUpdate', has_column_privilege('${RUNTIME_ROLE}', 'public.rfq_leads', 'delivery_status', 'UPDATE'),
      'piiUpdate', has_column_privilege('${RUNTIME_ROLE}', 'public.rfq_leads', 'company', 'UPDATE')
    );
  `);
  const serializedAudit = audit.stdout.trim();
  if (
    !serializedAudit.includes(`"databaseOwner": "${OWNER_ROLE}"`)
    || !serializedAudit.includes(`"tableOwner": "${OWNER_ROLE}"`)
    || !serializedAudit.includes('"runtimeOwnsTable": false')
    || !serializedAudit.includes('"runtimeMemberOfOwner": false')
    || !serializedAudit.includes('"runtimeDelete": false')
    || !serializedAudit.includes('"runtimeSchemaCreate": false')
    || !serializedAudit.includes('"runtimeInsert": true')
    || !serializedAudit.includes('"runtimeSelect": true')
    || !serializedAudit.includes('"deliveryUpdate": true')
    || !serializedAudit.includes('"piiUpdate": false')
  ) {
    throw new Error(`Unexpected runtime privilege audit: ${serializedAudit}`);
  }

  process.stdout.write(`${JSON.stringify({
    event: "rfq_postgres17_provisioning_passed",
    postgresMajor: 17,
    migrationApplied: true,
    runtimeInsert: true,
    runtimeSelect: true,
    deliveryStateUpdate: true,
    deleteDenied: true,
    ddlDenied: true,
    piiUpdateDenied: true,
    runtimeOwnsSchemaObjects: false,
  })}\n`);
} finally {
  if (started) {
    run("docker", ["stop", "--time", "0", CONTAINER], {
      allowFailure: true,
      quiet: true,
    });
  }
}
