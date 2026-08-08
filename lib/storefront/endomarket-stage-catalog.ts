import type { StorefrontCatalog } from "./types.ts";
import { PUBLIC_PRODUCT_STATUSES } from "./types.ts";

export const ENDOMARKET_STAGE_PUBLISHED_COUNT = 71;
export const ENDOMARKET_STAGE_DRAFT_COUNT = 42;
export const ENDOMARKET_STAGE_BINDING_COUNT = 9;
export const ENDOMARKET_STAGE_VISIBLE_COUNT = 113;
export const ENDOMARKET_STAGE_VISIBLE_BINDING_COUNT = 7;
export const ENDOMARKET_STAGE_HIDDEN_BINDING_SLUGS = new Set([
  "videoendoskopicheskaya-sistema-sonoscape-hd-550",
  "pentax-epk-i7010-optivista",
]);

function assertStage(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`EndoMarket Stage catalog rejected: ${message}`);
}

/**
 * Composes the Product Owner-approved Stage namespace without replacing the
 * canonical published projection. The nine duplicate bindings only add their
 * commercial presentation to the already-published entity; their Stage rows
 * can never create a second Product card.
 */
export function composeEndoMarketStageCatalog(
  publishedCatalog: StorefrontCatalog,
  stageCatalog: StorefrontCatalog,
): StorefrontCatalog {
  const publishedProducts = publishedCatalog.products.filter((product) =>
    PUBLIC_PRODUCT_STATUSES.has(product.status),
  );
  const stageDrafts = stageCatalog.products.filter(({ status }) => status === "preview_draft");
  const stageBindings = stageCatalog.products.filter(({ status }) =>
    PUBLIC_PRODUCT_STATUSES.has(status),
  );

  assertStage(
    publishedProducts.length === ENDOMARKET_STAGE_PUBLISHED_COUNT,
    `published projection must contain ${ENDOMARKET_STAGE_PUBLISHED_COUNT} Products, received ${publishedProducts.length}`,
  );
  assertStage(
    publishedProducts.length === publishedCatalog.products.length,
    "published projection contains a non-public Product",
  );
  assertStage(
    stageDrafts.length === ENDOMARKET_STAGE_DRAFT_COUNT,
    `draft scope must contain ${ENDOMARKET_STAGE_DRAFT_COUNT} Products, received ${stageDrafts.length}`,
  );
  assertStage(
    stageBindings.length === ENDOMARKET_STAGE_BINDING_COUNT,
    `binding scope must contain ${ENDOMARKET_STAGE_BINDING_COUNT} Products, received ${stageBindings.length}`,
  );

  const publishedById = new Map(publishedProducts.map((product) => [product.id, product]));
  const publishedBySlug = new Map(publishedProducts.map((product) => [product.slug, product]));
  const bindingIds = new Set(stageBindings.map(({ id }) => id));
  assertStage(bindingIds.size === ENDOMARKET_STAGE_BINDING_COUNT, "duplicate binding Product ID");
  let visibleBindingCount = 0;
  for (const binding of stageBindings) {
    assertStage(
      binding.commercialPresentation?.source === "endomarket",
      `binding commercial presentation is missing for Product ${binding.id}`,
    );
    const published = publishedBySlug.get(binding.slug);
    if (!published) {
      assertStage(
        ENDOMARKET_STAGE_HIDDEN_BINDING_SLUGS.has(binding.slug),
        `binding is absent from the public projection without an approved hidden state: ${binding.id}`,
      );
      continue;
    }
    visibleBindingCount += 1;
    assertStage(published.model === binding.model, `binding model drift for ${binding.slug}`);
  }
  assertStage(
    visibleBindingCount === ENDOMARKET_STAGE_VISIBLE_BINDING_COUNT,
    `visible binding count must be ${ENDOMARKET_STAGE_VISIBLE_BINDING_COUNT}, received ${visibleBindingCount}`,
  );

  const publishedSlugs = new Set(publishedProducts.map(({ slug }) => slug));
  for (const draft of stageDrafts) {
    assertStage(!publishedById.has(draft.id), `draft Product ID collides with published scope: ${draft.id}`);
    assertStage(!publishedSlugs.has(draft.slug), `draft slug collides with published scope: ${draft.slug}`);
    assertStage(draft.commercialPresentation?.source === "endomarket", `draft commercial presentation is missing: ${draft.slug}`);
  }

  const bindingByPublishedSlug = new Map(
    stageBindings.map((binding) => [binding.slug, binding]),
  );
  const products = [
    ...publishedProducts.map((product) => {
      const binding = bindingByPublishedSlug.get(product.slug);
      return binding
        ? {
            ...product,
            commercialPresentation: binding.commercialPresentation,
            media: binding.media,
          }
        : product;
    }),
    ...stageDrafts,
  ];
  assertStage(products.length === ENDOMARKET_STAGE_VISIBLE_COUNT, `visible catalog must contain ${ENDOMARKET_STAGE_VISIBLE_COUNT} Products`);
  assertStage(new Set(products.map(({ id }) => id)).size === products.length, "visible Product ID collision");
  assertStage(new Set(products.map(({ slug }) => slug)).size === products.length, "visible Product slug collision");

  const manufacturers = [
    ...publishedCatalog.manufacturers,
    ...stageCatalog.manufacturers.filter((candidate) =>
      !publishedCatalog.manufacturers.some(({ id, slug }) => id === candidate.id || slug === candidate.slug),
    ),
  ];
  const categories = [
    ...publishedCatalog.categories,
    ...stageCatalog.categories.filter((candidate) =>
      !publishedCatalog.categories.some(({ id, slug }) => id === candidate.id || slug === candidate.slug),
    ),
  ];
  const manufacturerIds = new Set(manufacturers.map(({ id }) => id));
  const categoryIds = new Set(categories.map(({ id }) => id));
  assertStage(products.every(({ manufacturerId }) => manufacturerIds.has(manufacturerId)), "visible Product has an unknown manufacturer");
  assertStage(products.every(({ categoryId }) => categoryIds.has(categoryId)), "visible Product has an unknown category");

  return {
    products,
    manufacturers,
    categories,
    summary: {
      schemaVersion: 1,
      generatedAt: stageCatalog.summary.generatedAt,
      productCount: products.length,
      activeProductCount: publishedProducts.length,
      manufacturerCount: manufacturers.length,
      categoryCount: categories.length,
    },
  };
}
