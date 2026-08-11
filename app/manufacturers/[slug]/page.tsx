import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import JsonLd from "@/components/seo/JsonLd";
import ManufacturerMark from "@/components/storefront/ManufacturerMark";
import {
  catalogRepository,
  manufacturerService,
  productService,
  storefrontDataSource,
} from "@/lib/storefront";
import {
  buildManufacturerSeoMetadataV3,
  getManufacturerSeoContent,
  orderManufacturerProductsV3,
} from "@/lib/seo/implementation-v3";
import { buildManufacturerStructuredData } from "@/lib/storefront/structured-data";
import { getProductPresentation } from "@/lib/storefront/product-presentation";
import { formatCountryForPublic } from "@/lib/storefront/country-presentation";
import { isVerifiedLocalManufacturerLogo } from "@/lib/storefront/manufacturer-presentation";

interface ManufacturerPageProps {
  params: Promise<{ slug: string }>;
}

// Published slugs are runtime data and must not require an application rebuild.
export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  if (storefrontDataSource === "cloud_published") return [];
  const manufacturers = await manufacturerService.getManufacturers();
  return manufacturers.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: ManufacturerPageProps): Promise<Metadata> {
  const { slug } = await params;
  const manufacturer = await manufacturerService.getManufacturerBySlug(slug);
  if (!manufacturer) notFound();

  return buildManufacturerSeoMetadataV3(
    manufacturer,
    isVerifiedLocalManufacturerLogo(manufacturer.logoUrl)
      ? { url: manufacturer.logoUrl, alt: `${manufacturer.name} — логотип` }
      : undefined,
  );
}

export default async function ManufacturerPage({ params }: ManufacturerPageProps) {
  const { slug } = await params;
  const manufacturer = await manufacturerService.getManufacturerBySlug(slug);
  if (!manufacturer) notFound();

  const [products, allCategories] = await Promise.all([
    productService.getProductsByManufacturer(manufacturer.id),
    catalogRepository.getCategories(),
  ]);
  const categoriesById = new Map(
    allCategories
      .filter(({ status }) => status === "active")
      .map((category) => [category.id, category]),
  );
  const manufacturerCategories = [
    ...new Set(
      products.flatMap((product) => {
        const category = categoriesById.get(product.categoryId);
        return category ? [category.name] : [];
      }),
    ),
  ];
  const country = formatCountryForPublic(manufacturer.country);
  const manufacturerSeo = getManufacturerSeoContent(manufacturer);
  const orderedProducts = orderManufacturerProductsV3(
    products,
    manufacturerSeo.priorityLinks,
  );

  return (
    <main className="min-h-screen bg-cm-canvas">
      {storefrontDataSource !== "cloud_preview" && (
        <JsonLd data={buildManufacturerStructuredData(manufacturer)} />
      )}
      <section className="cm-container py-6">
        <Link href="/manufacturers" className="text-xs font-semibold text-cm-teal">
          ← Все производители
        </Link>
        <div className="mt-4 cm-card overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-[var(--cm-rule)] bg-cm-surface-low px-5 py-3">
            <span className="cm-label">Карточка производителя</span>
            <ManufacturerMark
              logoUrl={manufacturer.logoUrl}
              name={manufacturer.name}
              size="lg"
            />
          </div>
          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_18rem]">
            <div>
              {country && <div className="text-[11px] font-semibold text-cm-teal">{country}</div>}
              <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em]">
                {manufacturerSeo.h1}
              </h1>
              <p className="mt-3 max-w-2xl text-[13px] leading-6 text-cm-slate">
                {manufacturerSeo.intro}
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {manufacturerCategories.map((category) => (
                  <span
                    key={category}
                    className="rounded-md border border-cm-teal/15 bg-cm-teal-soft px-2.5 py-1 text-[10px] text-cm-teal"
                  >
                    {category}
                  </span>
                ))}
              </div>
            </div>
            <dl className="divide-y divide-[var(--cm-rule)] border-t border-[var(--cm-rule)] lg:border-t-0">
              {country && <div className="flex justify-between gap-4 py-3">
                <dt className="cm-label">Страна</dt>
                <dd className="text-xs font-semibold">{country}</dd>
              </div>}
              <div className="flex justify-between gap-4 py-3">
                <dt className="cm-label">Изделий</dt>
                <dd className="font-mono text-xs font-semibold">{products.length}</dd>
              </div>
              {manufacturer.websiteUrl && (
                <div className="flex justify-between gap-4 py-3">
                  <dt className="cm-label">Сайт</dt>
                  <dd className="text-right text-xs font-semibold">
                    <a
                      href={manufacturer.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cm-teal hover:underline"
                    >
                      Официальный сайт ↗
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        <div className="mt-7 flex items-end justify-between gap-6">
          <div>
            <div className="cm-label">Каталог</div>
            <h2 className="mt-2 text-xl font-bold">Изделия производителя</h2>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/catalog" className="text-xs font-semibold text-cm-slate hover:text-cm-teal">
              Весь каталог
            </Link>
            <Link href="/request" className="text-xs font-semibold text-cm-teal">
              Запросить КП →
            </Link>
          </div>
        </div>

        {products.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {orderedProducts.map((product) => {
              const presentation = getProductPresentation(product, {
                categoryName: categoriesById.get(product.categoryId)?.name,
                country,
                manufacturerName: manufacturer.name,
              });
              return (
              <article
                key={product.slug}
                className="group cm-card flex min-h-48 flex-col p-4"
              >
                <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-cm-dim">
                  {presentation.categoryLabel}
                </div>
                <h3 className="mt-3 text-sm font-bold leading-5">
                  <Link
                    href={`/catalog/${product.slug}`}
                    className="hover:text-cm-teal"
                  >
                    {product.name}
                  </Link>
                </h3>
                {presentation.shortDescription && (
                  <p className="mt-2 text-xs leading-5 text-cm-slate">
                    {presentation.shortDescription}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[var(--cm-rule)] pt-3 text-xs font-semibold">
                  <Link
                    href={`/catalog/${product.slug}`}
                    className="text-cm-teal"
                  >
                    Открыть карточку →
                  </Link>
                </div>
              </article>
              );
            })}
          </div>
        ) : (
          <div className="cm-empty-state mt-5">
            <div className="cm-empty-icon">⌁</div>
            <h3 className="mt-4 text-sm font-bold">Товары пока не добавлены</h3>
            <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-cm-slate">
              Откройте общий каталог или воспользуйтесь поиском, чтобы найти
              оборудование других производителей.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link href="/catalog" className="cm-button-primary">
                Открыть каталог
              </Link>
              <Link href="/search" className="cm-button-secondary">
                Начать поиск
              </Link>
              <Link href="/manufacturers" className="cm-button-secondary">
                Все производители
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
