"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  type CatalogScrollRestore,
  consumeCatalogScrollRestore,
} from "@/components/catalog/BackToCatalog";
import ProductCard from "@/components/storefront/ProductCard";
import { SearchService } from "@/lib/storefront/search-service";
import type {
  Category,
  Manufacturer,
  Product,
} from "@/lib/storefront/types";
import {
  CLOUD_PREVIEW_UNKNOWN_CATEGORY_ID,
  CLOUD_PREVIEW_UNKNOWN_MANUFACTURER_ID,
} from "@/lib/storefront/types";

type CatalogSort = "name-asc" | "name-desc" | "updated-desc";

const DEFAULT_CATEGORY = "Все категории";
const DEFAULT_MANUFACTURER = "Все производители";
const DEFAULT_APPLICATION_AREA = "Все области применения";
const DEFAULT_SORT: CatalogSort = "name-asc";

function isCatalogSort(value: string): value is CatalogSort {
  return value === "name-asc" || value === "name-desc" || value === "updated-desc";
}

interface CatalogExplorerProps {
  initialQuery?: string;
  initialCategory?: string;
  initialManufacturer?: string;
  initialApplicationArea?: string;
  initialSort?: string;
  products: readonly Product[];
  categories: readonly Category[];
  manufacturers: readonly Manufacturer[];
  initialSearchResultIds?: readonly string[];
  compareEnabled?: boolean;
}

