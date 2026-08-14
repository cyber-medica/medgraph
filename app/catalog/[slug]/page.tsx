import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import JsonLd from "@/components/seo/JsonLd";
import BackToTop from "@/components/catalog/BackToTop";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import ProductGallery from "@/components/catalog/ProductGallery";
import ProductManufacturer from "@/components/catalog/ProductManufacturer";
import ProductCommercialBadges from "@/components/storefront/ProductCommercialBadges";
import ProductCard from "@/components/storefront/ProductCard";
import ProductViewTracker from "@/components/analytics/ProductViewTracker";
import SafeProductDescription from "@/components/catalog/SafeProductDescription";
import {
  catalogRepository, productService,
  manufacturerService,
  storefrontDataSource,
} from "@/lib/storefront";
import { buildProductDetailExperience } from "@/lib/storefront/product-detail-experience";
import {
  getProductPresentation,
  PRODUCT_PRESENTATION_FALLBACKS,
} from "@/lib/storefront/product-presentation";
import type {
  ProductDocument,
  ProductDocumentKind,
  ProductSpecification,
} from "@/lib/storefront/types";
import {
  buildProductSeoMetadataV3,
  getProductSeoH1,
} from "@/lib/seo/implementation-v3";
import { buildProductStructuredData } from "@/lib/storefront/structured-data";
import { buildProductRequestHref } from "@/lib/request/product-context";
import { isProductStructuredDataGscStagePreview } from "@/lib/storefront/data-source";

// Published slugs are runtime data and must not require an application rebuild.
export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  if (storefrontDataSource === "cloud_published") return [];
  const products = await productService.getActiveProducts();
  return products.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [product, categories] = await Promise.all([
    productService.getProductBySlug(slug),
    catalogRepository.getCategories(),
  ]);
  if (!product) notFound();

  const image = product.media.find(({ type }) => type === "image");
  const presentation = getProductPresentation(product);
  const category = categories.find(({ id }) => id === product.categoryId);
  return buildProductSeoMetadataV3({
    product,
    category,
    image: image ? { url: image.url, alt: image.alt } : undefined,
    fallbackDescription: presentation.shortDescription ?? product.description,
  });
}

