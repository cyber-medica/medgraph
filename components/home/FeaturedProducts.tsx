import Image from "next/image";
import Link from "next/link";

interface FeaturedProductEntry {
  id: string;
  slug: string;
  category: string;
  name: string;
  description: string;
  image: { url: string; alt: string } | null;
  manufacturer: string;
  country: string;
  commercialActionsEnabled: boolean;
}

export default function FeaturedProducts({
  products,
}: {
  products: readonly FeaturedProductEntry[];
}) {
  return (
    <section
      aria-labelledby="popular-products-title"
      className="cm-container cm-section"
    >
      <div className="mb-5 flex items-end justify-between gap-5">
        <div>
          <div className="cm-label">Избранное из каталога</div>
          <h2
            id="popular-products-title"
            className="cm-section-title"
          >
            Популярные товары
          </h2>
        </div>
        <Link href="/catalog" className="text-xs font-semibold text-cm-teal transition hover:text-cm-teal-dark">
          В каталог →
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <article
            key={product.id}
            className="cm-card group flex min-h-[25rem] flex-col overflow-hidden"
          >
            <Link
              href={`/catalog/${product.slug}`}
              className="relative flex h-48 items-center justify-center border-b border-[var(--cm-rule)] bg-[linear-gradient(145deg,#f3f8f9,#ffffff)]"
              aria-label={`Открыть карточку ${product.name}`}
            >
              {product.image ? (
                <Image
                  src={product.image.url}
                  alt={product.image.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                  className="object-contain p-5 transition duration-300 group-hover:scale-[1.025]"
                />
              ) : (
                <span className="text-xs text-cm-dim">Изображение отсутствует</span>
              )}
            </Link>
            <div className="flex flex-1 flex-col p-5">
              <div className="cm-eyebrow !text-cm-teal">
                {product.category}
              </div>
              <Link href={`/catalog/${product.slug}`} className="mt-3 block">
                <h3 className="cm-heading-3 text-[17px] font-bold leading-6 transition group-hover:text-cm-teal">{product.name}</h3>
              </Link>
              {product.description && (
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-cm-slate">
                  {product.description}
                </p>
              )}
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--cm-rule)] pt-4 text-[11px]">
                <div>
                  <dt className="cm-label">Производитель</dt>
                  <dd className="mt-1 font-semibold text-cm-ink">{product.manufacturer}</dd>
                </div>
                <div>
                  <dt className="cm-label">Страна</dt>
                  <dd className="mt-1 font-semibold text-cm-ink">{product.country}</dd>
                </div>
              </dl>
              <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                <Link href={`/catalog/${product.slug}`} className="text-xs font-semibold text-cm-teal hover:text-cm-teal-dark">
                  Подробнее →
                </Link>
                {product.commercialActionsEnabled ? (
                  <Link href={`/request?product=${encodeURIComponent(product.slug)}`} className="cm-button-primary min-h-9 px-3.5 py-2 text-xs">
                    Запросить КП
                  </Link>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
