import Image from "next/image";
import Link from "next/link";

import Search from "@/components/home/Search";
import type { Product } from "@/lib/storefront/types";

const HERO_PRODUCT_SLUG = "767632362-330695211247-apparat-ivl-hamilton-t1";

export default function Hero({ products }: { products: readonly Product[] }) {
  const heroProduct = products.find(({ slug }) => slug === HERO_PRODUCT_SLUG)
    ?? products.find((product) => product.media.some(({ type }) => type === "image"));
  const heroImage = heroProduct?.media.find(({ type }) => type === "image");

  return (
    <>
      <section
        aria-labelledby="homepage-title"
        className="border-b border-[var(--cm-rule)] bg-[linear-gradient(135deg,#ffffff_0%,#f6fafc_58%,#e8f5f7_100%)]"
      >
        <div className="cm-container py-7 sm:py-9 lg:py-10">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1.12fr)_minmax(23rem,0.88fr)] lg:items-center lg:gap-10">
            <div className="max-w-[42rem]">
              <p className="text-xs font-bold tracking-[0.16em] text-cm-teal">
                ПОДБОР И ПОСТАВКА ОБОРУДОВАНИЯ
              </p>
              <h1
                id="homepage-title"
                className="cm-balanced mt-3 max-w-[43rem] text-[2.125rem] font-extrabold leading-[1.08] tracking-[-0.035em] text-cm-ink sm:text-[2.5rem] lg:text-[2.75rem]"
              >
                Медицинское оборудование для клиник и медицинских учреждений
              </h1>
              <p className="mt-4 max-w-[44rem] text-[15px] leading-6 text-cm-slate sm:text-base sm:leading-7">
                Подбор, поставка и сопровождение профессионального медицинского
                оборудования для государственных и частных заказчиков.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link href="/catalog" className="cm-button-primary !min-h-[48px] w-full sm:w-auto">
                  Перейти в каталог
                </Link>
                <Link href="/request" className="cm-button-secondary !min-h-[44px] w-full sm:w-auto">
                  Отправить запрос
                </Link>
              </div>
            </div>
            {heroProduct && heroImage && (
              <Link
                href={`/catalog/${heroProduct.slug}`}
                aria-label={`Открыть карточку товара «${heroProduct.name}»`}
                className="group relative block min-h-[14rem] cursor-pointer overflow-hidden rounded-2xl border border-[var(--cm-rule-strong)] bg-[linear-gradient(145deg,#f8fcfc_0%,#dff0f3_100%)] p-4 shadow-[0_20px_50px_rgba(11,19,32,0.10)] transition duration-200 hover:border-cm-teal hover:shadow-[0_24px_54px_rgba(11,19,32,0.14)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cm-teal sm:min-h-[18rem] sm:p-6 lg:min-h-[22rem]"
              >
                <div aria-hidden="true" className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-cm-teal/10" />
                <div className="absolute inset-x-4 bottom-20 top-4 sm:inset-x-6 sm:bottom-24 sm:top-6">
                  <Image
                    src={heroImage.url}
                    alt=""
                    fill
                    preload
                    sizes="(max-width: 639px) 82vw, (max-width: 1023px) 62vw, 34vw"
                    className="object-contain drop-shadow-[0_18px_26px_rgba(11,19,32,0.20)] transition duration-200 group-hover:scale-[1.02]"
                  />
                </div>
                <div className="absolute inset-x-4 bottom-4 rounded-xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm backdrop-blur sm:inset-x-6 sm:bottom-6">
                  <p className="text-[10px] font-bold tracking-[0.14em] text-cm-teal">
                    МОДЕЛЬ ИЗ КАТАЛОГА
                  </p>
                  <p className="mt-1 text-sm font-bold text-cm-ink sm:text-base">
                    {heroProduct.name}
                  </p>
                  <p className="mt-1 text-xs font-bold text-cm-teal transition duration-200 group-hover:text-cm-ink">
                    Открыть карточку →
                  </p>
                </div>
              </Link>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="homepage-search-title" className="bg-cm-ink text-white">
        <div className="cm-container grid gap-5 py-6 sm:py-7 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:items-center lg:gap-10">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-cm-teal-soft">
              ПОИСК ПО КАТАЛОГУ
            </p>
            <h2 id="homepage-search-title" className="mt-2 text-2xl font-extrabold tracking-[-0.025em] sm:text-[26px] lg:text-[30px]">
              Быстро найдите нужную модель
            </h2>
            <p className="mt-2 max-w-[32rem] text-sm leading-6 text-white/75 sm:text-base">
              По названию, производителю, модели или категории.
            </p>
          </div>
          <div className="rounded-2xl bg-white px-4 pb-4 pt-1 shadow-[0_16px_34px_rgba(0,0,0,0.18)] sm:px-5 sm:pb-5">
            <Search />
          </div>
        </div>
      </section>
    </>
  );
}
