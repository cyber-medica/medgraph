import Link from "next/link";

interface CategoryEntry {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  productCount: number;
}

export default function Categories({
  categories,
}: {
  categories: readonly CategoryEntry[] | null;
}) {
  if (categories?.length === 0) return null;
  const unavailable = categories === null;

  return (
    <section
      aria-labelledby="featured-categories-title"
      className="cm-section bg-cm-canvas"
    >
      <div className="cm-container">
        <div className="flex items-end justify-between gap-5">
          <div>
            <h2
              id="featured-categories-title"
              className="cm-heading-2 text-2xl font-extrabold leading-[1.2] sm:text-[26px] lg:text-[30px]"
            >
              Основные категории оборудования
            </h2>
            <p className="mt-2 max-w-[38rem] text-sm leading-6 text-cm-slate">
              Выберите направление, чтобы открыть опубликованные модели в каталоге.
            </p>
          </div>
          {!unavailable && (
            <Link
              href="/catalog"
              className="hidden min-h-[44px] items-center text-xs font-semibold text-cm-teal transition hover:text-cm-teal-dark sm:inline-flex"
            >
              Все категории →
            </Link>
          )}
        </div>
        {unavailable ? (
          <div className="cm-empty-state mt-5">
            <p>Категории временно недоступны.</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <form action="/" method="get">
                <button type="submit" className="cm-button-secondary !min-h-[44px] w-full">
                  Повторить
                </button>
              </form>
              <Link href="/catalog" className="cm-button-secondary !min-h-[44px]">
                Перейти в каталог
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {categories.map((category) => (
                <Link
                  href={`/catalog?category=${encodeURIComponent(category.slug)}`}
                  key={category.id}
                  className="cm-card group flex min-h-[8.5rem] flex-col p-4 sm:min-h-36"
                >
                  <h3 className="cm-heading-3 text-[15px] font-bold leading-5">
                    {category.name}
                  </h3>
                  {category.shortDescription && (
                    <p className="mt-2 line-clamp-2 max-w-[30rem] text-xs leading-5 text-cm-slate">
                      {category.shortDescription}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between gap-4 border-t border-[var(--cm-rule)] pt-3">
                    <span className="font-sans text-[10px] text-cm-dim">
                      {category.productCount} товаров
                    </span>
                    <span className="text-xs font-semibold text-cm-teal">
                      Открыть →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            <Link
              href="/catalog"
              className="cm-button-secondary mt-4 !min-h-[44px] w-full sm:!hidden"
            >
              Все категории
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
