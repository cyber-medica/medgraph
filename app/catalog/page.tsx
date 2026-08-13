import type { Metadata } from "next";
import CatalogExplorer from "@/components/catalog/CatalogExplorer";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import JsonLd from "@/components/seo/JsonLd";
import {
  catalogRepository,
  categoryService,
  manufacturerService,
  productService,
  searchService,
  storefrontDataSource,
} from "@/lib/storefront";
import { buildBreadcrumbJsonLd, buildStorefrontMetadata } from "@/lib/storefront/seo";
import { buildCollectionPageStructuredData } from "@/lib/storefront/structured-data";

const catalogDescription =
  "Поиск медицинских изделий по названию, производителю, категории, документам, аналогам и совместимости.";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; manufacturer?: string; applicationArea?: string; sort?: string }>;
}): Promise<Metadata> {
  const {
    q = "",
    category = "",
    manufacturer = "",
    applicationArea = "",
    sort = "name-asc",
  } = await searchParams;
  const hasFilteredView = q.trim().length > 0
    || category.length > 0
    || manufacturer.length > 0
    || applicationArea.length > 0
    || sort !== "name-asc";
  return buildStorefrontMetadata({
    title: "Каталог медицинских изделий",
    description: catalogDescription,
    canonical: "/catalog",
    noindexFollow: hasFilteredView,
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
  const [products, categories, manufacturers, manufacturerReferences, initialSearchResults] =
    await Promise.all([
      productService.getActiveProducts(),
      categoryService.getCategories(),
      manufacturerService.getManufacturers(),
      catalogRepository.getManufacturers(),
      q ? searchService.searchProducts(q) : Promise.resolve([]),
    ]);
  return (
    <main className="min-h-screen bg-cm-canvas">
      {storefrontDataSource !== "cloud_preview" && (
        <JsonLd
          data={[
            buildCollectionPageStructuredData({
              name: "Каталог медицинских изделий",
              description: catalogDescription,
              path: "/catalog",
            }),
            buildBreadcrumbJsonLd([
              { name: "Главная", path: "/" },
              { name: "Каталог", path: "/catalog" },
            ]),
          ]}
        />
      )}
      <header className="border-b border-[var(--cm-rule)] bg-[linear-gradient(135deg,#ffffff_0%,#f6fafc_58%,#e8f5f7_100%)]">
        <div className="cm-container cm-page-intro">
          <Breadcrumbs
            items={[
              { name: "Главная", path: "/" },
              { name: "Каталог", path: "/catalog" },
            ]}
          />
          <h1 className="mt-3 max-w-3xl text-3xl font-extrabold tracking-[-0.03em]">
            Каталог медицинских изделий
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-cm-slate">
            Медицинское оборудование по категориям и производителям:
            описания, технические характеристики и подбор оборудования.
          </p>
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
          manufacturerReferences={manufacturerReferences}
          initialSearchResultIds={initialSearchResults.map(({ id }) => id)}
          compareEnabled={storefrontDataSource !== "cloud_preview"}
        />
      </div>
    </main>
  );
}
