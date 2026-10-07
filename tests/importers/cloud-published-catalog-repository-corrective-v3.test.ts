import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  LOCAL_SUPABASE_PROJECT_REF,
  PRODUCTION_SUPABASE_PROJECT_REF,
  PROJECT_BOUND_SUPABASE_REF_ENV,
  PROJECT_BOUND_SUPABASE_URL_ENV,
  STAGING_SUPABASE_PROJECT_REF,
  SupabaseEnvironmentError,
  getProjectBoundSupabaseServiceEnvironment,
} from "../../lib/supabase/env.ts";

const thirdProjectRef = "abcdefghijklmnopqrst";
const serviceRoleKey = [
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
  Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url"),
  "synthetic_signature",
].join(".");

function cloudUrl(projectRef: string) {
  return `https://${projectRef}.supabase.co`;
}

function environment(
  deployment: Readonly<Record<string, string | undefined>>,
  projectRef: string,
) {
  return {
    ...deployment,
    [PROJECT_BOUND_SUPABASE_URL_ENV]: cloudUrl(projectRef),
    [PROJECT_BOUND_SUPABASE_REF_ENV]: projectRef,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  };
}

function assertSafeRejection(
  configuredEnvironment: Readonly<Record<string, string | undefined>>,
  options: { allowLocalDevelopment?: boolean } = {},
) {
  assert.throws(
    () => getProjectBoundSupabaseServiceEnvironment(configuredEnvironment, options),
    (error: unknown) => error instanceof SupabaseEnvironmentError
      && !error.message.includes(serviceRoleKey)
      && !error.message.includes(thirdProjectRef)
      && !error.message.includes(STAGING_SUPABASE_PROJECT_REF)
      && !error.message.includes(PRODUCTION_SUPABASE_PROJECT_REF)
      && !error.message.includes("supabase.co"),
  );
}

test("deployment environment selects one immutable approved Supabase project ref", () => {
  const production = getProjectBoundSupabaseServiceEnvironment(
    environment({ VERCEL: "1", VERCEL_ENV: "production" }, PRODUCTION_SUPABASE_PROJECT_REF),
  );
  assert.equal(production.projectRef, PRODUCTION_SUPABASE_PROJECT_REF);
  assert.equal(production.url, cloudUrl(PRODUCTION_SUPABASE_PROJECT_REF));

  const preview = getProjectBoundSupabaseServiceEnvironment(
    environment({ VERCEL: "1", VERCEL_ENV: "preview" }, STAGING_SUPABASE_PROJECT_REF),
  );
  assert.equal(preview.projectRef, STAGING_SUPABASE_PROJECT_REF);
  assert.equal(preview.url, cloudUrl(STAGING_SUPABASE_PROJECT_REF));

  for (const rejected of [
    environment({ VERCEL: "1", VERCEL_ENV: "production" }, STAGING_SUPABASE_PROJECT_REF),
    environment({ VERCEL: "1", VERCEL_ENV: "production" }, thirdProjectRef),
    environment({ VERCEL: "1", VERCEL_ENV: "preview" }, PRODUCTION_SUPABASE_PROJECT_REF),
    environment({ VERCEL: "1", VERCEL_ENV: "preview" }, thirdProjectRef),
  ]) {
    assertSafeRejection(rejected);
  }
});

test("local staging integration is explicit while local QA remains test-only", () => {
  for (const nodeEnvironment of ["development", "test"]) {
    const localStaging = getProjectBoundSupabaseServiceEnvironment(
      environment({ NODE_ENV: nodeEnvironment }, STAGING_SUPABASE_PROJECT_REF),
    );
    assert.equal(localStaging.projectRef, STAGING_SUPABASE_PROJECT_REF);
  }

  const localQaUrl = "http://127.0.0.1:54321";
  const localQaEnvironment = {
    NODE_ENV: "test",
    [PROJECT_BOUND_SUPABASE_URL_ENV]: localQaUrl,
    [PROJECT_BOUND_SUPABASE_REF_ENV]: LOCAL_SUPABASE_PROJECT_REF,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  };
  assert.equal(
    getProjectBoundSupabaseServiceEnvironment(localQaEnvironment, {
      allowLocalDevelopment: true,
    }).url,
    localQaUrl,
  );
  assertSafeRejection(localQaEnvironment);

  for (const vercelEnvironment of ["preview", "production"]) {
    assertSafeRejection({
      ...localQaEnvironment,
      VERCEL: "1",
      VERCEL_ENV: vercelEnvironment,
    }, { allowLocalDevelopment: true });
  }
});

