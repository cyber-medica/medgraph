import { spawnSync } from "node:child_process";

const IMAGE = "public.ecr.aws/supabase/postgres:17.6.1.147";
const DATABASE = "cybermedica_catalog_admin_characteristics_test";
const CONTAINER = `cybermedica-catalog-admin-characteristics-${process.pid}`;
const ROOT = process.cwd();

function run(command: string, args: string[], allowFailure = false) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}`);
  }
  return result;
}

function wait(milliseconds: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

if (run("docker", ["image", "inspect", IMAGE], true).status !== 0) {
  throw new Error(`Required local image ${IMAGE} is absent; this command never pulls automatically.`);
}

let started = false;
try {
  run("docker", [
    "run", "-d", "--rm", "--name", CONTAINER,
    "-e", "POSTGRES_PASSWORD=local_characteristics_contract_test",
    "-e", `POSTGRES_DB=${DATABASE}`,
    IMAGE,
  ]);
  started = true;

  let ready = false;
  let consecutiveReadyProbes = 0;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const probe = run("docker", [
      "exec", CONTAINER, "psql", "-U", "supabase_admin", "-d", DATABASE,
      "-v", "ON_ERROR_STOP=1", "-Atc", "select 1",
    ], true);
    consecutiveReadyProbes = probe.status === 0 ? consecutiveReadyProbes + 1 : 0;
    if (consecutiveReadyProbes >= 2) {
      ready = true;
      break;
    }
    wait(500);
  }
  if (!ready) throw new Error("Local PostgreSQL did not become ready within 30 seconds.");

  run("docker", ["cp", "supabase/tests/000_local_auth_bootstrap.sql", `${CONTAINER}:/tmp/bootstrap.sql`]);
  run("docker", ["cp", "supabase/tests/014_catalog_admin_characteristics_patch_v1.sql", `${CONTAINER}:/tmp/contract.sql`]);
  run("docker", ["cp", "supabase/migrations/.", `${CONTAINER}:/tmp/migrations`]);

  run("docker", [
    "exec", CONTAINER, "psql", "-U", "supabase_admin", "-d", DATABASE,
    "-v", "ON_ERROR_STOP=1", "-f", "/tmp/bootstrap.sql",
  ]);
  run("docker", [
    "exec", CONTAINER, "bash", "-lc",
    `set -euo pipefail
for file in /tmp/migrations/*.sql; do
  psql -U supabase_admin -d ${DATABASE} -v ON_ERROR_STOP=1 -f "$file" >/tmp/migration.out 2>&1 || {
    cat /tmp/migration.out
    exit 1
  }
done`,
  ]);
  // Production application objects are owned by postgres. The local Supabase
  // image applies the fixture migrations as supabase_admin, so align only the
  // disposable database privileges before exercising SECURITY DEFINER code.
  run("docker", [
    "exec", CONTAINER, "psql", "-U", "supabase_admin", "-d", DATABASE,
    "-v", "ON_ERROR_STOP=1", "-c",
    "grant all privileges on all tables in schema cloud to postgres; grant all privileges on all sequences in schema cloud to postgres; grant execute on all functions in schema cloud to postgres;",
  ]);
  run("docker", [
    "exec", CONTAINER, "psql", "-U", "supabase_admin", "-d", DATABASE,
    "-v", "ON_ERROR_STOP=1", "-f", "/tmp/contract.sql",
  ]);

  const signature = run("docker", [
    "exec", CONTAINER, "psql", "-U", "supabase_admin", "-d", DATABASE,
    "-Atc",
    "select to_regprocedure('cloud_api.catalog_admin_patch_product_characteristics_v1(uuid,timestamptz,text,jsonb,jsonb,jsonb,uuid,text)')::text",
  ]).stdout.trim();
  process.stdout.write(`Catalog Admin characteristics local integration PASS\n${JSON.stringify({
    functionSignature: signature,
    transactionRollback: "PASS",
    publicationProjectionInvariance: "PASS",
    lifecycleInvariance: "PASS",
  })}\n`);
} finally {
  if (started) run("docker", ["rm", "-f", CONTAINER], true);
}
