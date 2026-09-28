import type { Metadata } from "next";
import Link from "next/link";

import LegalDocumentView from "@/components/legal/LegalDocumentView";
import { RFQ_CONSENT_DOCUMENT } from "@/lib/privacy/legal-documents";
import { buildStorefrontMetadata } from "@/lib/storefront/seo";

export const metadata: Metadata = buildStorefrontMetadata({
  title: "Согласие на обработку персональных данных",
  description: "Согласие на обработку данных, передаваемых через форму запроса Кибермедика.",
  canonical: "/personal-data-consent",
  noindexFollow: true,
});

export default function PersonalDataConsentPage() {
  return (
    <main className="min-h-screen bg-cm-canvas">
      <article className="cm-container max-w-4xl py-10 sm:py-14">
        <LegalDocumentView document={RFQ_CONSENT_DOCUMENT} eyebrow="152-ФЗ" />
        <p className="mt-8 text-sm leading-7 text-cm-slate">
          Подробнее: <Link className="font-semibold text-cm-teal underline" href="/privacy">политика обработки персональных данных</Link>.
        </p>
      </article>
    </main>
  );
}