test("missing or unknown deployment identity fails closed outside local/test", () => {
  assertSafeRejection(environment({ NODE_ENV: "production" }, STAGING_SUPABASE_PROJECT_REF));
  assertSafeRejection(environment({ VERCEL: "1" }, STAGING_SUPABASE_PROJECT_REF));
  assertSafeRejection(environment({ VERCEL_ENV: "custom" }, STAGING_SUPABASE_PROJECT_REF));
});

test("matching third-project URL/ref and public/request-controlled values cannot widen allowlist", () => {
  for (const deployment of [
    { VERCEL: "1", VERCEL_ENV: "production" },
    { VERCEL: "1", VERCEL_ENV: "preview" },
    { NODE_ENV: "test" },
  ]) {
    assertSafeRejection({
      ...environment(deployment, thirdProjectRef),
      NEXT_PUBLIC_SUPABASE_URL: cloudUrl(thirdProjectRef),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-public-key",
      REQUEST_URL: `https://example.invalid/?project=${thirdProjectRef}`,
      HTTP_COOKIE: `project=${thirdProjectRef}`,
      HTTP_X_SUPABASE_PROJECT_REF: thirdProjectRef,
    });
  }
});

test("every rejected binding performs zero requests and sends zero credential headers", () => {
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
    const rejected = ${JSON.stringify([
      environment({ VERCEL: "1", VERCEL_ENV: "production" }, STAGING_SUPABASE_PROJECT_REF),
      environment({ VERCEL: "1", VERCEL_ENV: "production" }, thirdProjectRef),
      environment({ VERCEL: "1", VERCEL_ENV: "preview" }, PRODUCTION_SUPABASE_PROJECT_REF),
      environment({ VERCEL: "1", VERCEL_ENV: "preview" }, thirdProjectRef),
      environment({ NODE_ENV: "production" }, STAGING_SUPABASE_PROJECT_REF),
    ])};
    let requests = 0;
    let credentialHeaders = 0;
    const codes = [];
    for (const configuredEnvironment of rejected) {
      try {
        const client = createProjectBoundSupabaseServerClient({
          environment: configuredEnvironment,
          fetchImplementation: async (_request, init) => {
            requests += 1;
            const headers = new Headers(init?.headers);
            if (headers.has("authorization") || headers.has("apikey")) {
              credentialHeaders += 1;
            }
            return new Response("{}");
          },
        });
        await client.request("/rest/v1/rpc/read_only");
      } catch (error) {
        codes.push(error?.name ?? "unknown");
      }
    }
    console.log(JSON.stringify({ requests, credentialHeaders, codes }));
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()), {
    requests: 0,
    credentialHeaders: 0,
    codes: Array.from({ length: 5 }, () => "SupabaseEnvironmentError"),
  });
});

test("runtime project binding is not frozen to a previous environment", () => {
  const staging = getProjectBoundSupabaseServiceEnvironment(
    environment({ VERCEL: "1", VERCEL_ENV: "preview" }, STAGING_SUPABASE_PROJECT_REF),
  );
  const production = getProjectBoundSupabaseServiceEnvironment(
    environment({ VERCEL: "1", VERCEL_ENV: "production" }, PRODUCTION_SUPABASE_PROJECT_REF),
  );
  assert.equal(staging.url, cloudUrl(STAGING_SUPABASE_PROJECT_REF));
  assert.equal(production.url, cloudUrl(PRODUCTION_SUPABASE_PROJECT_REF));
  assert.notEqual(staging.url, production.url);
});

