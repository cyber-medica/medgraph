import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import JsonLd from "@/components/seo/JsonLd";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import ManufacturerMark from "@/components/storefront/ManufacturerMark";
import ProductCard from "@/components/storefront/ProductCard";
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
import { formatCountryForPublic } from "@/lib/storefront/country-presentation";
import { getApprovedManufacturerLogoUrl } from "@/lib/storefront/manufacturer-logo-policy";

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
  const approvedLogoUrl = getApprovedManufacturerLogoUrl(manufacturer.slug);

  return buildManufacturerSeoMetadataV3(
    manufacturer,
    approvedLogoUrl
      ? { url: approvedLogoUrl, alt: `${manufacturer.name} — логотип` }
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
        <Breadcrumbs
          items={[
            { name: "Главная", path: "/" },
            { name: "Производители", path: "/manufacturers" },
            { name: manufacturer.name, path: `/manufacturers/${manufacturer.slug}` },
          ]}
        />
        <div className="mt-4 cm-card overflow-hidden">
          <div className="border-b border-[var(--cm-rule)] bg-cm-surface-low px-5 py-3">
            <span className="cm-eyebrow">Карточка производителя</span>
          </div>
          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_18rem]">
            <div>
              {country && <div className="text-[11px] font-semibold text-cm-teal">{country}</div>}
              <div className="mt-2 flex min-w-0 items-center gap-3 sm:gap-4">
                <ManufacturerMark
                  slug={manufacturer.slug}
                  name={manufacturer.name}
                  size="hero"
                />
                <h1 className="min-w-0 break-words text-3xl font-extrabold tracking-[-0.03em]">
                  {manufacturerSeo.h1}
                </h1>
              </div>
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
                <dt className="cm-eyebrow">Страна</dt>
                <dd className="text-xs font-semibold">{country}</dd>
              </div>}
              {manufacturer.websiteUrl && (
                <div className="flex justify-between gap-4 py-3">
                  <dt className="cm-eyebrow">Сайт</dt>
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
            <div className="cm-eyebrow">Каталог</div>
            <h2 className="mt-2 text-xl font-bold">Изделия производителя</h2>
            <p className="mt-1 font-sans text-[10px] font-semibold tracking-normal text-cm-dim">Товаров: {products.length}</p>
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

        {orderedProducts.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {orderedProducts.map((product) => (
              <ProductCard
                key={product.slug}
                product={product}
                manufacturer={manufacturer}
                categoryName={categoriesById.get(product.categoryId)?.name}
                compareEnabled={storefrontDataSource !== "cloud_preview"}
              />
            ))}
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
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
