import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getSeoLanding, SEO_P0_PATHS } from "../../lib/seo/implementation-v2.ts";
import { STOREFRONT_SITE_NAME } from "../../lib/storefront/seo.ts";

const publicRuntimeFiles = [
  "app/global-error.tsx",
  "app/layout.tsx",
  "app/page.tsx",
  "app/thanks/page.tsx",
  "app/request/page.tsx",
  "app/compare/page.tsx",
  "app/manufacturers/page.tsx",
  "app/search/page.tsx",
  "app/catalog/page.tsx",
  "app/tender/page.tsx",
  "app/workspace/page.tsx",
  "app/products/fs510/page.tsx",
  "components/home/Advantages.tsx",
  "components/home/CompanyCredibility.tsx",
  "components/home/Header.tsx",
  "components/knowledge/Hero.tsx",
  "components/seo/SeoLandingPage.tsx",
] as const;

test("public runtime copy consistently uses the approved Cyrillic brand", async () => {
  assert.equal(STOREFRONT_SITE_NAME, "Кибермедика");
  for (const path of publicRuntimeFiles) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(source, />[^<{]*(?:CyberMedica|CYBERMEDICA|Cybermedica)[^<{]*</u, path);
    assert.doesNotMatch(source, /["`](?:CyberMedica|CYBERMEDICA|Cybermedica)(?:\s|\.|—|·|$)/u, path);
  }
});

test("authoritative SEO content is normalized at the public runtime boundary", () => {
  for (const path of SEO_P0_PATHS) {
    const rendered = JSON.stringify(getSeoLanding(path));
    assert.match(rendered, /Кибермедика/u);
    assert.doesNotMatch(rendered, /CyberMedica|CYBERMEDICA|Cybermedica/u);
  }
});
