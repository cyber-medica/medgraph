import type { Metadata } from "next";
import Link from "next/link";

import ComparisonTable from "@/components/compare/ComparisonTable";
import { catalogRepository, compareService, storefrontDataSource } from "@/lib/storefront";
import { buildStorefrontMetadata } from "@/lib/storefront/seo";

export const metadata: Metadata = buildStorefrontMetadata({
  title: "Сравнение медицинского оборудования",
  description:
    "Сравнение медицинского оборудования по описанию, техническим характеристикам, документам и совместимости.",
  canonical: "/compare",
});

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--cm-rule)] bg-white px-4 py-3">
      <div className="cm-label">{label}</div>
      <div className="mt-2 font-mono text-2xl font-semibold text-cm-ink">
        {value}
      </div>
    </div>
  );
}

export default async function ComparePage() {
  if (storefrontDataSource === "cloud_preview") {
    return (
      <main className="min-h-screen bg-cm-canvas">
        <section className="cm-container py-8">
          <div className="cm-empty-state py-5" aria-labelledby="compare-preview-title">
            <div className="cm-empty-icon">⇄</div>
            <h1 id="compare-preview-title" className="mt-4 text-lg font-bold">
              Сравнение недоступно в Cloud Catalog Preview
            </h1>
            <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-cm-slate">
              Draft-товары не сравниваются автоматически. Сценарий будет доступен
              после проверки категорий и публикации сопоставимых изделий.
            </p>
            <Link href="/catalog" className="cm-button-primary mt-5">
              Вернуться в каталог
            </Link>
          </div>
        </section>
      </main>
    );
  }
  const comparableProducts = await compareService.getComparableProducts();
  const result = await compareService.compareProducts(
    comparableProducts.slice(0, 2).map(({ slug }) => slug),
  );
  const [manufacturers, categories] = await Promise.all([
    catalogRepository.getManufacturers(),
    catalogRepository.getCategories(),
  ]);
  const manufacturersById = new Map(
    manufacturers.map((manufacturer) => [manufacturer.id, manufacturer]),
  );
  const categoriesById = new Map(
    categories.map((category) => [category.id, category]),
  );

  if (!result.products.length) {
    return (
      <main className="min-h-screen bg-cm-canvas">
        <section className="cm-container py-8">
          <div className="cm-empty-state py-5" aria-labelledby="compare-empty-title">
            <div className="cm-empty-icon">⇄</div>
            <h1 id="compare-empty-title" className="mt-4 text-lg font-bold">
              Для сравнения пока нет доступных товаров
            </h1>
            <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-cm-slate">
              Откройте каталог или воспользуйтесь поиском, чтобы посмотреть
              доступное оборудование.
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
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cm-canvas">
      <header className="border-b border-[var(--cm-rule)] bg-white">
        <div className="cm-container cm-page-intro">
          <div className="cm-label">Кибермедика · Сравнение</div>
          <h1 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-[-0.03em]">
            Сравнение медицинского оборудования
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-cm-slate">
            Сопоставьте описание, технические характеристики, документы и
            совместимость товаров из каталога.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/catalog" className="cm-button-primary">
              Выбрать товары в каталоге
            </Link>
            <Link href="/search" className="cm-button-secondary">
              Найти оборудование
            </Link>
          </div>
        </div>
      </header>

      <section className="cm-container space-y-5 py-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="товаров" value={result.summary.products} />
          <Metric label="характеристик" value={result.summary.specifications} />
          <Metric label="различий" value={result.summary.differences} />
          <Metric label="нет данных" value={result.summary.missingValues} />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {result.products.map((product) => {
            const manufacturer = manufacturersById.get(product.manufacturerId);
            return (
              <article
                key={product.id}
                className="rounded-xl border border-[var(--cm-rule)] bg-white p-4"
              >
                {manufacturer ? (
                  <Link
                    href={`/manufacturers/${manufacturer.slug}`}
                    className="cm-label hover:text-cm-teal"
                  >
                    {manufacturer.name} →
                  </Link>
                ) : null}
                <h2 className="mt-2 text-xl font-semibold text-cm-ink">
                  <Link href={`/catalog/${product.slug}`} className="hover:text-cm-teal">
                    {product.name}
                  </Link>
                </h2>
                <p className="mt-2 text-sm text-cm-slate">
                  {categoriesById.get(product.categoryId)?.name ?? ""} · {product.model}
                </p>
                <Link
                  href={`/catalog/${product.slug}`}
                  className="mt-4 inline-flex text-xs font-semibold text-cm-teal"
                >
                  Открыть карточку товара →
                </Link>
              </article>
            );
          })}
        </div>

        <ComparisonTable
          result={result}
          manufacturers={manufacturersById}
          categories={categoriesById}
        />
      </section>
    </main>
  );
}
