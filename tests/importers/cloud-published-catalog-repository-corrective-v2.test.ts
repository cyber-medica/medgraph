import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  LOCAL_SUPABASE_PROJECT_REF,
  PROJECT_BOUND_SUPABASE_REF_ENV,
  PROJECT_BOUND_SUPABASE_URL_ENV,
  SupabaseEnvironmentError,
  getProjectBoundSupabaseServiceEnvironment,
  validateSupabaseProjectBinding,
} from "../../lib/supabase/env.ts";

const stagingRef = "gjlpkqdhlzbfnzzoxlsk";
const productionRef = "clbzibuusyuajsylcbvl";
const stagingUrl = `https://${stagingRef}.supabase.co`;
const productionUrl = `https://${productionRef}.supabase.co`;
const legacyServiceRoleKey = [
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
  Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url"),
  "synthetic_signature",
].join(".");

function boundEnvironment(
  overrides: Readonly<Record<string, string | undefined>> = {},
) {
  return {
    NODE_ENV: "test",
    [PROJECT_BOUND_SUPABASE_URL_ENV]: stagingUrl,
    [PROJECT_BOUND_SUPABASE_REF_ENV]: stagingRef,
    SUPABASE_SERVICE_ROLE_KEY: legacyServiceRoleKey,
    ...overrides,
  };
}

test("published service binding accepts only the exact configured Supabase project", () => {
  const options = { deploymentEnvironment: "local" as const };
  assert.equal(validateSupabaseProjectBinding(stagingUrl, stagingRef, options), stagingUrl);
  assert.equal(
    validateSupabaseProjectBinding(
      `https://${stagingRef.toUpperCase()}.SUPABASE.CO/`,
      stagingRef,
      options,
    ),
    stagingUrl,
  );

  const rejected: Array<[string, string]> = [
    [stagingUrl, productionRef],
    [productionUrl, stagingRef],
    ["https://abcdefghijklmnopqrst.supabase.co", stagingRef],
    [`https://${stagingRef}.supabase.co.`, stagingRef],
    [`https://${stagingRef}.supabase.co/path`, stagingRef],
    [`https://${stagingRef}.supabase.co?query=1`, stagingRef],
    [`https://${stagingRef}.supabase.co#hash`, stagingRef],
    [`https://${stagingRef}.supabase.co:8443`, stagingRef],
    [`https://user:password@${stagingRef}.supabase.co`, stagingRef],
    [`http://${stagingRef}.supabase.co`, stagingRef],
    [`https://${stagingRef}.supabase.co.attacker.example`, stagingRef],
    ["https://example.com", stagingRef],
    [stagingUrl, "short"],
    [stagingUrl, "invalid_project_ref!"],
    [stagingUrl, stagingRef.toUpperCase()],
  ];

  rejected.forEach(([url, projectRef]) => {
    assert.throws(
      () => validateSupabaseProjectBinding(url, projectRef, options),
      (error: unknown) => error instanceof SupabaseEnvironmentError
        && !error.message.includes(url)
        && !error.message.includes(legacyServiceRoleKey),
    );
  });
});

test("project-bound environment is server-only, complete and independent from NEXT_PUBLIC URL", () => {
  const values = getProjectBoundSupabaseServiceEnvironment(boundEnvironment({
    NEXT_PUBLIC_SUPABASE_URL: productionUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "unrelated-public-anon-key",
  }));
  assert.deepEqual(values, {
    url: stagingUrl,
    projectRef: stagingRef,
    privilegedCredential: {
      key: legacyServiceRoleKey,
      mode: "legacy_service_role",
      sendAsBearer: true,
    },
  });

  for (const missing of [
    PROJECT_BOUND_SUPABASE_URL_ENV,
    PROJECT_BOUND_SUPABASE_REF_ENV,
    "SUPABASE_SERVICE_ROLE_KEY",
  ]) {
    assert.throws(
      () => getProjectBoundSupabaseServiceEnvironment(boundEnvironment({ [missing]: "" })),
      (error: unknown) => error instanceof SupabaseEnvironmentError
        && !error.message.includes(stagingUrl)
        && !error.message.includes(stagingRef)
        && !error.message.includes(legacyServiceRoleKey),
    );
  }
});

test("local project binding is fixed, explicit and unavailable without the local opt-in", () => {
  const localUrl = "http://127.0.0.1:54321";
  assert.equal(
    validateSupabaseProjectBinding(localUrl, LOCAL_SUPABASE_PROJECT_REF, {
      deploymentEnvironment: "local",
      allowLocalQa: true,
    }),
    localUrl,
  );
  assert.throws(() => validateSupabaseProjectBinding(
    localUrl,
    LOCAL_SUPABASE_PROJECT_REF,
    { deploymentEnvironment: "local" },
  ));
  assert.throws(() => validateSupabaseProjectBinding(localUrl, stagingRef, {
    deploymentEnvironment: "local",
    allowLocalQa: true,
  }));
});

test("published adapter reads only runtime server binding before creating a request", async () => {
  const [repository, client, environment] = await Promise.all([
    readFile("lib/storefront/cloud-published-catalog-repository.ts", "utf8"),
    readFile("lib/supabase/client.server.ts", "utf8"),
    readFile("lib/supabase/env.ts", "utf8"),
  ]);

  assert.match(repository, /createProjectBoundSupabaseServerClient/u);
  assert.match(repository, /environment: process\.env/u);
  assert.doesNotMatch(repository, /NEXT_PUBLIC_SUPABASE_URL/u);
  assert.match(client, /getProjectBoundSupabaseServiceEnvironment/u);
  assert.match(environment, /CYBERMEDICA_SUPABASE_URL/u);
  assert.match(environment, /CYBERMEDICA_SUPABASE_PROJECT_REF/u);
  assert.ok(
    client.indexOf("getProjectBoundSupabaseServiceEnvironment")
      < client.indexOf("return createClient(\n    \"service_role\""),
  );
});

