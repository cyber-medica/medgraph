import Link from "next/link";

import type { StorefrontBreadcrumbItem } from "@/lib/storefront/seo";

export default function Breadcrumbs({
  items,
  className = "",
}: {
  items: readonly StorefrontBreadcrumbItem[];
  className?: string;
}) {
  if (items.length < 2) return null;

  return (
    <nav
      aria-label="Хлебные крошки"
      className={className}
      data-testid="canonical-breadcrumbs"
    >
      <ol className="cm-breadcrumb flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-5 text-cm-slate">
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li
              key={`${item.path}:${item.name}`}
              className={`flex min-w-0 items-center gap-2 ${current ? "max-w-full" : "shrink-0"}`}
            >
              {index > 0 ? (
                <span aria-hidden="true" className="shrink-0 text-cm-dim">
                  /
                </span>
              ) : null}
              {current ? (
                <span
                  aria-current="page"
                  className="min-w-0 truncate font-bold text-cm-ink"
                  title={item.name}
                >
                  {item.name}
                </span>
              ) : (
                <Link
                  href={item.path}
                  className="rounded-sm transition hover:text-cm-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cm-teal"
                >
                  {item.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