export default function CatalogExplorer({
  initialQuery = "",
  initialCategory = "",
  initialManufacturer = "",
  initialApplicationArea = "",
  initialSort = DEFAULT_SORT,
  products,
  categories,
  manufacturers,
  initialSearchResultIds = [],
  compareEnabled = true,
}: CatalogExplorerProps) {
  const urlSearchParams = useSearchParams();
  const initialUrlQuery = urlSearchParams.get("q") ?? initialQuery;
  const initialUrlCategory = urlSearchParams.get("category") ?? initialCategory;
  const initialUrlManufacturer = urlSearchParams.get("manufacturer") ?? initialManufacturer;
  const initialUrlApplicationArea = urlSearchParams.get("applicationArea") ?? initialApplicationArea;
  const initialUrlSort = urlSearchParams.get("sort") ?? initialSort;
  const [query, setQuery] = useState(initialUrlQuery);
  const [category, setCategory] = useState(
    () =>
      categories.find(
        (item) => item.id === initialUrlCategory || item.slug === initialUrlCategory,
      )?.id ?? (initialUrlCategory === CLOUD_PREVIEW_UNKNOWN_CATEGORY_ID
        ? CLOUD_PREVIEW_UNKNOWN_CATEGORY_ID
        : DEFAULT_CATEGORY),
  );
  const [manufacturer, setManufacturer] = useState(
    () =>
      manufacturers.find(
        (item) =>
          item.id === initialUrlManufacturer || item.slug === initialUrlManufacturer,
      )?.id ?? (initialUrlManufacturer === CLOUD_PREVIEW_UNKNOWN_MANUFACTURER_ID
        ? CLOUD_PREVIEW_UNKNOWN_MANUFACTURER_ID
        : DEFAULT_MANUFACTURER),
  );
  const [applicationArea, setApplicationArea] = useState(
    initialUrlApplicationArea || DEFAULT_APPLICATION_AREA,
  );
  const [sort, setSort] = useState<CatalogSort>(
    isCatalogSort(initialUrlSort) ? initialUrlSort : DEFAULT_SORT,
  );
  const [searchResultIds, setSearchResultIds] = useState(
    () => new Set(initialUrlQuery === initialQuery ? initialSearchResultIds : []),
  );
  const [resolvedQuery, setResolvedQuery] = useState<string | null>(
    initialUrlQuery === initialQuery ? initialUrlQuery : null,
  );
  const pendingScrollRestore = useRef<CatalogScrollRestore | null>(null);
  const [scrollRestoreRevision, setScrollRestoreRevision] = useState(0);
  const isSearchPending = query.trim().length > 0 && resolvedQuery !== query;
  const productSearchService = useMemo(
    () => SearchService.forProducts(products, manufacturers, categories),
    [categories, manufacturers, products],
  );
  const categoriesById = useMemo(
    () => new Map(categories.map((item) => [item.id, item])),
    [categories],
  );
  const manufacturersById = useMemo(
    () => new Map(manufacturers.map((item) => [item.id, item])),
    [manufacturers],
  );
  const applicationAreas = useMemo(
    () => [...new Set(products.flatMap((product) => product.applicationAreas))]
      .sort((left, right) => left.localeCompare(right, "ru-RU")),
    [products],
  );
  const hasUnassignedCategory = products.some(
    (product) => product.categoryId === CLOUD_PREVIEW_UNKNOWN_CATEGORY_ID,
  );
  const hasUnassignedManufacturer = products.some(
    (product) => product.manufacturerId === CLOUD_PREVIEW_UNKNOWN_MANUFACTURER_ID,
  );
  const hasActiveSearchOrFilters = query.trim().length > 0
    || category !== DEFAULT_CATEGORY
    || manufacturer !== DEFAULT_MANUFACTURER
    || applicationArea !== DEFAULT_APPLICATION_AREA;

  useEffect(() => {
    let active = true;
    void productSearchService.searchProducts(query).then((matches) => {
      if (active) {
        setSearchResultIds(new Set(matches.map(({ id }) => id)));
        setResolvedQuery(query);
      }
    });
    return () => {
      active = false;
    };
  }, [productSearchService, query]);

  useEffect(() => {
    const source = `${window.location.pathname}${window.location.search}`;
    pendingScrollRestore.current = consumeCatalogScrollRestore(source);

    function captureHistoryRestore() {
      const restoredSource = `${window.location.pathname}${window.location.search}`;
      const restore = consumeCatalogScrollRestore(restoredSource);
      if (restore === null) return;
      pendingScrollRestore.current = restore;
      setScrollRestoreRevision((revision) => revision + 1);
    }

    window.addEventListener("popstate", captureHistoryRestore);
    return () => window.removeEventListener("popstate", captureHistoryRestore);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(urlSearchParams.toString());
    const categoryParam = categoriesById.get(category)?.slug ?? category;
    const manufacturerParam = manufacturersById.get(manufacturer)?.slug ?? manufacturer;

    setOptionalParam(params, "q", query.trim());
    setOptionalParam(
      params,
      "category",
      categoryParam === DEFAULT_CATEGORY ? "" : categoryParam,
    );
    setOptionalParam(
      params,
      "manufacturer",
      manufacturerParam === DEFAULT_MANUFACTURER ? "" : manufacturerParam,
    );
    setOptionalParam(
      params,
      "applicationArea",
      applicationArea === DEFAULT_APPLICATION_AREA ? "" : applicationArea,
    );
    setOptionalParam(params, "sort", sort === DEFAULT_SORT ? "" : sort);

    const queryString = params.toString();
    const nextUrl = queryString ? `/catalog?${queryString}` : "/catalog";
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [applicationArea, categoriesById, category, manufacturer, manufacturersById, query, sort, urlSearchParams]);

  const results = useMemo(() => {
    const filtered = products.filter((product) => {
      const searchMatches = !query.trim() || searchResultIds.has(product.id);
      const categoryMatches =
        category === DEFAULT_CATEGORY || product.categoryId === category;
      const manufacturerMatches =
        manufacturer === DEFAULT_MANUFACTURER ||
        product.manufacturerId === manufacturer;
      const applicationAreaMatches = applicationArea === DEFAULT_APPLICATION_AREA
        || product.applicationAreas.includes(applicationArea);
      return searchMatches && categoryMatches && manufacturerMatches && applicationAreaMatches;
    });
    return filtered.sort((left, right) => {
      if (sort === "updated-desc") return right.updatedAt.localeCompare(left.updatedAt);
      const order = left.name.localeCompare(right.name, "ru-RU");
      return sort === "name-desc" ? -order : order;
    });
  }, [applicationArea, category, manufacturer, products, query, searchResultIds, sort]);

  useEffect(() => {
    if (pendingScrollRestore.current === null || isSearchPending) return;
    const restore = pendingScrollRestore.current;
    let finalFrame: number | null = null;
    const initialFrame = window.requestAnimationFrame(() => {
      finalFrame = window.requestAnimationFrame(() => {
        window.scrollTo({ top: restore.scrollY, behavior: "auto" });
        window.history.scrollRestoration = restore.scrollRestoration;
        pendingScrollRestore.current = null;
      });
    });
    return () => {
      window.cancelAnimationFrame(initialFrame);
      if (finalFrame !== null) window.cancelAnimationFrame(finalFrame);
    };
  }, [isSearchPending, results.length, scrollRestoreRevision]);

  function resetCatalogView() {
    setQuery("");
    setCategory(DEFAULT_CATEGORY);
    setManufacturer(DEFAULT_MANUFACTURER);
    setApplicationArea(DEFAULT_APPLICATION_AREA);
    setSort(DEFAULT_SORT);
  }

  if (products.length === 0) {
    return <CatalogEmptyState />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[12rem_1fr]">
      <aside>
        <div className="cm-card grid gap-2.5 overflow-hidden p-2.5 shadow-[0_8px_28px_rgba(11,19,32,0.035)] sm:grid-cols-3 lg:sticky lg:top-20 lg:block lg:space-y-3">
          <div className="-mx-2.5 -mt-2.5 border-b border-[var(--cm-rule)] bg-white px-2.5 py-2 sm:col-span-3 lg:block">
            <div className="cm-label !text-[9px] !text-cm-teal">Фильтры</div>
          </div>
          <div>
            <div className="cm-label mb-1.5 !text-[8px]">Категория</div>
            <label>
              <span className="sr-only">Категория</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="cm-field cm-field-compact transition duration-200"
              >
                <option>{DEFAULT_CATEGORY}</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
                {hasUnassignedCategory && (
                  <option value={CLOUD_PREVIEW_UNKNOWN_CATEGORY_ID}>Данные уточняются</option>
                )}
              </select>
            </label>
          </div>
          <div>
            <div className="cm-label mb-1.5 !text-[8px]">Производитель</div>
            <label>
              <span className="sr-only">Производитель</span>
              <select
                value={manufacturer}
                onChange={(event) => setManufacturer(event.target.value)}
                className="cm-field cm-field-compact transition duration-200"
              >
                <option>{DEFAULT_MANUFACTURER}</option>
                {manufacturers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
                {hasUnassignedManufacturer && (
                  <option value={CLOUD_PREVIEW_UNKNOWN_MANUFACTURER_ID}>Производитель не указан</option>
                )}
              </select>
            </label>
          </div>
          <div>
            <div className="cm-label mb-1.5 !text-[8px]">Область применения</div>
            <label>
              <span className="sr-only">Область применения</span>
              <select
                value={applicationArea}
                onChange={(event) => setApplicationArea(event.target.value)}
                className="cm-field cm-field-compact transition duration-200"
              >
                <option>{DEFAULT_APPLICATION_AREA}</option>
                {applicationAreas.map((area) => <option key={area}>{area}</option>)}
              </select>
            </label>
          </div>
          <div className="hidden rounded-md border border-[var(--cm-rule)] bg-cm-surface-low/70 p-2.5 text-[10px] leading-4 text-cm-slate lg:block">
            Используйте категорию, производителя и область применения, чтобы найти
            нужное медицинское оборудование.
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="flex overflow-hidden rounded-xl border border-[var(--cm-rule-strong)] bg-white shadow-[0_8px_26px_rgba(11,19,32,0.045)] transition duration-200 hover:border-cm-teal/24 focus-within:border-cm-teal/70 focus-within:ring-3 focus-within:ring-cm-teal/10">
          <label className="flex min-w-0 flex-1 items-center">
            <span className="sr-only">Поиск по каталогу</span>
            <span aria-hidden="true" className="pl-4 text-cm-dim">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Название, модель, производитель или категория"
              className="min-h-12 min-w-0 flex-1 bg-transparent px-3 text-[13px] placeholder:text-cm-dim"
            />
          </label>
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Очистить поиск"
              className="px-4 text-cm-dim transition duration-200 hover:text-cm-ink"
            >
              ×
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          {hasActiveSearchOrFilters ? (
            <div className="font-mono text-[10px] text-cm-slate" aria-live="polite">
              Найдено: <strong className="text-cm-ink">{results.length}</strong>
            </div>
          ) : null}
          <label className="ml-auto flex items-center gap-2 text-[11px] text-cm-dim">
            <span>Сортировка</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as CatalogSort)}
              className="cm-field min-h-9 py-1.5 text-xs text-cm-ink"
            >
              <option value="name-asc">По названию А–Я</option>
              <option value="name-desc">По названию Я–А</option>
              <option value="updated-desc">Сначала обновлённые</option>
            </select>
          </label>
        </div>

        {results.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3 2xl:grid-cols-4">
            {results.map((product) => {
              const manufacturerEntry = manufacturersById.get(product.manufacturerId);
              return (
                <ProductCard
                  key={product.slug}
                  product={product}
                  manufacturer={manufacturerEntry}
                  categoryName={categoriesById.get(product.categoryId)?.name}
                  compareEnabled={compareEnabled}
                />
              );
            })}
          </div>
        ) : (
          <div className="cm-empty-state mt-4 py-5">
            <div className="cm-empty-icon">⌕</div>
            <h2 className="mt-4 text-sm font-bold">Ничего не найдено</h2>
            <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-cm-slate">
              Проверьте написание, очистите фильтры или попробуйте искать по
              производителю, модели либо категории изделия.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={resetCatalogView}
                className="cm-button-primary"
              >
                Сбросить фильтры
              </button>
              <Link href="/search" className="cm-button-secondary">
                Начать новый поиск
              </Link>
              <Link href="/manufacturers" className="cm-button-secondary">
                Производители
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function setOptionalParam(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value);
  else params.delete(key);
}

function CatalogEmptyState() {
  return (
    <section className="cm-empty-state py-10" aria-labelledby="catalog-empty-title">
      <div className="cm-empty-icon" aria-hidden="true">⌕</div>
      <h2 id="catalog-empty-title" className="mt-4 text-base font-bold">
        Каталог пока пуст
      </h2>
      <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-cm-slate">
        Товары временно недоступны. Вернитесь позже или перейдите на главную страницу.
      </p>
      <Link href="/" className="cm-button-secondary mt-5">
        На главную
      </Link>
    </section>
  );
}
