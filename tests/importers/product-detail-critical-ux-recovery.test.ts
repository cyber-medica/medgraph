import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(path, "utf8");
}

test("catalog cards use a single category presentation and retain stable alignment", async () => {
  const catalog = await source("components/storefront/ProductCard.tsx");

  assert.match(catalog, /<span className="sr-only">Категория: <\/span>/u);
  assert.doesNotMatch(catalog, /isTechnicalProductSpecification|cardSpecifications/u);
  assert.match(catalog, /line-clamp-2 min-h-10/u);
  assert.match(catalog, /border-t border-\[var\(--cm-rule\)\]/u);
  assert.doesNotMatch(catalog, /Тип товара<\/dt>/u);
});

test("product detail exposes canonical orientation, only real section links, and an accessible top action", async () => {
  const [page, breadcrumb, backToCatalog, backToTop] = await Promise.all([
    source("app/catalog/[slug]/page.tsx"),
    source("components/navigation/Breadcrumbs.tsx"),
    source("components/catalog/BackToCatalog.tsx"),
    source("components/catalog/BackToTop.tsx"),
  ]);

  assert.match(page, /<Breadcrumbs/u);
  assert.doesNotMatch(page, /BackToCatalog/u);
  assert.match(page, /<BackToTop \/>/u);
  assert.match(page, /aria-label="Навигация по странице товара"/u);
  assert.match(page, /experience\.description/u);
  assert.match(page, /experience\.manufacturer/u);
  assert.doesNotMatch(page, /href: "#documents"/u);
  assert.doesNotMatch(page, /href: "#regulatory"/u);
  assert.match(backToCatalog, /scrollY: window\.scrollY/u);
  assert.match(backToCatalog, /sessionStorage/u);
  assert.doesNotMatch(backToCatalog, /Назад к каталогу/u);
  assert.match(breadcrumb, /aria-label="Хлебные крошки"/u);
  assert.match(breadcrumb, /aria-current="page"/u);
  assert.match(backToTop, /prefers-reduced-motion/u);
  assert.match(backToTop, /aria-label="Наверх"/u);
});

test("gallery has compact conditional controls and preserves keyboard and touch lightbox behavior", async () => {
  const gallery = await source("components/catalog/ProductGallery.tsx");

  assert.match(gallery, /imageMedia\.length > 1/u);
  assert.match(gallery, /aria-label="Увеличить изображение"/u);
  assert.match(gallery, /aria-label="Предыдущее изображение"/u);
  assert.match(gallery, /aria-label="Следующее изображение"/u);
  assert.match(gallery, /event\.key === "Escape"/u);
  assert.match(gallery, /event\.key === "ArrowLeft"/u);
  assert.match(gallery, /event\.key === "ArrowRight"/u);
  assert.match(gallery, /event\.key !== "Tab"/u);
  assert.match(gallery, /document\.body\.style\.overflow = "hidden"/u);
  assert.match(gallery, /trigger\?\.focus\(\)/u);
  assert.match(gallery, /onTouchStart/u);
  assert.match(gallery, /onTouchEnd/u);
});