export default async function StorefrontProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await productService.getProductBySlug(slug);
  if (!product) notFound();

  const [manufacturers, publicManufacturers, categories, relatedProducts] = await Promise.all([
    catalogRepository.getManufacturers(),
    manufacturerService.getManufacturers(),
    catalogRepository.getCategories(),
    productService.getRelatedProducts(product),
  ]);
  const manufacturer = manufacturers.find(
    ({ id }) => id === product.manufacturerId,
  );
  const category = categories.find(({ id }) => id === product.categoryId);
  const publicManufacturerIds = new Set(publicManufacturers.map(({ id }) => id));
  const presentation = getProductPresentation(product, {
    categoryName: category?.name,
    country: manufacturer?.country,
    manufacturerName: manufacturer?.name,
  });
  const experience = buildProductDetailExperience({
    product,
    manufacturer,
    category,
    manufacturerPublicProfile: manufacturer
      ? publicManufacturerIds.has(manufacturer.id)
      : false,
  });
  const productH1 = getProductSeoH1(product);
  const generalSpecifications = experience.generalSpecifications;
  const technicalSpecifications = experience.technicalSpecifications;
  const specificationGroups = groupSpecifications(technicalSpecifications);
  if (generalSpecifications.length > 0) {
    specificationGroups.unshift(["Основные сведения", [...generalSpecifications]]);
  }
  const hasCharacteristics = generalSpecifications.length > 0 ||
    technicalSpecifications.length > 0;
  const registrationDocuments = product.documents.filter(
    ({ kind }) => kind === "registration",
  );
  const regulatoryRecords = (product.registrationRecords ?? []).filter(
    ({ number, sourceUrl }) => Boolean(number || sourceUrl),
  );
  const accessoryDocuments = product.documents.filter(
    ({ kind }) => kind === "accessories",
  );
  const downloadDocuments = product.documents.filter(
    ({ kind }) => kind !== "accessories" && kind !== "registration",
  );
  const hasRegulatoryInformation =
    regulatoryRecords.length > 0 || registrationDocuments.length > 0;
  const hasDownloads = presentation.sections.documents && downloadDocuments.length > 0;
  const featureSectionTitle = "Ключевые особенности";
  const sectionLinks = [
    experience.description ? { href: "#description", label: "Описание" } : null,
    experience.advantages.length > 0
      ? { href: "#advantages", label: featureSectionTitle }
      : null,
    hasCharacteristics
      ? { href: "#specifications", label: "Характеристики" }
      : null,
    experience.applicationAreas.length > 0
      ? { href: "#applications", label: "Области применения" }
      : null,
    experience.manufacturer ? { href: "#manufacturer", label: "Производитель" } : null,
  ].filter((link): link is { href: string; label: string } => link !== null);
  const relatedProductsById = new Map(
    relatedProducts.map((relatedProduct) => [relatedProduct.id, relatedProduct]),
  );
  const manufacturersById = new Map(
    manufacturers.map((entry) => [entry.id, entry]),
  );
  const categoriesById = new Map(
    categories.map((entry) => [entry.id, entry]),
  );
  return (
    <main className="min-h-screen bg-cm-canvas">
      <ProductViewTracker
        productId={product.id}
        productSlug={product.slug}
        productModel={product.model}
        productManufacturer={manufacturer?.name ?? ""}
      />
      {(storefrontDataSource !== "cloud_preview" || isProductStructuredDataGscStagePreview()) && (
        <JsonLd
          data={buildProductStructuredData({
            product,
            category,
            breadcrumbName: productH1,
          })}
        />
      )}
      <section className="border-b border-[var(--cm-rule)] bg-[linear-gradient(135deg,#ffffff_0%,#f6fafc_56%,#e8f5f7_100%)]">
        <div className="cm-container py-4 sm:py-5">
          <Breadcrumbs
            items={[
              { name: "Главная", path: "/" },
              { name: "Каталог", path: "/catalog" },
              ...(category
                ? [{
                    name: category.name,
                    path: `/catalog?category=${encodeURIComponent(category.slug)}` as const,
                  }]
                : []),
              { name: productH1, path: `/catalog/${product.slug}` },
            ]}
          />
          <div
            className="mt-3 grid overflow-hidden rounded-2xl border border-[var(--cm-rule)] bg-white shadow-[0_16px_45px_rgba(11,19,32,0.07)] md:grid-cols-[minmax(0,45fr)_minmax(0,55fr)] lg:grid-cols-[minmax(0,40fr)_minmax(0,60fr)]"
            data-testid="product-hero"
          >
            <div className="border-b border-[var(--cm-rule)] bg-cm-surface-low/45 p-3 sm:p-4 md:border-b-0 md:border-r">
              <ProductGallery
                media={product.media}
                fallbackLabel={PRODUCT_PRESENTATION_FALLBACKS.media}
                productName={product.name}
              />
            </div>

            <div
              className="flex min-w-0 flex-col justify-start p-4 sm:p-5 lg:p-6"
              data-testid="product-hero-content"
            >
              <h1 className="cm-heading-1 max-w-4xl break-words text-[1.65rem] font-extrabold leading-[1.12] sm:text-[2rem] lg:text-[2.25rem]">
                {productH1}
              </h1>
              {experience.summary && (
                <p
                  className="mt-3 line-clamp-4 max-w-3xl text-sm leading-6 text-cm-slate"
                  data-testid="product-hero-summary"
                >
                  {experience.summary}
                </p>
              )}

              {product.commercialPresentation ? (
                <div className="mt-4">
                  <ProductCommercialBadges presentation={product.commercialPresentation} />
                  <p className="mt-1.5 text-[11px] text-cm-dim">
                    {product.commercialPresentation.installmentDescription}
                  </p>
                </div>
              ) : null}

              {experience.badges.length > 0 ? (
                <dl
                  className="mt-4 flex flex-wrap gap-2"
                  aria-label="Ключевая информация о товаре"
                  data-testid="product-metadata"
                >
                  {experience.badges.map((badge) => (
                    <ProductMetadataBadge
                      key={`${badge.label}:${badge.value}`}
                      label={badge.label}
                      value={badge.value}
                      href={badge.href}
                    />
                  ))}
                </dl>
              ) : null}

              {presentation.canRequestQuote ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={buildProductRequestHref(product)}
                    className="cm-button-primary shadow-[0_12px_30px_rgba(11,19,32,0.16)]"
                  >
                    Запросить КП
                  </Link>
                  {presentation.canCompare && storefrontDataSource !== "cloud_preview" ? (
                  <Link
                    href="/compare"
                    className="cm-button-secondary"
                    aria-label={`Открыть сравнение для ${product.name}`}
                  >
                    Открыть сравнение
                  </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="cm-container py-2 sm:py-3">
        {sectionLinks.length > 1 ? (
          <nav
            aria-label="Навигация по странице товара"
            className="sticky top-2 z-20 -mx-1 overflow-x-auto rounded-xl border border-[var(--cm-rule)] bg-white/95 px-2 py-2 shadow-[0_8px_24px_rgba(11,19,32,0.06)] backdrop-blur sm:mx-0 sm:px-3"
          >
            <ul className="flex min-w-max items-center gap-1.5">
              {sectionLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="inline-flex min-h-8 items-center rounded-md px-2.5 text-[11px] font-semibold text-cm-slate transition hover:bg-cm-teal-soft hover:text-cm-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cm-teal"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        {experience.description && (
          <Section id="description" title="Описание">
            <div className="max-w-[62rem] rounded-xl border border-[var(--cm-rule)] bg-cm-surface-low/25 p-4 sm:p-5">
              <SafeProductDescription html={experience.description} />
            </div>
          </Section>
        )}

        {experience.advantages.length > 0 && (
          <Section id="advantages" title={featureSectionTitle}>
            <ul className="grid max-w-[68rem] gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {experience.advantages.map((feature) => (
                <li
                  key={feature}
                  className="flex min-h-[4.25rem] items-center gap-3 rounded-xl border border-[var(--cm-rule)] bg-[linear-gradient(135deg,#ffffff_0%,#f4fafb_100%)] p-3.5 shadow-[0_5px_18px_rgba(11,19,32,0.025)]"
                >
                  <span
                    className="grid size-7 shrink-0 place-items-center rounded-full border border-cm-teal/15 bg-cm-teal-soft text-xs font-extrabold leading-none text-cm-teal"
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                  <span className="font-semibold leading-5 text-cm-ink">{feature}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {hasCharacteristics && (
          <Section id="specifications" title="Технические характеристики">
              <div className="max-w-[64rem] overflow-hidden rounded-lg border border-[var(--cm-rule)] bg-white">
                {specificationGroups.map(([group, specifications]) => (
                  <div key={group}>
                    <h3 className="border-y border-[var(--cm-rule)] bg-cm-surface-low/65 px-4 py-2 text-xs font-semibold first:border-t-0">
                      {group}
                    </h3>
                    {specifications.map((specification) => (
                      <div
                        key={`${specification.label}:${specification.position}`}
                        data-testid="product-characteristic-row"
                        className="grid gap-1 border-b border-[var(--cm-rule)] px-4 py-2.5 last:border-b-0 sm:grid-cols-[minmax(12rem,0.8fr)_1.2fr] sm:items-center"
                      >
                        <div className="text-xs text-cm-slate">{specification.label}</div>
                        <div className="text-sm font-semibold sm:text-right">
                          {specification.value}
                          {specification.unit ? ` ${specification.unit}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
          </Section>
        )}

        {experience.applicationAreas.length > 0 ? (
          <Section id="applications" title="Области применения">
            <ul className="flex max-w-[64rem] flex-wrap gap-2" aria-label="Области применения">
              {experience.applicationAreas.map((area) => (
                <li
                  key={area}
                  className="rounded-full border border-[var(--cm-rule)] bg-cm-surface-low px-3 py-1.5 text-xs font-semibold text-cm-slate"
                >
                  {area}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {hasRegulatoryInformation && (
          <Section id="regulatory" title="Регистрационная информация">
            <div className="grid max-w-[64rem] gap-3 md:grid-cols-2">
              {regulatoryRecords.map((record, index) => (
                <article
                  key={`${record.number}:${record.sourceUrl}:${index}`}
                  className="rounded-lg border border-[var(--cm-rule)] bg-white p-3.5"
                >
                  <h3 className="text-sm font-semibold">
                    {record.number ?? "Регистрационный документ"}
                  </h3>
                  {record.sourceUrl ? (
                    <a
                      href={record.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-xs font-semibold text-cm-teal hover:underline"
                    >
                      Открыть источник →
                    </a>
                  ) : null}
                </article>
              ))}
              {registrationDocuments.map((document) => (
                <DocumentLink
                  key={`${document.kind}:${document.publicUrl}`}
                  document={document}
                />
              ))}
            </div>
          </Section>
        )}

        {presentation.sections.package && (
        <Section id="package" title="Комплектация">
              <div className="max-w-[64rem] space-y-2">
                {accessoryDocuments.map((document) => (
                  <DocumentLink key={document.publicUrl} document={document} />
                ))}
              </div>
        </Section>
        )}

        {hasDownloads && (
          <Section id="documents" title="Документы и загрузки">
              <div className="grid max-w-[64rem] gap-3 md:grid-cols-2">
                {downloadDocuments.map((document) => (
                  <DocumentLink
                    key={`${document.kind}:${document.publicUrl}`}
                    document={document}
                  />
                ))}
              </div>
          </Section>
        )}

        {(presentation.sections.compatibility || presentation.sections.relatedProducts) && (
        <Section id="related-products" title="Связанные товары">
          <div className="grid max-w-[64rem] gap-5 lg:grid-cols-2">
            {presentation.sections.compatibility && (
            <div>
              <h3 className="cm-label">Совместимость</h3>
              <div className="mt-3">
                  <div className="space-y-3">
                    {product.compatibility.map((item) => {
                      const compatibleProduct = item.compatibleProductId
                        ? relatedProductsById.get(item.compatibleProductId)
                        : undefined;
                      return (
                        <div
                          key={`${item.label}:${item.note}`}
                          className="rounded-lg border border-[var(--cm-rule)] bg-white p-4"
                        >
                          {compatibleProduct ? (
                            <Link
                              href={`/catalog/${compatibleProduct.slug}`}
                              className="text-sm font-semibold text-cm-teal hover:underline"
                            >
                              {item.label} →
                            </Link>
                          ) : (
                            <div className="text-sm font-semibold">{item.label}</div>
                          )}
                          {item.note && (
                            <p className="mt-2 text-xs leading-6 text-cm-slate">
                              {item.note}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
              </div>
            </div>
            )}
            {presentation.sections.relatedProducts && (
            <div>
              <h3 className="cm-label">Товары</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {relatedProducts.map((relatedProduct) => (
                  <ProductCard
                    key={relatedProduct.slug}
                    product={relatedProduct}
                    manufacturer={manufacturersById.get(relatedProduct.manufacturerId)}
                    manufacturerLinkEnabled={publicManufacturerIds.has(relatedProduct.manufacturerId)}
                    categoryName={categoriesById.get(relatedProduct.categoryId)?.name}
                    compareEnabled={presentation.canCompare && storefrontDataSource !== "cloud_preview"}
                  />
                ))}
              </div>
            </div>
            )}
          </div>
        </Section>
        )}

        {experience.manufacturer ? (
          <Section id="manufacturer" title="Производитель">
            <ProductManufacturer manufacturer={experience.manufacturer}
              linkEnabled={publicManufacturerIds.has(experience.manufacturer.id)}
            />
          </Section>
        ) : null}
      </div>
      <BackToTop />
    </main>
  );
}

function DocumentLink({ document }: { document: ProductDocument }) {
  return (
    <a
      href={document.publicUrl}
      target="_blank"
      rel="noreferrer"
      className="block rounded-lg border border-[var(--cm-rule)] bg-white p-3.5 transition hover:border-cm-teal hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cm-teal"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{document.title}</div>
          <div className="mt-2 font-sans text-[10px] text-cm-dim">
            {document.language}
          </div>
        </div>
        <Badge>{documentKindLabel(document.kind)}</Badge>
      </div>
    </a>
  );
}

function groupSpecifications(specifications: readonly ProductSpecification[]) {
  const groups = new Map<string, ProductSpecification[]>();
  for (const specification of [...specifications].sort(
    (left, right) => left.position - right.position,
  )) {
    const group = groups.get(specification.group) ?? [];
    group.push(specification);
    groups.set(specification.group, group);
  }
  return [...groups.entries()];
}

function documentKindLabel(kind: ProductDocumentKind) {
  return kind.replaceAll("_", " ");
}

function ProductMetadataBadge({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="min-w-0 max-w-full rounded-lg border border-[var(--cm-rule)] bg-white px-3 py-2 shadow-[0_3px_10px_rgba(11,19,32,0.04)]">
      <dt className="sr-only">{label}</dt>
      <dd className="break-words text-xs font-semibold text-cm-ink">
        {href ? (
          <Link href={href} className="text-cm-teal hover:underline">
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="my-4 scroll-mt-24 rounded-2xl border border-[var(--cm-rule)] bg-white p-5 shadow-[0_10px_32px_rgba(11,19,32,0.035)] sm:my-5 sm:p-7"
    >
      <h2 className="cm-heading-2 text-lg font-bold sm:text-xl">{title}</h2>
      <div className="mt-4 sm:mt-5">{children}</div>
    </section>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-[var(--cm-rule)] bg-white/80 px-2 py-1 font-sans text-[9px] font-semibold text-cm-slate">
      {children}
    </span>
  );
}
