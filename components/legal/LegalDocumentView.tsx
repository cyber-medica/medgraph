import { Fragment } from "react";

import { PUBLIC_COMPANY } from "@/lib/company/public-company";
import type { LegalDocument } from "@/lib/privacy/legal-documents";

export default function LegalDocumentView({
  document,
  eyebrow,
}: {
  document: LegalDocument;
  eyebrow: string;
}) {
  return (
    <>
      <p className="cm-eyebrow !text-cm-teal">{eyebrow}</p>
      <h1 className="cm-heading-1 mt-3 text-3xl font-extrabold">
        {document.title}
      </h1>
      <p className="mt-4 text-sm leading-7 text-cm-slate">
        Дата редакции: {document.revisionDate}.
      </p>
      {document.sections.map((section) => (
        <section className="mt-8" id={section.id} key={section.id}>
          <h2 className="cm-heading-2 text-lg font-extrabold">
            {section.title}
          </h2>
          {section.paragraphs.map((paragraph) => (
            <p
              className="mt-3 text-sm leading-7 text-cm-slate"
              key={paragraph}
            >
              <EmailLinkedText text={paragraph} />
            </p>
          ))}
          {section.items ? (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-cm-slate">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </>
  );
}

function EmailLinkedText({ text }: { text: string }) {
  const parts = text.split(PUBLIC_COMPANY.email);
  if (parts.length === 1) return text;

  return parts.map((part, index) => (
    <Fragment key={`${index}-${part}`}>
      {index > 0 ? (
        <a
          className="font-semibold text-cm-teal underline"
          href={PUBLIC_COMPANY.emailHref}
        >
          {PUBLIC_COMPANY.email}
        </a>
      ) : null}
      {part}
    </Fragment>
  ));
}