test("project mismatch creates zero requests and matching binding owns the credential target", () => {
  const script = `
    import { registerHooks } from "node:module";
    registerHooks({
      resolve(specifier, context, nextResolve) {
        if (specifier === "server-only") {
          return { url: "data:text/javascript,export{}", shortCircuit: true };
        }
        return nextResolve(specifier, context);
      },
    });
    const { createProjectBoundSupabaseServerClient } = await import(
      "./lib/supabase/client.server.ts"
    );
    let requests = 0;
    const base = {
      NODE_ENV: "test",
      CYBERMEDICA_SUPABASE_PROJECT_REF: "${stagingRef}",
      SUPABASE_SERVICE_ROLE_KEY: ${JSON.stringify(legacyServiceRoleKey)},
    };
    let mismatchCode = "none";
    try {
      createProjectBoundSupabaseServerClient({
        environment: { ...base, CYBERMEDICA_SUPABASE_URL: "${productionUrl}" },
        fetchImplementation: async () => {
          requests += 1;
          return new Response("{}");
        },
      });
    } catch (error) {
      mismatchCode = error?.name ?? "unknown";
    }
    let target = "";
    let authorised = false;
    const client = createProjectBoundSupabaseServerClient({
      environment: { ...base, CYBERMEDICA_SUPABASE_URL: "${stagingUrl}" },
      fetchImplementation: async (request, init) => {
        requests += 1;
        target = new URL(request).origin;
        const headers = new Headers(init?.headers);
        authorised = headers.get("authorization") === ${JSON.stringify(`Bearer ${legacyServiceRoleKey}`)}
          && headers.get("apikey") === ${JSON.stringify(legacyServiceRoleKey)};
        return new Response("{}");
      },
    });
    await client.request("/rest/v1/rpc/read_only");
    console.log(JSON.stringify({ requests, mismatchCode, target, authorised }));
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()), {
    requests: 1,
    mismatchCode: "SupabaseEnvironmentError",
    target: stagingUrl,
    authorised: true,
  });
});

test("source selector dynamically imports exactly one repository implementation", async () => {
  const [factory, index, contract, service, types] = await Promise.all([
    readFile("lib/storefront/catalog-repository-factory.server.ts", "utf8"),
    readFile("lib/storefront/index.ts", "utf8"),
    readFile("lib/storefront/catalog-repository.ts", "utf8"),
    readFile("lib/storefront/product-service.ts", "utf8"),
    readFile("lib/storefront/types.ts", "utf8"),
  ]);

  assert.match(factory, /^import "server-only";/u);
  assert.equal(factory.match(/await import\(/gu)?.length, 3);
  assert.match(factory, /case "cloud_published"/u);
  assert.match(factory, /case "cloud_preview"/u);
  assert.match(factory, /case "static"/u);
  assert.match(factory, /throw new Error\("Unsupported Storefront data source\."\)/u);
  assert.doesNotMatch(factory, /catch\s*\(/u);
  assert.doesNotMatch(factory, /^import \{ (?:Cloud|Filesystem).*Repository/mu);
  assert.match(index, /await createCatalogRepositoryForSource\(storefrontDataSource\)/u);
  assert.doesNotMatch(
    index,
    /CloudPublishedCatalogRepository|CloudPreviewCatalogRepository|FilesystemCatalogRepository/u,
  );
  assert.equal(contract.includes("cloud_published"), false);
  assert.equal(service.includes("cloud_published"), false);
  assert.equal(types.includes("cloud_published"), false);
});

test("source factory rejects an unknown runtime value without a fallback", () => {
  const script = `
    import { registerHooks } from "node:module";
    registerHooks({
      resolve(specifier, context, nextResolve) {
        if (specifier === "server-only") {
          return { url: "data:text/javascript,export{}", shortCircuit: true };
        }
        return nextResolve(specifier, context);
      },
    });
    const { createCatalogRepositoryForSource } = await import(
      "./lib/storefront/catalog-repository-factory.server.ts"
    );
    try {
      await createCatalogRepositoryForSource("unexpected_source");
      console.log("resolved");
    } catch (error) {
      console.log(error?.message ?? "unknown");
    }
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "Unsupported Storefront data source.");
});

test("published source keeps redirect, validation, size and no-write boundaries", async () => {
  const [repository, response, client, factory] = await Promise.all([
    readFile("lib/storefront/cloud-published-catalog-repository.ts", "utf8"),
    readFile("lib/storefront/cloud-published-response.ts", "utf8"),
    readFile("lib/supabase/client.server.ts", "utf8"),
    readFile("lib/storefront/catalog-repository-factory.server.ts", "utf8"),
  ]);
  const scope = `${repository}\n${response}\n${client}\n${factory}`;

  assert.match(client, /redirect: "error"/u);
  assert.match(repository, /unstable_rethrow/u);
  assert.match(response, /CLOUD_PUBLISHED_MAX_RESPONSE_BYTES = 8 \* 1024 \* 1024/u);
  assert.doesNotMatch(scope, /cloud_storefront_preview_catalog|preview_draft/u);
  assert.doesNotMatch(scope, /\b(?:PATCH|PUT|DELETE)\b|insert into|update cloud\./iu);
});