test("sitemap selects the Published helper with an in-branch dynamic import", async () => {
  const source = await readFile("app/sitemap.ts", "utf8");
  const publishedBranch = source.indexOf('storefrontDataSource === "cloud_published"');
  const dynamicImport = source.indexOf('await import(\n      "@/lib/storefront/cloud-published-catalog-repository"');

  assert.ok(publishedBranch >= 0);
  assert.ok(dynamicImport > publishedBranch);
  assert.doesNotMatch(
    source,
    /^import .*cloud-published-catalog-repository/mu,
  );
  assert.ok(source.indexOf('storefrontDataSource === "cloud_preview"') < dynamicImport);
});

test("sitemap branch trace loads no opposite helper and dynamic import errors fail closed", () => {
  const script = `
    import { registerHooks } from "node:module";
    const source = process.env.TRACE_SOURCE;
    const failure = process.env.TRACE_FAILURE === "1";
    globalThis.__sitemapTrace = [];
    const moduleSource = (value) => "data:text/javascript," + encodeURIComponent(value);
    registerHooks({
      resolve(specifier, context, nextResolve) {
        if (specifier === "@/lib/storefront") {
          return { url: moduleSource(\`
            globalThis.__sitemapTrace.push("adapter:\${source}");
            export const storefrontDataSource = \${JSON.stringify(source)};
            export const productService = {};
            export const manufacturerService = {};
            export const categoryService = {};
          \`), shortCircuit: true };
        }
        if (specifier === "@/lib/storefront/storefront-sitemap") {
          return { url: moduleSource(\`
            export async function buildStorefrontSitemap() {
              globalThis.__sitemapTrace.push("filesystem-sitemap");
              return [];
            }
            export function buildStorefrontSitemapFromCatalog() {
              globalThis.__sitemapTrace.push("published-sitemap");
              return [];
            }
          \`), shortCircuit: true };
        }
        if (specifier === "@/lib/verticals/fs510/sitemap") {
          return { url: moduleSource(\`
            export function buildFs510Sitemap() { return []; }
          \`), shortCircuit: true };
        }
        if (specifier === "@/lib/storefront/cloud-published-catalog-repository") {
          globalThis.__sitemapTrace.push("published-helper-loaded");
          if (failure) throw new Error("synthetic dynamic import failure");
          return { url: moduleSource(\`
            export async function loadCloudPublishedCatalog() {
              globalThis.__sitemapTrace.push("published-rpc");
              return {};
            }
          \`), shortCircuit: true };
        }
        return nextResolve(specifier, context);
      },
    });
    try {
      const sitemap = (await import("./app/sitemap.ts")).default;
      await sitemap();
      console.log(JSON.stringify({ ok: true, trace: globalThis.__sitemapTrace }));
    } catch {
      console.log(JSON.stringify({ ok: false, trace: globalThis.__sitemapTrace }));
    }
  `;

  const run = (source: string, failure = false) => {
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        TRACE_SOURCE: source,
        TRACE_FAILURE: failure ? "1" : "0",
      },
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout.trim()) as { ok: boolean; trace: string[] };
  };

  assert.deepEqual(run("cloud_published"), {
    ok: true,
    trace: [
      "adapter:cloud_published",
      "published-helper-loaded",
      "published-rpc",
      "published-sitemap",
    ],
  });
  assert.deepEqual(run("cloud_preview"), {
    ok: true,
    trace: ["adapter:cloud_preview"],
  });
  assert.deepEqual(run("static"), {
    ok: true,
    trace: ["adapter:static", "filesystem-sitemap"],
  });
  assert.deepEqual(run("cloud_published", true), {
    ok: false,
    trace: ["adapter:cloud_published", "published-helper-loaded"],
  });
});

test("CatalogRepository and ProductService remain byte-identical to Corrective v2 base", () => {
  const protectedFiles = [
    "lib/storefront/catalog-repository.ts",
    "lib/storefront/product-service.ts",
  ];
  const result = spawnSync("git", [
    "diff",
    "--exit-code",
    "0be7b683db0221ad3fbf2a986d1f8ae2e3f4c0b6",
    "--",
    ...protectedFiles,
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
