"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, type KeyboardEvent } from "react";

import ProductCommercialBadges from "@/components/storefront/ProductCommercialBadges";
import type { ProductCommercialPresentation } from "@/lib/storefront/types";

export interface FeaturedCarouselProduct {
  id: string;
  slug: string;
  name: string;
  model: string;
  manufacturer: string;
  summary: string;
  commercialPresentation?: ProductCommercialPresentation;
  image: {
    url: string;
    alt: string;
  } | null;
}

export default function FeaturedProductsCarousel({
  products,
}: {
  products: readonly FeaturedCarouselProduct[];
}) {
  const trackRef = useRef<HTMLUListElement>(null);

  function move(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) return;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({
      left: direction * Math.max(track.clientWidth * 0.82, 280),
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    move(event.key === "ArrowLeft" ? -1 : 1);
  }

  return (
    <div className="relative mt-6">
      <ul
        ref={trackRef}
        aria-label="Избранные опубликованные товары"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {products.map((product) => (
          <li
            key={product.id}
            className="min-w-0 shrink-0 grow-0 basis-[88%] snap-start sm:basis-[calc((100%_-_0.75rem)/2)] lg:basis-[calc((100%_-_1.5rem)/3)] xl:basis-[calc((100%_-_2.25rem)/4)]"
          >
            <Link
              href={`/catalog/${product.slug}`}
              aria-label={`Подробнее о ${product.name}`}
              className="group cm-card flex h-full min-h-[25rem] flex-col overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cm-teal"
            >
              <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden border-b border-[var(--cm-rule)] bg-white">
                {product.image ? (
                  <Image
                    src={product.image.url}
                    alt={product.image.alt || product.name}
                    fill
                    loading="lazy"
                    sizes="(max-width: 639px) 88vw, (max-width: 1023px) 48vw, (max-width: 1279px) 32vw, 25vw"
                    className="object-contain p-4 transition duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
                  />
                ) : (
                  <div className="grid h-full place-items-center bg-cm-surface-low px-6 text-center text-sm text-cm-dim">
                    Изображение готовится
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="text-xs font-bold text-cm-teal">{product.manufacturer}</p>
                <h3 className="cm-heading-3 mt-2 line-clamp-2 text-lg font-extrabold leading-6">
                  {product.name}
                </h3>
                <p className="mt-1 font-sans text-[11px] font-semibold text-cm-dim">
                  Модель: {product.model}
                </p>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-cm-slate">
                  {product.summary}
                </p>
                {product.commercialPresentation ? (
                  <div className="mt-3">
                    <ProductCommercialBadges
                      presentation={product.commercialPresentation}
                      compact
                    />
                  </div>
                ) : null}
                <span className="mt-auto pt-5 text-sm font-bold text-cm-teal">
                  Подробнее <span aria-hidden="true">→</span>
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-1 flex justify-end gap-2" aria-label="Управление каруселью">
        <button
          type="button"
          onClick={() => move(-1)}
          aria-label="Предыдущие товары"
          className="grid size-11 place-items-center rounded-full border border-[var(--cm-rule-strong)] bg-white text-xl text-cm-ink shadow-sm transition hover:border-cm-teal hover:text-cm-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cm-teal"
        >
          <span aria-hidden="true">←</span>
        </button>
        <button
          type="button"
          onClick={() => move(1)}
          aria-label="Следующие товары"
          className="grid size-11 place-items-center rounded-full border border-[var(--cm-rule-strong)] bg-white text-xl text-cm-ink shadow-sm transition hover:border-cm-teal hover:text-cm-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cm-teal"
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
