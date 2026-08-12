import Link from "next/link";
import ManufacturerMark from "@/components/storefront/ManufacturerMark";

interface ManufacturerEntry {
  id: string;
  slug: string;
  name: string;
  country: string | null;
  productCount: number;
}

export default function FeaturedManufacturers({
  manufacturers,
}: {
  manufacturers: readonly ManufacturerEntry[] | null;
}) {
  if (manufacturers?.length === 0) return null;
  const unavailable = manufacturers === null;

  return (
    <section
      aria-labelledby="featured-manufacturers-title"
      className="cm-section border-y border-[var(--cm-rule)] bg-white"
    >
      <div className="cm-container">
        <div className="flex items-end justify-between gap-5">
          <h2
            id="featured-manufacturers-title"
            className="text-2xl font-extrabold leading-[1.2] tracking-[-0.025em] sm:text-[26px] lg:text-[30px]"
          >
            Производители
          </h2>
          {!unavailable && (
            <Link
              href="/manufacturers"
              className="hidden min-h-[44px] items-center text-xs font-semibold text-cm-teal transition hover:text-cm-teal-dark sm:inline-flex"
            >
              Все производители →
            </Link>
          )}
        </div>
        {unavailable ? (
          <div className="cm-empty-state mt-5">
            <p>Производители временно недоступны.</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <form action="/" method="get">
                <button type="submit" className="cm-button-secondary !min-h-[44px] w-full">
                  Повторить
                </button>
              </form>
              <Link href="/manufacturers" className="cm-button-secondary !min-h-[44px]">
                Все производители
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {manufacturers.map((manufacturer) => (
                <Link
                  key={manufacturer.id}
                  href={`/manufacturers/${manufacturer.slug}`}
                  className="group cm-card flex min-h-24 flex-col p-4 sm:min-h-28"
                >
                  <div className="flex items-center gap-3">
                    <ManufacturerMark slug={manufacturer.slug} name={manufacturer.name} />
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-bold leading-5">{manufacturer.name}</h3>
                      {manufacturer.country && (
                        <div className="mt-1 text-[10px] text-cm-slate">{manufacturer.country}</div>
                      )}
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-4 border-t border-[var(--cm-rule)] pt-3 text-xs">
                    <span className="font-mono text-[9px] text-cm-dim">
                      {manufacturer.productCount} товаров
                    </span>
                    <span className="font-semibold text-cm-dim transition group-hover:text-cm-teal">
                      Открыть →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            <Link
              href="/manufacturers"
              className="cm-button-secondary mt-4 !min-h-[44px] w-full sm:!hidden"
            >
              Все производители
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
