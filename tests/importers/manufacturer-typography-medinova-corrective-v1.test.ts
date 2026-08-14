import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import manifest from "../../docs/reports/all-manufacturer-logos-stage-v1.json" with { type: "json" };
import { getManufacturerLogoPresentation } from "../../lib/storefront/manufacturer-logo-policy.ts";

const medinovaSha256 = "08464e96c62e0f1ab8713239b50b98875528b3ab6fe0035c0c8b8272a53ad476";

test("manufacturer utility typography uses the canonical sans family", async () => {
  const [css, breadcrumbs, directory, detail] = await Promise.all([
    readFile("app/globals.css", "utf8"),
    readFile("components/navigation/Breadcrumbs.tsx", "utf8"),
    readFile("app/manufacturers/page.tsx", "utf8"),
    readFile("app/manufacturers/[slug]/page.tsx", "utf8"),
  ]);

  assert.match(css, /\.cm-eyebrow\s*\{[\s\S]*font-family:\s*var\(--font-sans\);[\s\S]*font-weight:\s*700;[\s\S]*letter-spacing:\s*0\.08em;/u);
  assert.match(breadcrumbs, /font-sans[\s\S]*tracking-normal/u);
  assert.doesNotMatch(detail, /cm-label|font-mono/u);
  assert.doesNotMatch(directory, /font-mono/u);
  assert.equal((detail.match(/cm-eyebrow/gu) ?? []).length, 4);
});

test("Medinova uses the exact local official colored wordmark", async () => {
  const logo = await readFile("public/manufacturers/medinova/logo.svg", "utf8");
  const entry = manifest.manufacturers.find(({ slug }) => slug === "medinova");
  const presentation = getManufacturerLogoPresentation({ slug: "medinova", name: "Medinova" });

  assert.ok(entry);
  assert.equal(entry.sourceURL, "https://medinova.ru/");
  assert.equal(entry.sourceType, "official manufacturer homepage inline SVG (.logo_medinova > svg)");
  assert.equal(entry.productionReady, true);
  assert.equal(entry.assetPath, "/manufacturers/medinova/logo.svg");
  assert.equal(createHash("sha256").update(logo).digest("hex"), medinovaSha256);
  assert.match(logo, /viewBox="0 0 1722\.32 477\.31"/u);
  assert.equal((logo.match(/fill="#28b9e1"/gu) ?? []).length, 2);
  assert.doesNotMatch(logo, /<script|javascript:|<foreignObject|(?:href|src)=["']https?:/iu);
  assert.equal(presentation.kind, "graphic");
  assert.equal(presentation.assetUrl, "/manufacturers/medinova/logo.svg");
  assert.equal(presentation.assetWidth, 1722);
  assert.equal(presentation.assetHeight, 477);
});
