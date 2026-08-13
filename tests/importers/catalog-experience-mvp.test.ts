import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();

async function source(path: string) {
  return readFile(resolve(root, path), "utf8");
}

test("catalog experience keeps the Storefront service boundary", async () => {
  const page = await source("app/catalog/page.tsx");

  assert.match(page, /productService\.getActiveProducts\(\)/);
  assert.match(page, /categoryService\.getCategories\(\)/);
  assert.match(page, /manufacturerService\.getManufacturers\(\)/);
  assert.match(page, /Promise\.all/);
  assert.doesNotMatch(page, /getProductBySlug|data\/storefront|\.json|supabase/i);
});

test("catalog cards expose required public list fields without unsafe specifications", async () => {
  const productCard = await source("components/storefront/ProductCard.tsx");

  assert.match(productCard, /product\.media\.find/);
  assert.match(productCard, /alt=\{image\.alt\}/);
  assert.match(productCard, /product\.name/);
  assert.match(productCard, /presentation\.shortDescription/);
  assert.match(productCard, /manufacturer\.name/);
  assert.match(productCard, /product\.applicationAreas\.slice\(0, 2\)/);
  assert.doesNotMatch(productCard, /isTechnicalProductSpecification|cardSpecifications/);
  assert.match(productCard, /const productHref = `\/catalog\/\$\{product\.slug\}`/);
  assert.match(productCard, /<ProductImage product=\{product\} href=\{productHref\} \/>/);
});

test("catalog state restoration and canonical breadcrumbs preserve the complete URL", async () => {
  const [page, explorer, productCard, backToCatalog, productPage, breadcrumb] = await Promise.all([
    source("app/catalog/page.tsx"),
    source("components/catalog/CatalogExplorer.tsx"),
    source("components/storefront/ProductCard.tsx"),
    source("components/catalog/BackToCatalog.tsx"),
    source("app/catalog/[slug]/page.tsx"),
    source("components/navigation/Breadcrumbs.tsx"),
  ]);

  assert.match(page, /initialSort=\{sort\}/);
  assert.match(explorer, /useSearchParams\(\)/);
  assert.match(explorer, /new URLSearchParams\(urlSearchParams\.toString\(\)\)/);
  assert.match(explorer, /window\.history\.replaceState\(null, "", nextUrl\)/);
  assert.match(explorer, /urlSearchParams\.get\("q"\) \?\? initialQuery/);
  assert.match(explorer, /urlSearchParams\.get\("category"\) \?\? initialCategory/);
  assert.match(explorer, /urlSearchParams\.get\("manufacturer"\) \?\? initialManufacturer/);
  assert.match(explorer, /consumeCatalogScrollRestore\(source\)/);
  assert.match(explorer, /pendingScrollRestore\.current = consumeCatalogScrollRestore\(source\)/);
  assert.match(explorer, /window\.addEventListener\("popstate", captureHistoryRestore\)/);
  assert.match(explorer, /window\.scrollTo\(\{ top: restore\.scrollY, behavior: "auto" \}\)/);
  assert.match(explorer, /window\.history\.scrollRestoration = restore\.scrollRestoration/);
  assert.doesNotMatch(explorer, /params\.delete\("page"\)/);
  for (const parameter of ["q", "category", "manufacturer", "applicationArea", "sort"]) {
    assert.match(explorer, new RegExp(`params,\\s*"${parameter}"`, "u"));
  }

  assert.match(productCard, /rememberCatalogReturn\(productHref\)/);
  assert.doesNotMatch(productCard, /<a\s+href=\{productHref\}/);
  assert.match(backToCatalog, /scrollY: window\.scrollY/);
  assert.match(backToCatalog, /window\.sessionStorage\.setItem/);
  assert.match(productPage, /<Breadcrumbs/u);
  assert.doesNotMatch(productPage, /BackToCatalog|Назад к каталогу/u);
  assert.match(breadcrumb, /aria-current="page"/u);
});

test("catalog has accessible skeleton, empty and recoverable error states", async () => {
  const [loading, skeleton, error, explorer] = await Promise.all([
    source("app/catalog/loading.tsx"),
    source("components/catalog/CatalogSkeleton.tsx"),
    source("app/catalog/error.tsx"),
    source("components/catalog/CatalogExplorer.tsx"),
  ]);

  assert.match(loading, /CatalogSkeleton/);
  assert.match(skeleton, /aria-busy="true"/);
  assert.doesNotMatch(skeleton, /spinner/i);
  assert.match(explorer, /Каталог пока пуст/);
  assert.match(explorer, /aria-live="polite"/);
  assert.match(error, /Не удалось загрузить каталог/);
  assert.match(error, /onClick=\{unstable_retry\}/);
});

test("catalog grid is responsive and does not preload product details", async () => {
  const explorer = await source("components/catalog/CatalogExplorer.tsx");

  assert.match(explorer, /md:grid-cols-3 2xl:grid-cols-4/);
  assert.doesNotMatch(explorer, /getProductBySlug|pageSize|loadMore|infinite/i);
});

test("Product Detail recovery presentation contracts remain intact", async () => {
  const productPage = await source("app/catalog/[slug]/page.tsx");

  for (const contract of [
    "ProductGallery",
    "BackToTop",
    "buildProductDetailExperience",
    "experience.summary",
    "experience.description",
    "experience.advantages",
    "experience.technicalSpecifications",
    "specificationGroups",
  ]) {
    assert.match(productPage, new RegExp(contract.replace(".", "\\."), "u"));
  }
  assert.equal(productPage.match(/<h1\b/gu)?.length, 1);
});
