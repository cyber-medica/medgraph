import Link from "next/link";

import JsonLd from "@/components/seo/JsonLd";
import {
  buildSeoLandingBreadcrumbs,
  getSeoLanding,
  resolveSeoLandingLinks,
  type SeoP0Path,
} from "@/lib/seo/implementation-v2";
import { manufacturerService, productService } from "@/lib/storefront";
import { buildBreadcrumbJsonLd } from "@/lib/storefront/seo";
import { buildCollectionPageStructuredData } from "@/lib/storefront/structured-data";

interface SeoLandingPageProps {
  path: SeoP0Path;
}

export default async function SeoLandingPage({ path }: SeoLandingPageProps) {
  const content = getSeoLanding(path);
  const [products, manufacturers] = await Promise.all([
    productService.getActiveProducts(),
    manufacturerService.getManufacturers(),
  ]);
  const breadcrumbs = buildSeoLandingBreadcrumbs(path);
  const links = resolveSeoLandingLinks(path, products, manufacturers);

  return (
    <main className="min-h-screen bg-cm-canvas">
      <JsonLd
        data={[
          buildCollectionPageStructuredData({
            name: content.h1,
            description: content.description,
            path,
          }),
          buildBreadcrumbJsonLd(breadcrumbs),
        ]}
      />

      <header className="border-b border-[var(--cm-rule)] bg-[linear-gradient(135deg,#ffffff_0%,#f6fafc_56%,#e8f5f7_100%)]">
        <div className="cm-container py-6 sm:py-9 lg:py-11">
          <nav aria-label="Хлебные крошки">
            <ol className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-cm-slate">
              {breadcrumbs.map((breadcrumb, index) => (
                <li key={breadcrumb.path} className="flex items-center gap-2">
                  {index > 0 ? <span aria-hidden="true">/</span> : null}
                  {index === breadcrumbs.length - 1 ? (
                    <span aria-current="page" className="text-cm-ink">
                      {breadcrumb.name}
                    </span>
                  ) : (
                    <Link href={breadcrumb.path} className="hover:text-cm-teal">
                      {breadcrumb.name}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-6 max-w-4xl">
            <div className="cm-label text-cm-teal">CyberMedica · Каталог</div>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-[-0.035em] sm:text-4xl lg:text-5xl">
              {content.h1}
            </h1>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-cm-slate sm:text-base">
              {content.intro}
            </p>
          </div>
        </div>
      </header>

      <div className="cm-container py-8 sm:py-10">
        <div className="grid gap-4 lg:grid-cols-2">
          {content.sections.map(([title, body]) => (
            <section
              key={title}
              className="rounded-2xl border border-[var(--cm-rule)] bg-white p-5 shadow-[0_8px_28px_rgba(11,19,32,0.035)] sm:p-6"
            >
              <h2 className="text-lg font-bold leading-6 tracking-[-0.02em]">
                {title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-cm-slate">{body}</p>
            </section>
          ))}
        </div>

        {links.length > 0 ? (
          <section className="mt-10" aria-labelledby="seo-related-links">
            <div className="cm-label">Связанные страницы и товары</div>
            <h2 id="seo-related-links" className="mt-2 text-2xl font-bold tracking-[-0.025em]">
              Перейти к оборудованию
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    data-seo-link-kind={link.kind}
                    className="group flex min-h-[5.5rem] items-center justify-between gap-4 rounded-xl border border-[var(--cm-rule)] bg-white px-4 py-3 text-sm font-semibold transition hover:border-cm-teal/35 hover:text-cm-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cm-teal"
                  >
                    <span>{link.label}</span>
                    <span aria-hidden="true" className="text-cm-teal transition group-hover:translate-x-0.5">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-10" aria-labelledby="seo-faq">
          <div className="cm-label">FAQ</div>
          <h2 id="seo-faq" className="mt-2 text-2xl font-bold tracking-[-0.025em]">
            Частые вопросы
          </h2>
          <div className="mt-4 divide-y divide-[var(--cm-rule)] overflow-hidden rounded-2xl border border-[var(--cm-rule)] bg-white">
            {content.faq.map(([question, answer]) => (
              <details key={question} className="group p-4 sm:p-5">
                <summary className="cursor-pointer list-none pr-8 text-sm font-bold marker:hidden">
                  {question}
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-cm-slate">{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-2xl bg-cm-ink px-5 py-7 text-white sm:px-8 sm:py-9">
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div>
              <h2 className="text-2xl font-bold tracking-[-0.025em]">{content.cta.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">{content.cta.body}</p>
            </div>
            <Link
              href="/request"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-5 text-sm font-bold text-cm-ink transition hover:bg-cm-teal-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Отправить запрос
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
