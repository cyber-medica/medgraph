import type { Metadata } from "next";
import Link from "next/link";

import LegalDocumentView from "@/components/legal/LegalDocumentView";
import { RFQ_PRIVACY_POLICY_DOCUMENT } from "@/lib/privacy/legal-documents";
import { buildStorefrontMetadata } from "@/lib/storefront/seo";

export const metadata: Metadata = buildStorefrontMetadata({
  title: "Политика конфиденциальности",
  description: "Политика обработки персональных данных на сайте Кибермедика.",
  canonical: "/privacy",
  noindexFollow: true,
});

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-cm-canvas">
      <article className="cm-container max-w-4xl py-10 sm:py-14">
        <LegalDocumentView
          document={RFQ_PRIVACY_POLICY_DOCUMENT}
          eyebrow="ПЕРСОНАЛЬНЫЕ ДАННЫЕ"
        />
        <p className="mt-8 text-sm leading-7 text-cm-slate">
          Текст согласия: <Link className="font-semibold text-cm-teal underline" href="/personal-data-consent">согласие на обработку персональных данных</Link>.
        </p>
      </article>
    </main>
  );
}
