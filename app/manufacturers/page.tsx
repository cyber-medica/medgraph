import type { Metadata } from "next";
import Link from "next/link";

import JsonLd from "@/components/seo/JsonLd";
import ManufacturerMark from "@/components/storefront/ManufacturerMark";
import {
  catalogRepository,
  manufacturerService,
  productService,
  storefrontDataSource,
} from "@/lib/storefront";
import { buildStorefrontMetadata } from "@/lib/storefront/seo";
import { buildCollectionPageStructuredData } from "@/lib/storefront/structured-data";
import { formatCountryForPublic } from "@/lib/storefront/country-presentation";

const manufacturersDescription =
  "Производители медицинского оборудования, представленные в каталоге Кибермедика.";

export const metadata: Metadata = buildStorefrontMetadata({
  title: "Производители медицинских изделий",
  description: manufacturersDescription,
  canonical: "/manufacturers",
});

export default async function ManufacturersPage() {
  const [manufacturers, products, allCategories] = await Promise.all([
    manufacturerService.getManufacturers(),
    productService.getActiveProducts(),
    catalogRepository.getCategories(),
  ]);
  const categories = allCategories.filter(({ status }) => status === "active");
  const categoriesById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const directory = manufacturers.map((manufacturer) => {
    const manufacturerProducts = products.filter(
      (product) => product.manufacturerId === manufacturer.id,
    );
    const manufacturerCategories = [
      ...new Set(
        manufacturerProducts.flatMap((product) => {
          const category = categoriesById.get(product.categoryId);
          return category ? [category.name] : [];
        }),
      ),
    ];
    return {
      manufacturer,
      country: formatCountryForPublic(manufacturer.country),
      productCount: manufacturerProducts.length,
      categories: manufacturerCategories,
    };
  });

  return (
    <main className="min-h-screen bg-cm-canvas">
      {storefrontDataSource !== "cloud_preview" && (
        <JsonLd
          data={buildCollectionPageStructuredData({
            name: "Производители медицинских изделий",
            description: manufacturersDescription,
            path: "/manufacturers",
          })}
        />
      )}
      <header className="border-b border-[var(--cm-rule)] bg-[linear-gradient(135deg,#ffffff_0%,#f6fafc_58%,#e8f5f7_100%)]">
        <div className="cm-container py-7 sm:py-9">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
            <div>
              <div className="cm-label">Каталог производителей</div>
              <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em]">Производители</h1>
              <p className="mt-2 max-w-2xl text-[13px] leading-6 text-cm-slate">
                Производители медицинского оборудования, представленные в каталоге Кибермедика.
              </p>
            </div>
          <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-[var(--cm-rule)] bg-white/78">
            {[
              ["Производителей", manufacturers.length],
              ["Изделий", products.length],
              ["Категорий", categories.length],
            ].map(([label, value]) => (
              <div key={label} className="border-r border-[var(--cm-rule)] px-3 py-3 last:border-r-0">
                <div className="font-mono text-lg font-bold text-cm-ink sm:text-xl">
                  {value}
                </div>
                <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.08em] text-cm-dim sm:text-[10px]">{label}</div>
              </div>
            ))}
          </div>
          </div>
        </div>
      </header>

      <section className="cm-container py-6">
        {directory.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {directory.map(({ manufacturer, country, productCount }) => (
            <Link
              key={manufacturer.slug}
              href={`/manufacturers/${manufacturer.slug}`}
              className="group cm-card relative flex min-h-48 flex-col overflow-hidden p-4"
            >
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cm-teal/70 to-cm-verified/60 opacity-0 transition duration-200 group-hover:opacity-100"
              />
              <div className="flex items-center justify-between gap-3">
                {country ? <div className="text-[10px] text-cm-slate">{country}</div> : <span />}
                <div className="rounded border border-[var(--cm-rule)] bg-cm-surface-low px-2.5 py-1 font-mono text-[9px] text-cm-dim">
                  {productCount} товаров
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <ManufacturerMark
                  logoUrl={manufacturer.logoUrl}
                  name={manufacturer.name}
                />
                <h2 className="text-[15px] font-bold leading-5">{manufacturer.name}</h2>
              </div>
              <p className="mt-3 line-clamp-2 text-[11px] leading-5 text-cm-slate">
                {manufacturer.shortDescription}
              </p>
              <div className="mt-auto border-t border-[var(--cm-rule)] pt-3 text-xs font-semibold text-cm-dim transition duration-200 group-hover:text-cm-teal">
                Открыть производителя →
              </div>
            </Link>
            ))}
          </div>
        ) : (
          <div className="cm-empty-state">
            <div className="cm-empty-icon">⌁</div>
            <h2 className="mt-4 text-sm font-bold">
              Производители пока не добавлены
            </h2>
            <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-cm-slate">
              Перейдите в каталог или воспользуйтесь поиском доступного
              оборудования.
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
