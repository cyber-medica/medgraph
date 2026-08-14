import { Product } from "@/types/product";

interface DocumentsProps {
  product: Product;
}

export default function Documents({ product }: DocumentsProps) {
  return (
    <section className="cm-card p-6">
      <div className="cm-label mb-2 !text-cm-teal">Подтверждающие документы</div>
      <h2 className="mb-5 text-base font-bold">
        Документы
      </h2>

      {product.documents.length === 0 ? (
        <div className="cm-empty-state px-5 py-7">
          <div className="cm-empty-icon">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
              <path d="M7 4h7l3 3v13H7z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              <path d="M14 4v4h4M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </div>
          <div className="mt-4 text-xs font-semibold">Нет документов</div>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-6 text-cm-slate">
            Документы еще не добавлены. Исследование продолжается.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {product.documents.map((document) => (
            <a
              key={document.title}
              href={document.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-4 rounded-lg border border-[var(--cm-rule)] bg-cm-surface-low/70 p-4 shadow-[0_8px_22px_rgba(11,19,32,0.03)] transition duration-200 hover:-translate-y-px hover:border-cm-teal/30 hover:bg-white hover:shadow-[0_14px_34px_rgba(11,19,32,0.06)]"
            >
              <div>
                <div className="text-xs font-semibold">
                  {document.title}
                </div>

                <div className="mt-1 flex flex-wrap gap-2 font-sans text-[9px] text-cm-dim">
                  <span>PDF</span>
                  <span>Размер: нет данных</span>
                  <span>Страниц: нет данных</span>
                </div>
              </div>

              <div className="shrink-0 text-xs font-semibold text-cm-teal">
                Скачать →
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
