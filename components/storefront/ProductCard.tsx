"use client";

import Image from "next/image";
import Link from "next/link";

import { rememberCatalogReturn } from "@/components/catalog/BackToCatalog";
import { getProductPresentation } from "@/lib/storefront/product-presentation";
import type { Manufacturer, Product } from "@/lib/storefront/types";
import ProductCommercialBadges from "@/components/storefront/ProductCommercialBadges";

export interface ProductCardProps {
  product: Product;
  manufacturer?: Manufacturer;
  categoryName?: string;
  compareEnabled?: boolean;
  manufacturerLinkEnabled?: boolean;
}

export default function ProductCard({
  product,
  manufacturer,
  categoryName,
  compareEnabled = true,
  manufacturerLinkEnabled = true,
}: ProductCardProps) {
  const presentation = getProductPresentation(product, {
    categoryName,
    country: manufacturer?.country,
    manufacturerName: manufacturer?.name,
  });
  const productHref = `/catalog/${product.slug}`;

  return (
    <article className="group cm-card flex min-h-full flex-col overflow-hidden">
      <ProductImage product={product} href={productHref} />
      <div className="flex flex-1 flex-col p-3 sm:p-3.5">
        <div className="flex min-h-6 flex-wrap items-center gap-2">
          <span className="rounded-md border border-[var(--cm-rule)] bg-cm-surface-low px-2 py-1 font-sans text-[9px] font-semibold text-cm-dim">
            <span className="sr-only">Категория: </span>
            {presentation.categoryLabel}
          </span>
          <span className="font-sans text-[9px] text-cm-dim">
            {presentation.modelLabel}
          </span>
        </div>
        <h2 className="cm-heading-2 mt-2.5 line-clamp-2 min-h-10 text-[15px] font-bold leading-5">
          <Link
            href={productHref}
            onClick={() => rememberCatalogReturn(productHref)}
            className="hover:text-cm-teal"
          >
            {product.name}
          </Link>
        </h2>
        <div className="mt-1.5 min-h-7 text-xs text-cm-slate">
          {manufacturer && manufacturerLinkEnabled ? (
            <Link
              href={`/manufacturers/${manufacturer.slug}`}
              className="inline-flex items-center rounded-md bg-cm-teal-soft px-2 py-1 font-bold text-cm-teal transition hover:bg-cm-teal/12 hover:underline"
            >
              {manufacturer.name}
            </Link>
          ) : manufacturer ? (
            <span className="inline-flex items-center rounded-md bg-cm-teal-soft px-2 py-1 font-bold text-cm-teal">
              {manufacturer.name}
            </span>
          ) : (
            presentation.manufacturerLabel
          )}
        </div>
        <div className="mt-2 min-h-9">
          {presentation.shortDescription && (
            <p className="line-clamp-2 text-[11px] leading-[1.125rem] text-cm-slate">
              {presentation.shortDescription}
            </p>
          )}
        </div>
        {product.commercialPresentation ? (
          <div className="mt-2.5 min-h-7">
            <ProductCommercialBadges
              presentation={product.commercialPresentation}
              compact
            />
          </div>
        ) : null}
        <div className="mt-2 min-h-7">
          {product.applicationAreas.length > 0 && (
            <ul
              className="flex flex-wrap gap-1.5"
              aria-label={`Области применения: ${product.name}`}
            >
              {product.applicationAreas.slice(0, 2).map((area) => (
                <li
                  key={area}
                  className="rounded-full border border-[var(--cm-rule)] bg-cm-surface-low/70 px-2 py-1 text-[9px] leading-3 text-cm-slate"
                >
                  {area}
                </li>
              ))}
              {product.applicationAreas.length > 2 && (
                <li className="px-1 py-1 text-[9px] leading-3 text-cm-dim">
                  +{product.applicationAreas.length - 2}
                </li>
              )}
            </ul>
          )}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--cm-rule)] pt-3 text-[11px] font-semibold">
          <Link
            href={productHref}
            onClick={() => rememberCatalogReturn(productHref)}
            className="text-cm-teal"
          >
            Открыть карточку →
          </Link>
          {compareEnabled && presentation.canCompare ? (
            <Link
              href="/compare"
              aria-label={`Открыть сравнение для ${product.name}`}
              className="text-cm-slate hover:text-cm-teal"
            >
              Сравнить
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ProductImage({ product, href }: { product: Product; href: string }) {
  const image = product.media.find(({ type }) => type === "image");
  if (!image) {
    const presentation = getProductPresentation(product);
    return (
      <Link
        href={href}
        onClick={() => rememberCatalogReturn(href)}
        aria-label={`Открыть карточку ${product.name}`}
        className="grid aspect-[16/8] w-full place-items-center border-b border-[var(--cm-rule)] bg-cm-surface-low text-[11px] text-cm-dim transition hover:bg-cm-teal-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cm-teal"
      >
        {presentation.mediaFallbackLabel}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      onClick={() => rememberCatalogReturn(href)}
      aria-label={`Открыть карточку ${product.name}`}
      className="relative block aspect-[16/8] w-full overflow-hidden border-b border-[var(--cm-rule)] bg-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cm-teal"
    >
      <Image
        src={image.url}
        alt={image.alt}
        fill
        sizes="(max-width: 767px) 92vw, (max-width: 1535px) 33vw, 25vw"
        className="object-contain p-2 transition duration-300 group-hover:scale-[1.02]"
      />
    </Link>
  );
}
