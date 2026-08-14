import type { Metadata } from "next";

import SearchExperience from "@/components/search/SearchExperience";
import {
  catalogRepository,
  categoryService,
  manufacturerService,
  productService,
  searchService,
} from "@/lib/storefront";
import { buildStorefrontMetadata } from "@/lib/storefront/seo";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { q = "" } = await searchParams;
  return buildStorefrontMetadata({
    title: "Поиск медицинских изделий",
    description:
      "Поиск медицинского оборудования по названию, модели, производителю и категории.",
    canonical: "/search",
    noindexFollow: q.trim().length > 0,
  });
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const [results, products, manufacturers, manufacturerReferences, categories] = await Promise.all([
    searchService.searchProducts(q),
    productService.getActiveProducts(),
    manufacturerService.getManufacturers(),
    catalogRepository.getManufacturers(),
    categoryService.getCategories(),
  ]);
  const suggestionProducts = q.trim() ? results : products;
  const suggestions = [
    ...new Set(suggestionProducts.map(({ model }) => model).filter(Boolean)),
  ].slice(0, 8);

  return (
    <main className="min-h-screen bg-cm-canvas">
      <header className="border-b border-[var(--cm-rule)] bg-white">
        <div className="cm-container cm-page-intro">
          <div className="cm-label">Кибермедика · Поиск</div>
          <h1 className="cm-heading-1 mt-2 max-w-3xl text-3xl font-extrabold">
            Поиск медицинских изделий
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-cm-slate">
            Поиск по названию, модели, производителю, категории и ключевым
            особенностям оборудования.
          </p>
        </div>
      </header>

      <section className="cm-container py-6">
        <SearchExperience
          initialQuery={q}
          products={results}
          manufacturers={manufacturers}
          manufacturerReferences={manufacturerReferences}
          categories={categories}
          suggestions={suggestions}
        />
      </section>
    </main>
  );
}
