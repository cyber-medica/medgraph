"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type {
  Category,
  Manufacturer,
  Product,
} from "@/lib/storefront/types";
import { getProductPresentation } from "@/lib/storefront/product-presentation";

function ResultCard({
  product,
  manufacturer,
  category,
}: {
  product: Product;
  manufacturer: string;
  category: string;
}) {
  const image = product.media.find(({ type }) => type === "image");

  return (
    <Link
      href={`/catalog/${product.slug}`}
      className="cm-card block p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cm-teal"
    >
      <div className="flex items-start gap-4">
        {image ? (
          <span className="relative size-14 shrink-0 overflow-hidden rounded-md border border-[var(--cm-rule)] bg-white">
            <Image
              src={image.url}
              alt={image.alt}
              fill
              sizes="56px"
              className="object-contain"
            />
          </span>
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-md border border-[var(--cm-rule)] bg-cm-surface-low text-cm-dim">
            ▧
          </span>
        )}
        <div className="min-w-0">
          <h2 className="cm-heading-2 text-base font-semibold text-cm-ink">
            {product.name}
          </h2>
          <p className="mt-1.5 text-xs leading-5 text-cm-slate">
            {manufacturer} · {category}
          </p>
        </div>
      </div>
    </Link>
  );
}

export default function SearchExperience({
  initialQuery,
  products,
  manufacturers,
  manufacturerReferences = manufacturers,
  categories,
  suggestions: storefrontSuggestions,
}: {
  initialQuery: string;
  products: readonly Product[];
  manufacturers: readonly Manufacturer[];
  manufacturerReferences?: readonly Manufacturer[];
  categories: readonly Category[];
  suggestions: readonly string[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [recentQueries, setRecentQueries] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("cybermedica.recentSearches");
      return raw ? JSON.parse(raw).slice(0, 5) : [];
    } catch {
      return [];
    }
  });
  const manufacturersById = useMemo(
    () => new Map(manufacturerReferences.map((manufacturer) => [manufacturer.id, manufacturer])),
    [manufacturerReferences],
  );
  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const suggestions = useMemo(
    () => [...new Set([...recentQueries, ...storefrontSuggestions])].slice(0, 8),
    [recentQueries, storefrontSuggestions],
  );

  function submit(nextQuery = query) {
    const value = nextQuery.trim();
    if (value) {
      const nextRecent = [value, ...recentQueries.filter((item) => item !== value)]
        .slice(0, 5);
      setRecentQueries(nextRecent);
      try {
        window.localStorage.setItem(
          "cybermedica.recentSearches",
          JSON.stringify(nextRecent),
        );
      } catch {
        // Local suggestions are optional and must not block search.
      }
    }
    router.push(value ? `/search?q=${encodeURIComponent(value)}` : "/search");
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-[var(--cm-rule)] bg-white p-3 shadow-[var(--cm-shadow-card)]">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Поиск медицинского изделия</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submit();
              }}
              type="search"
              placeholder="Производитель, модель, название или категория"
              className="cm-field min-h-11"
            />
          </label>
          <button
            type="button"
            onClick={() => submit()}
            className="cm-button-primary min-h-11 px-6"
          >
            Найти
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                setQuery(suggestion);
                submit(suggestion);
              }}
              className="rounded-md border border-[var(--cm-rule)] bg-cm-surface-low px-3 py-1.5 font-sans text-[11px] font-semibold text-cm-slate transition duration-200 hover:border-cm-teal/30 hover:bg-white hover:text-cm-teal"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </section>

      {initialQuery.trim() ? (
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-cm-slate">
            Найдено изделий:{" "}
            <span className="font-sans font-semibold text-cm-ink">
              {products.length}
            </span>
          </div>
          <div className="cm-label">Поиск по каталогу</div>
        </div>
      ) : null}

      {!initialQuery.trim() ? (
        <section className="cm-empty-state py-5" aria-labelledby="search-start-title">
          <div className="cm-empty-icon">⌕</div>
          <h2 id="search-start-title" className="mt-3 text-sm font-bold">
            Что вы хотите найти?
          </h2>
          <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-cm-slate">
            Введите производителя, модель, название или категорию либо начните
            с просмотра каталога.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href="/catalog" className="cm-button-primary">
              Открыть каталог
            </Link>
            <Link href="/manufacturers" className="cm-button-secondary">
              Производители
            </Link>
          </div>
        </section>
      ) : products.length ? (
        <div className="grid gap-3">
          {products.map((product) => (
            <ResultCard
              key={product.slug}
              product={product}
              manufacturer={getProductPresentation(product, {
                manufacturerName: manufacturersById.get(product.manufacturerId)?.name,
              }).manufacturerLabel}
              category={getProductPresentation(product, {
                categoryName: categoriesById.get(product.categoryId)?.name,
              }).categoryLabel}
            />
          ))}
        </div>
      ) : (
        <section className="cm-empty-state py-5 text-cm-slate">
          <div className="cm-empty-icon">⌕</div>
          <div className="font-semibold text-cm-ink">Ничего не найдено.</div>
          <p className="mx-auto mt-2 max-w-md text-xs leading-6">
            Попробуйте название, модель, производителя или категорию.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setQuery("");
                submit("");
              }}
              className="cm-button-secondary"
            >
              Очистить поиск
            </button>
            <Link href="/catalog" className="cm-button-primary">
              Перейти в каталог
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
