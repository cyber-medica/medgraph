import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicSurfaceFiles = [
  "app/catalog/[slug]/page.tsx",
  "app/catalog/page.tsx",
  "app/compare/page.tsx",
  "app/manufacturers/[slug]/page.tsx",
  "app/manufacturers/page.tsx",
  "app/products/fs510/page.tsx",
  "app/request/page.tsx",
  "app/search/page.tsx",
  "app/solutions/page.tsx",
  "app/tender/page.tsx",
  "app/thanks/page.tsx",
  "app/workspace/page.tsx",
  "components/catalog/CatalogExplorer.tsx",
  "components/home/Categories.tsx",
  "components/home/CompanyCredibility.tsx",
  "components/home/Equipment.tsx",
  "components/home/FeaturedManufacturers.tsx",
  "components/home/FeaturedProducts.tsx",
  "components/home/FeaturedProductsCarousel.tsx",
  "components/home/Hero.tsx",
  "components/home/PlatformStats.tsx",
  "components/home/WhyCyberMedica.tsx",
  "components/knowledge/CompatibilityEvidencePanel.tsx",
  "components/knowledge/Documents.tsx",
  "components/knowledge/Hero.tsx",
  "components/knowledge/KnowledgeDetails.tsx",
  "components/knowledge/Specifications.tsx",
  "components/navigation/Breadcrumbs.tsx",
  "components/search/SearchExperience.tsx",
  "components/seo/SeoLandingPage.tsx",
  "components/storefront/ProductCard.tsx",
  "components/tender/TenderAssistantWorkflow.tsx",
  "components/tender/TenderComplianceTable.tsx",
  "components/ui/Badge.tsx",
  "components/ui/Title.tsx",
  "components/verticals/fs510/ProvenanceChain.tsx",
  "components/workspace/WorkspaceDashboard.tsx",
] as const;

test("public typography has one loaded Onest token system", async () => {
  const [css, layout, breadcrumbs] = await Promise.all([
    readFile("app/globals.css", "utf8"),
    readFile("app/layout.tsx", "utf8"),
    readFile("components/navigation/Breadcrumbs.tsx", "utf8"),
  ]);

  assert.match(layout, /import \{ Onest \} from "next\/font\/google";/u);
  assert.match(layout, /subsets: \["cyrillic", "latin"\]/u);
  assert.match(layout, /weight: "variable"/u);
  assert.match(layout, /variable: "--font-onest"/u);
  assert.match(css, /--font-sans: var\(--font-onest\), "Onest", "Inter", system-ui, sans-serif;/u);
  assert.match(css, /\.cm-label,\s*\.cm-eyebrow\s*\{[\s\S]*font-weight: 700;[\s\S]*letter-spacing: 0\.08em;/u);
  assert.match(css, /\.cm-heading-1\s*\{[\s\S]*letter-spacing: normal;/u);
  assert.match(css, /\.cm-breadcrumb,[\s\S]*font-weight: 600;/u);
  assert.match(css, /\.cm-button-primary,[\s\S]*letter-spacing: normal;/u);
  assert.match(breadcrumbs, /cm-breadcrumb/u);
});

test("public storefront sources contain no mono typography or negative tracking utilities", async () => {
  const sources = await Promise.all(publicSurfaceFiles.map((path) => readFile(path, "utf8")));
  for (const [index, source] of sources.entries()) {
    assert.doesNotMatch(source, /font-mono/u, `${publicSurfaceFiles[index]} uses font-mono`);
    assert.doesNotMatch(source, /tracking-\[-/u, `${publicSurfaceFiles[index]} uses negative tracking`);
  }
});

test("homepage keeps 0 percent with its phrase without a layout-breaking nowrap", async () => {
  const equipment = await readFile("components/home/Equipment.tsx", "utf8");

  assert.match(equipment, /с рассрочкой\{"\\u00a0"\}0%\./u);
  assert.doesNotMatch(equipment, /<br|whitespace-nowrap/u);
});

test("request hierarchy starts with the approved H1 and keeps the RFQ implementation", async () => {
  const [page, form] = await Promise.all([
    readFile("app/request/page.tsx", "utf8"),
    readFile("components/request/RequestForm.tsx", "utf8"),
  ]);

  assert.doesNotMatch(page, /Деловая заявка/iu);
  assert.match(page, /<h1[^>]*>[\s\S]*Запросить КП[\s\S]*<\/h1>/u);
  assert.match(page, /<RequestForm/u);
  assert.match(form, /rfq_success/u);
});
