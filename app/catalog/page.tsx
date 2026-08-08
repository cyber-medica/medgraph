import type { Metadata } from "next";
import CatalogExplorer from "@/components/catalog/CatalogExplorer";
import JsonLd from "@/components/seo/JsonLd";
import {
  categoryService,
  manufacturerService,
  productService,
  searchService,
  storefrontDataSource,
} from "@/lib/storefront";
import { buildStorefrontMetadata } from "@/lib/storefront/seo";
import { buildCollectionPageStructuredData } from "@/lib/storefront/structured-data";

const catalogDescription =
  "Поиск медицинских изделий по названию, производителю, категории, документам, аналогам и совместимости.";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; manufacturer?: string; applicationArea?: string; sort?: string }>;
}): Promise<Metadata> {
  const { q = "" } = await searchParams;
  return buildStorefrontMetadata({
    title: "Каталог медицинских изделий",
    description: catalogDescription,
    canonical: "/catalog",
    noindexFollow: q.trim().length > 0,
  });
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; manufacturer?: string; applicationArea?: string; sort?: string }>;
}) {
  const {
    q = "",
    category = "",
    manufacturer = "",
    applicationArea = "",
    sort = "name-asc",
  } = await searchParams;
  const [products, categories, manufacturers, initialSearchResults] =
    await Promise.all([
      productService.getActiveProducts(),
      categoryService.getCategories(),
      manufacturerService.getManufacturers(),
      q ? searchService.searchProducts(q) : Promise.resolve([]),
    ]);
  const applicationAreaCount = new Set(
    products.flatMap((product) => product.applicationAreas),
  ).size;
  const catalogSummary = [
    ["Товары", products.length],
    ["Производители", manufacturers.length],
    ["Категории", categories.length],
    ["Области применения", applicationAreaCount],
  ] as const;

  return (
    <main className="min-h-screen bg-cm-canvas">
      {storefrontDataSource !== "cloud_preview" && (
        <JsonLd
          data={buildCollectionPageStructuredData({
            name: "Каталог медицинских изделий",
            description: catalogDescription,
            path: "/catalog",
          })}
        />
      )}
      <header className="border-b border-[var(--cm-rule)] bg-[linear-gradient(135deg,#ffffff_0%,#f6fafc_58%,#e8f5f7_100%)]">
        <div className="cm-container cm-page-intro">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_30rem] lg:items-end">
            <div>
              <div className="cm-label">CyberMedica · Каталог</div>
              <h1 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-[-0.03em]">
                Каталог медицинских изделий
              </h1>
              <p className="mt-2 max-w-2xl text-[13px] leading-6 text-cm-slate">
                Медицинское оборудование по категориям и производителям:
                описания, технические характеристики и подбор оборудования.
              </p>
            </div>
            <div aria-label="Сводка каталога">
              <div className="cm-label !text-cm-teal">Сводка каталога</div>
              <div className="mt-2 grid grid-cols-2 overflow-hidden rounded-xl border border-[var(--cm-rule)] bg-white/78 sm:grid-cols-4">
                {catalogSummary.map(([label, value]) => (
                  <div
                    key={label}
                    className="border-b border-r border-[var(--cm-rule)] px-3 py-2.5 even:border-r-0 [&:nth-last-child(-n+2)]:border-b-0 sm:border-b-0 sm:even:border-r sm:last:border-r-0"
                  >
                    <div className="font-mono text-lg font-bold leading-none text-cm-ink">{value}</div>
                    <div className="mt-1.5 text-[9px] font-medium leading-3 text-cm-slate">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>
      <div className="cm-container py-6">
        <CatalogExplorer
          initialQuery={q}
          initialCategory={category}
          initialManufacturer={manufacturer}
          initialApplicationArea={applicationArea}
          initialSort={sort}
          products={products}
          categories={categories}
          manufacturers={manufacturers}
          initialSearchResultIds={initialSearchResults.map(({ id }) => id)}
          compareEnabled={storefrontDataSource !== "cloud_preview"}
        />
      </div>
    </main>
  );
}
