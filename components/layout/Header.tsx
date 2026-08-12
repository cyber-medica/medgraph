"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { SearchService } from "@/lib/storefront/search-service";
import type { Category, Manufacturer, Product } from "@/lib/storefront/types";

export default function Header({
  products,
  manufacturers,
  categories,
}: {
  products: readonly Product[];
  manufacturers: readonly Manufacturer[];
  categories: readonly Category[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly Product[]>([]);
  const searchService = useMemo(
    () => SearchService.forProducts(products, manufacturers, categories),
    [categories, manufacturers, products],
  );
  const manufacturersById = useMemo(
    () => new Map(manufacturers.map((item) => [item.id, item.name])),
    [manufacturers],
  );
  const categoriesById = useMemo(
    () => new Map(categories.map((item) => [item.id, item.name])),
    [categories],
  );
  const navItems = [
    ["/catalog", "Каталог"],
    ["/manufacturers", "Производители"],
    ["/request", "Поставщикам"],
  ];
  const mobileNavItems = [
    ["/catalog", "Каталог"],
    ["/manufacturers", "Производители"],
  ];
  const isActive = (href: string) =>
    href === "/" ? pathname === href : pathname.startsWith(href);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    let active = true;
    void searchService.searchProducts(query).then((matches) => {
      if (active) setResults(matches.slice(0, 5));
    });
    return () => {
      active = false;
    };
  }, [query, searchService]);

  function closeSearch() {
    setSearchOpen(false);
    setQuery("");
  }

  function openProduct(product: Product) {
    closeSearch();
    router.push(`/catalog/${product.slug}`);
  }

  function navigateSearch() {
    const firstResult = results[0];
    if (firstResult) {
      openProduct(firstResult);
      return;
    }
    if (query.trim()) {
      const href = `/search?q=${encodeURIComponent(query.trim())}`;
      closeSearch();
      router.push(href);
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigateSearch();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--cm-rule)] bg-white/88 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset] backdrop-blur-xl">
      <div className="cm-container flex min-h-14 items-center gap-4">
        <Link
          href="/"
          className="flex min-h-[44px] shrink-0 items-center gap-2 transition duration-200 hover:opacity-85"
          aria-label="Кибермедика — главная"
        >
          <Image
            src="/brand/cybermedica-logo.png"
            alt="Кибермедика"
            width={184}
            height={39}
            loading="eager"
            className="h-auto w-[10.25rem] sm:w-[11.5rem]"
          />
        </Link>

        <nav
          aria-label="Основная навигация"
          className="ml-auto hidden items-center gap-1.5 lg:flex"
        >
          {navItems.map(([href, label]) => (
            <Link
              key={href}
              className={`inline-flex min-h-[44px] items-center rounded-lg px-3.5 py-2 text-xs font-medium transition duration-200 hover:-translate-y-px hover:bg-cm-surface-low hover:text-cm-ink ${
                isActive(href)
                  ? "bg-cm-teal-soft text-cm-teal shadow-[0_8px_22px_rgba(11,123,142,0.08)]"
                  : "text-cm-slate"
              }`}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setSearchOpen((open) => !open)}
          aria-expanded={searchOpen}
          aria-controls="header-search-panel"
          className="ml-auto hidden min-h-[44px] items-center gap-2 rounded-lg border border-[var(--cm-rule)] bg-white px-3 text-xs font-medium text-cm-slate transition duration-200 hover:-translate-y-px hover:border-cm-teal/30 hover:text-cm-ink hover:shadow-[0_10px_24px_rgba(11,19,32,0.06)] sm:inline-flex lg:ml-3"
        >
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.8" />
            <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Поиск
        </button>

        <Link href="/request" className="cm-button-primary !min-h-[44px] px-3.5 py-2 text-xs">
          Запросить КП
        </Link>
      </div>

      {searchOpen && (
        <div id="header-search-panel" className="border-t border-[var(--cm-rule)] bg-white shadow-[0_16px_32px_rgba(11,19,32,0.08)]">
          <div className="cm-container py-3">
            <form role="search" aria-label="Быстрый поиск по каталогу" onSubmit={submitSearch} className="relative mx-auto max-w-3xl">
              <div className="flex min-h-11 overflow-hidden rounded-xl border border-cm-teal/35 bg-white focus-within:border-cm-teal focus-within:ring-3 focus-within:ring-cm-teal/10">
                <label className="flex min-w-0 flex-1 items-center gap-2 px-3">
                  <span aria-hidden="true" className="text-cm-teal">⌕</span>
                  <span className="sr-only">Название, модель, производитель или категория</span>
                  <input
                    ref={searchInputRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") closeSearch();
                      if (event.key === "Enter") {
                        event.preventDefault();
                        navigateSearch();
                      }
                    }}
                    placeholder="Название, модель, производитель или категория"
                    autoComplete="off"
                    aria-controls="header-search-results"
                    className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-cm-dim"
                  />
                </label>
                <Link href={`/search${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`} onClick={closeSearch} className="hidden items-center px-3 text-[11px] font-semibold text-cm-teal hover:underline sm:flex">
                  Все результаты
                </Link>
                <button type="button" onClick={closeSearch} aria-label="Закрыть поиск" className="px-3 text-lg text-cm-slate hover:text-cm-ink">×</button>
              </div>

              {query.trim() && (
                <div id="header-search-results" className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-50 overflow-hidden rounded-xl border border-[var(--cm-rule)] bg-white p-1.5 shadow-[0_18px_48px_rgba(11,19,32,0.16)]">
                  {results.length > 0 ? results.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => openProduct(product)}
                      className="flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-left hover:bg-cm-surface-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-cm-teal"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-cm-ink">{product.name}</span>
                        <span className="mt-1 block truncate text-[10px] text-cm-slate">
                          {manufacturersById.get(product.manufacturerId) ?? "Производитель не указан"} · {categoriesById.get(product.categoryId) ?? "Данные уточняются"}
                        </span>
                      </span>
                      <span aria-hidden="true" className="shrink-0 text-cm-teal">→</span>
                    </button>
                  )) : (
                    <div className="px-3 py-4 text-xs text-cm-slate">Ничего не найдено. Откройте полную страницу поиска, чтобы изменить запрос.</div>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      <nav
        aria-label="Мобильная навигация"
        className="flex min-h-10 items-center justify-between gap-1 overflow-x-auto border-t border-[var(--cm-rule)] px-3 lg:hidden"
      >
        {mobileNavItems.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className={`inline-flex min-h-[44px] shrink-0 items-center rounded-lg px-2 py-2 text-[11px] transition duration-200 hover:bg-cm-surface-low hover:text-cm-teal ${
              isActive(href)
                ? "bg-cm-teal-soft text-cm-teal"
                : "text-cm-slate"
            }`}
            aria-current={isActive(href) ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setSearchOpen((open) => !open)}
          aria-expanded={searchOpen}
          aria-controls="header-search-panel"
          className="inline-flex min-h-[44px] shrink-0 items-center rounded-lg px-2 py-2 text-[11px] text-cm-slate transition hover:bg-cm-surface-low hover:text-cm-teal"
        >
          Поиск
        </button>
      </nav>
    </header>
  );
}
