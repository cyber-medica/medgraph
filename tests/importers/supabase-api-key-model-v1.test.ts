import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  PROJECT_BOUND_SUPABASE_REF_ENV,
  PROJECT_BOUND_SUPABASE_URL_ENV,
  SUPABASE_PUBLISHABLE_KEY_ENV,
  SUPABASE_SECRET_KEY_ENV,
  SupabaseEnvironmentError,
  getSupabasePrivilegedCredential,
  getSupabasePublicEnvironment,
  hasSupabasePrivilegedCredentialConfiguration,
} from "../../lib/supabase/env.ts";

const stagingRef = "gjlpkqdhlzbfnzzoxlsk";
const stagingUrl = `https://${stagingRef}.supabase.co`;
const publishableKey = "sb_publishable_browser_safe_0123456789abcdef";
const secretKey = "sb_secret_server_only_0123456789abcdef";
const artifactSentinel = "sb_secret_artifact_privacy_sentinel_0123456789abcdef";

function legacyJwt(role: "anon" | "service_role") {
  return [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify({ role })).toString("base64url"),
    "synthetic_signature",
  ].join(".");
}

const legacyAnonKey = legacyJwt("anon");
const legacyServiceRoleKey = legacyJwt("service_role");

test("publishable and legacy anon modes are explicit and mutually exclusive", () => {
  assert.deepEqual(getSupabasePublicEnvironment({
    NEXT_PUBLIC_SUPABASE_URL: stagingUrl,
    [SUPABASE_PUBLISHABLE_KEY_ENV]: publishableKey,
  }), {
    url: stagingUrl,
    publicCredential: {
      key: publishableKey,
      mode: "publishable",
      sendAsBearer: false,
    },
  });
  assert.equal(getSupabasePublicEnvironment({
    NEXT_PUBLIC_SUPABASE_URL: stagingUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: legacyAnonKey,
  }).publicCredential.mode, "legacy_anon");

  for (const environment of [
    { NEXT_PUBLIC_SUPABASE_URL: stagingUrl },
    {
      NEXT_PUBLIC_SUPABASE_URL: stagingUrl,
      [SUPABASE_PUBLISHABLE_KEY_ENV]: publishableKey,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: legacyAnonKey,
    },
    {
      NEXT_PUBLIC_SUPABASE_URL: stagingUrl,
      [SUPABASE_PUBLISHABLE_KEY_ENV]: secretKey,
    },
    {
      NEXT_PUBLIC_SUPABASE_URL: stagingUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: legacyServiceRoleKey,
    },
  ]) {
    assert.throws(
      () => getSupabasePublicEnvironment(environment),
      SupabaseEnvironmentError,
    );
  }
});

test("secret and legacy service-role modes are explicit and mutually exclusive", () => {
  assert.deepEqual(getSupabasePrivilegedCredential({
    [SUPABASE_SECRET_KEY_ENV]: secretKey,
  }), {
    key: secretKey,
    mode: "secret",
    sendAsBearer: false,
  });
  assert.deepEqual(getSupabasePrivilegedCredential({
    SUPABASE_SERVICE_ROLE_KEY: legacyServiceRoleKey,
  }), {
    key: legacyServiceRoleKey,
    mode: "legacy_service_role",
    sendAsBearer: true,
  });
  assert.equal(hasSupabasePrivilegedCredentialConfiguration({
    [SUPABASE_SECRET_KEY_ENV]: secretKey,
  }), true);

  for (const environment of [
    {},
    { [SUPABASE_SECRET_KEY_ENV]: "not-a-secret-key" },
    { SUPABASE_SERVICE_ROLE_KEY: legacyAnonKey },
    {
      [SUPABASE_SECRET_KEY_ENV]: secretKey,
      SUPABASE_SERVICE_ROLE_KEY: legacyServiceRoleKey,
    },
    { [SUPABASE_SECRET_KEY_ENV]: ` ${secretKey}` },
  ]) {
    assert.equal(hasSupabasePrivilegedCredentialConfiguration(environment), false);
    assert.throws(() => getSupabasePrivilegedCredential(environment), SupabaseEnvironmentError);
  }
});

