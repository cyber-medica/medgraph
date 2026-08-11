import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildProductRequestHref,
  resolveRequestProductContext,
} from "../../lib/request/product-context.ts";
import type { Manufacturer, Product } from "../../lib/storefront/types.ts";

const product: Product = {
  id: "product-hamilton-t1",
  slug: "apparat-ivl-hamilton-t1",
  manufacturerId: "manufacturer-hamilton",
  categoryId: "category-ventilators",
  name: "Аппарат ИВЛ HAMILTON-T1",
  model: "HAMILTON-T1",
  shortDescription: "",
  description: "",
  status: "active",
  featured: false,
  applicationAreas: [],
  keyFeatures: [],
  specifications: [],
  media: [],
  documents: [],
  compatibility: [],
  relatedProductIds: [],
  createdAt: "2026-07-28T00:00:00.000Z",
  updatedAt: "2026-07-28T00:00:00.000Z",
};

const manufacturer: Manufacturer = {
  id: "manufacturer-hamilton",
  slug: "hamilton-medical",
  name: "Hamilton Medical",
  country: "Switzerland",
  shortDescription: "",
  description: "",
  logoUrl: null,
  websiteUrl: null,
  status: "active",
  createdAt: "2026-07-28T00:00:00.000Z",
  updatedAt: "2026-07-28T00:00:00.000Z",
};

function dependencies(options: { product?: Product | null } = {}) {
  return {
    productService: {
      async getProductBySlug(slug: string) {
        const result = options.product === undefined ? product : options.product;
        return result?.slug === slug ? result : null;
      },
    },
    catalogRepository: {
      async getManufacturers() {
        return [manufacturer];
      },
    },
  };
}

test("Product Detail RFQ link carries canonical Product ID and slug", () => {
  const href = buildProductRequestHref(product);
  const url = new URL(href, "https://cyber-medica.ru");

  assert.equal(url.pathname, "/request");
  assert.equal(url.searchParams.get("product"), product.slug);
  assert.equal(url.searchParams.get("productId"), product.id);
  assert.equal(url.searchParams.has("productTitle"), false);
});

test("published Product selection resolves canonical RFQ context", async () => {
  const context = await resolveRequestProductContext(
    { id: product.id, slug: product.slug },
    dependencies(),
  );

  assert.deepEqual(context, {
    id: product.id,
    slug: product.slug,
    title: product.name,
    model: product.model,
    manufacturer: manufacturer.name,
  });
});

test("slug-only selection remains compatible and still resolves server-side", async () => {
  const context = await resolveRequestProductContext(
    { slug: product.slug },
    dependencies(),
  );

  assert.equal(context?.id, product.id);
  assert.equal(context?.title, product.name);
});

test("unknown or mismatched Product identity fails closed", async () => {
  assert.equal(
    await resolveRequestProductContext(
      { id: product.id, slug: "unknown-product" },
      dependencies(),
    ),
    null,
  );
  assert.equal(
    await resolveRequestProductContext(
      { id: "tampered-id", slug: product.slug },
      dependencies(),
    ),
    null,
  );
});

test("draft-only Product context is rejected without a static fallback", async () => {
  assert.equal(
    await resolveRequestProductContext(
      { id: product.id, slug: product.slug },
      dependencies({ product: { ...product, status: "preview_draft" } }),
    ),
    null,
  );
});

test("missing Product selection keeps the general RFQ path", async () => {
  let lookups = 0;
  const context = await resolveRequestProductContext(
    {},
    {
      ...dependencies(),
      productService: {
        async getProductBySlug() {
          lookups += 1;
          return product;
        },
      },
    },
  );

  assert.equal(context, null);
  assert.equal(lookups, 0);
});

test("caller-supplied title and manufacturer cannot override canonical data", async () => {
  const context = await resolveRequestProductContext(
    {
      id: product.id,
      slug: product.slug,
      productTitle: "Tampered title",
      productManufacturer: "Tampered manufacturer",
    } as { id: string; slug: string },
    dependencies(),
  );

  assert.equal(context?.title, product.name);
  assert.equal(context?.manufacturer, manufacturer.name);
});

test("RFQ runtime revalidates Product context before webhook delivery", async () => {
  const [productPage, requestPage, requestForm, requestRoute] = await Promise.all([
    readFile("app/catalog/[slug]/page.tsx", "utf8"),
    readFile("app/request/page.tsx", "utf8"),
    readFile("components/request/RequestForm.tsx", "utf8"),
    readFile("app/api/request/route.ts", "utf8"),
  ]);

  assert.match(productPage, /buildProductRequestHref\(product\)/);
  assert.match(requestPage, /resolveRequestProductContext/);
  assert.match(requestForm, /data-testid="request-product-context"/);
  assert.match(requestForm, /name="productId"/);
  assert.match(requestForm, /name="productSlug"/);
  assert.match(requestRoute, /resolveRequestProductContext/);
  assert.match(requestRoute, /product:\s*productContext/);
  assert.doesNotMatch(requestRoute, /formData\.get\(["']productTitle["']\)/);
  assert.doesNotMatch(requestRoute, /formData\.get\(["']productManufacturer["']\)/);
  assert.equal(requestRoute.match(/\{ status: 503 \}/g)?.length, 2);
});
