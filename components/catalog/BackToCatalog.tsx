"use client";

const CATALOG_RETURN_STORAGE_KEY = "cybermedica:catalog-return";

interface CatalogReturnEntry {
  destination: string;
  historyLength: number;
  scrollRestoration: ScrollRestoration;
  scrollY: number;
  source: string;
}

export interface CatalogScrollRestore {
  scrollRestoration: ScrollRestoration;
  scrollY: number;
}

export function rememberCatalogReturn(destination: string) {
  if (typeof window === "undefined") return;

  const source = `${window.location.pathname}${window.location.search}`;
  if (!source.startsWith("/catalog")) return;

  const entry: CatalogReturnEntry = {
    destination,
    historyLength: window.history.length,
    scrollRestoration: window.history.scrollRestoration,
    scrollY: window.scrollY,
    source,
  };
  window.sessionStorage.setItem(CATALOG_RETURN_STORAGE_KEY, JSON.stringify(entry));
}

export function consumeCatalogScrollRestore(source: string): CatalogScrollRestore | null {
  if (typeof window === "undefined") return null;
  const serialized = window.sessionStorage.getItem(CATALOG_RETURN_STORAGE_KEY);
  if (!serialized) return null;

  try {
    const entry = JSON.parse(serialized) as Partial<CatalogReturnEntry>;
    if (
      entry.source !== source ||
      (entry.scrollRestoration !== "auto" && entry.scrollRestoration !== "manual") ||
      typeof entry.scrollY !== "number" ||
      entry.scrollY < 0
    ) {
      return null;
    }
    window.sessionStorage.removeItem(CATALOG_RETURN_STORAGE_KEY);
    return {
      scrollRestoration: entry.scrollRestoration,
      scrollY: entry.scrollY,
    };
  } catch {
    return null;
  }
}

// The catalog-return storage contract remains for restoring scroll state after
// browser Back. Product Detail orientation is provided only by Breadcrumbs.