test("new secret uses apikey only while legacy compatibility retains Bearer", () => {
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
    const base = {
      NODE_ENV: "test",
      ${PROJECT_BOUND_SUPABASE_URL_ENV}: ${JSON.stringify(stagingUrl)},
      ${PROJECT_BOUND_SUPABASE_REF_ENV}: ${JSON.stringify(stagingRef)},
    };
    const captures = [];
    async function capture(environment, suppliedAuthorization) {
      const client = createProjectBoundSupabaseServerClient({
        environment: { ...base, ...environment },
        fetchImplementation: async (request, init) => {
          const headers = new Headers(init?.headers);
          captures.push({
            url: String(request),
            method: init?.method,
            apikey: headers.get("apikey"),
            authorization: headers.get("authorization"),
            acceptProfile: headers.get("accept-profile"),
            contentProfile: headers.get("content-profile"),
            contentType: headers.get("content-type"),
            body: init?.body,
            credentialMode: client.credentialMode,
          });
          return new Response("{}", { status: 200 });
        },
      });
      await client.request("/rest/v1/rpc/cloud_published_storefront_catalog_v1", {
        method: "POST",
        headers: {
          "Accept-Profile": "cloud_api",
          "Content-Profile": "cloud_api",
          "Content-Type": "application/json",
          ...(suppliedAuthorization ? { Authorization: suppliedAuthorization } : {}),
        },
        body: "{}",
      });
    }
    await capture(
      { ${SUPABASE_SECRET_KEY_ENV}: ${JSON.stringify(secretKey)} },
      ${JSON.stringify(`Bearer ${secretKey}`)},
    );
    await capture(
      { SUPABASE_SERVICE_ROLE_KEY: ${JSON.stringify(legacyServiceRoleKey)} },
      null,
    );
    console.log(JSON.stringify(captures));
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const [secretCapture, legacyCapture] = JSON.parse(result.stdout) as Array<{
    url: string;
    method: string;
    apikey: string;
    authorization: string | null;
    acceptProfile: string;
    contentProfile: string;
    contentType: string;
    body: string;
    credentialMode: string;
  }>;
  assert.deepEqual(secretCapture, {
    url: `${stagingUrl}/rest/v1/rpc/cloud_published_storefront_catalog_v1`,
    method: "POST",
    apikey: secretKey,
    authorization: null,
    acceptProfile: "cloud_api",
    contentProfile: "cloud_api",
    contentType: "application/json",
    body: "{}",
    credentialMode: "secret",
  });
  assert.equal(legacyCapture.apikey, legacyServiceRoleKey);
  assert.equal(legacyCapture.authorization, `Bearer ${legacyServiceRoleKey}`);
  assert.equal(legacyCapture.credentialMode, "legacy_service_role");
});

test("runtime credential code has no logging or public secret variable", async () => {
  const [environmentSource, clientSource, envExample, authEnvironment] = await Promise.all([
    readFile("lib/supabase/env.ts", "utf8"),
    readFile("lib/supabase/client.server.ts", "utf8"),
    readFile(".env.example", "utf8"),
    readFile("lib/internal-auth/environment.ts", "utf8"),
  ]);
  assert.doesNotMatch(`${environmentSource}\n${clientSource}`, /console\./u);
  assert.doesNotMatch(`${environmentSource}\n${clientSource}\n${envExample}`, /NEXT_PUBLIC_SUPABASE_SECRET/u);
  assert.match(envExample, /^SUPABASE_SECRET_KEY=$/mu);
  assert.match(envExample, /^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$/mu);
  assert.match(authEnvironment, /getSupabasePublicEnvironment/u);
  assert.doesNotMatch(authEnvironment, /SUPABASE_(?:SECRET|SERVICE_ROLE)_KEY/u);
});

test("Production mutation routes use validated privileged credential detection", async () => {
  const routePaths = (await readdir("app/internal/operations", { recursive: true }))
    .filter((entry) => /\.(?:ts|tsx)$/u.test(entry))
    .map((entry) => path.join("app/internal/operations", entry));
  const relevantSources = await Promise.all(routePaths.map(async (routePath) => ({
    routePath,
    source: await readFile(routePath, "utf8"),
  })));
  const credentialAware = relevantSources.filter(({ source }) => (
    source.includes("hasSupabasePrivilegedCredentialConfiguration")
  ));
  assert.ok(credentialAware.length >= 15);
  for (const { routePath, source } of credentialAware) {
    assert.doesNotMatch(source, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/u, routePath);
    assert.match(source, /hasSupabasePrivilegedCredentialConfiguration\(process\.env\)/u);
  }
});

test("synthetic server secret is absent from the complete build artifact", {
  skip: !existsSync(".next"),
}, async () => {
  async function filesUnder(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    return (await Promise.all(entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? filesUnder(target) : [target];
    }))).flat();
  }
  const files = await filesUnder(".next");
  for (const file of files) {
    const content = await readFile(file).catch(() => null);
    if (content) assert.equal(content.includes(Buffer.from(artifactSentinel)), false, file);
  }
});
