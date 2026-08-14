import Link from "next/link";

import FeaturedProductsCarousel from "@/components/home/FeaturedProductsCarousel";
import type { Category, Manufacturer, Product } from "@/lib/storefront/types";

export default function Equipment({
  products,
  manufacturers,
  categories,
  minimumProductCount = 1,
}: {
  products: readonly Product[] | null;
  manufacturers: readonly Manufacturer[];
  categories: readonly Category[];
  minimumProductCount?: number;
}) {
  if (!products || products.length < minimumProductCount) return null;

  const manufacturersById = new Map(
    manufacturers.map((manufacturer) => [manufacturer.id, manufacturer]),
  );
  const categoryNamesById = new Map(categories.map((category) => [category.id, category.name]));

  return (
    <section
      aria-labelledby="homepage-equipment-title"
      className="cm-section border-b border-[var(--cm-rule)] bg-white"
    >
      <div className="cm-container">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-5">
          <div>
            <h2
              id="homepage-equipment-title"
              className="cm-heading-2 text-2xl font-extrabold leading-[1.2] sm:text-[26px] lg:text-[30px]"
            >
              Популярное медицинское оборудование
            </h2>
            <p className="mt-2 max-w-[42rem] text-sm leading-6 text-cm-slate">
              Оборудование для эндоскопии, диагностики и оснащения клиник — в наличии и с рассрочкой{"\u00a0"}0%.
            </p>
          </div>
          <Link href="/catalog" className="cm-button-secondary !min-h-[44px] w-full sm:w-auto">
            Смотреть весь каталог
          </Link>
        </div>
        <FeaturedProductsCarousel
            products={products.map((product) => ({
              id: product.id,
              slug: product.slug,
              name: product.name,
              model: product.model,
              manufacturer: manufacturersById.get(product.manufacturerId)?.name ?? "Производитель уточняется",
              summary:
                product.shortDescription ||
                categoryNamesById.get(product.categoryId) ||
                "Медицинское оборудование для оснащения учреждений.",
              commercialPresentation: product.commercialPresentation,
              image: (() => {
                const media = product.media.find(({ type }) => type === "image");
                return media ? { url: media.url, alt: media.alt } : null;
              })(),
            }))}
        />
      </div>
    </section>
  );
}
