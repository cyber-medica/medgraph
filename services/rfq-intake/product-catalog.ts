import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { parsePublishedCatalogProjection } from "../../lib/published-catalog/contracts.ts";
import type { RequestProductContext } from "../../lib/request/product-context.ts";
import type { ProductContextResolver } from "./types.ts";

interface SnapshotDocument {
  projection?: unknown;
  projectionDocumentChecksum?: unknown;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export class SnapshotProductContextResolver implements ProductContextResolver {
  private readonly productsBySlug: ReadonlyMap<string, RequestProductContext>;

  private constructor(
    productsBySlug: ReadonlyMap<string, RequestProductContext>,
  ) {
    this.productsBySlug = productsBySlug;
  }

  static async fromFile(path: string) {
    const document = JSON.parse(await readFile(path, "utf8")) as SnapshotDocument;
    const projection = parsePublishedCatalogProjection(document.projection);
    if (projection.products.length === 0) {
      throw new Error("RFQ catalog snapshot is empty.");
    }
    const checksum = createHash("sha256")
      .update(canonicalJson({ ...projection, generatedAt: undefined }))
      .digest("hex");
    if (checksum !== document.projectionDocumentChecksum) {
      throw new Error("RFQ catalog snapshot checksum is invalid.");
    }

    const manufacturerNames = new Map(
      projection.manufacturers.map(({ id, name }) => [id, name]),
    );
    const productsBySlug = new Map<string, RequestProductContext>();
    for (const product of projection.products) {
      productsBySlug.set(product.slug, {
        id: product.id,
        slug: product.slug,
        title: product.title,
        model: product.model,
        manufacturer: product.manufacturerId
          ? manufacturerNames.get(product.manufacturerId) ?? null
          : null,
      });
    }
    return new SnapshotProductContextResolver(productsBySlug);
  }

  async resolve(selection: { id: string | null; slug: string | null }) {
    if (!selection.id && !selection.slug) return null;
    if (!selection.id || !selection.slug) return null;
    const product = this.productsBySlug.get(selection.slug);
    if (!product || product.id !== selection.id) return null;
    return product;
  }
}
