import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { RFQ_CONSENT_TEXT_SHA256 } from "../../lib/privacy/legal-document-hash.ts";
import {
  RFQ_CONSENT_CANONICAL_TEXT,
  RFQ_CONSENT_DOCUMENT,
  RFQ_CONSENT_VERSION,
  hasCurrentRfqLegalVersions,
  RFQ_LEGAL_VERSION_MISMATCH_MESSAGE,
  RFQ_POLICY_VERSION,
  RFQ_PRIVACY_POLICY_DOCUMENT,
  RFQ_RETENTION_DAYS,
  RFQ_RETENTION_OWNER_DECISION_COMPLETE,
} from "../../lib/privacy/legal-documents.ts";

const EXPECTED_CHECKBOX_TEXT =
  "Я даю согласие на обработку персональных данных на условиях";
const EXPECTED_POLICY_NOTICE =
  "Обработка персональных данных осуществляется в соответствии с";

test("RFQ checkbox confirms consent only and keeps policy acknowledgement separate", async () => {
  const form = await readFile("components/request/RequestForm.tsx", "utf8");
  const checkboxLabel = form.match(
    /<label className="flex cursor-pointer[\s\S]*?<\/label>/u,
  )?.[0];

  assert.ok(checkboxLabel);
  assert.match(checkboxLabel, new RegExp(EXPECTED_CHECKBOX_TEXT, "u"));
  assert.match(checkboxLabel, />Согласия<\/Link>\./u);
  assert.match(checkboxLabel, /href="\/personal-data-consent"/u);
  assert.doesNotMatch(checkboxLabel, /подтверждаю|ознакомлен/iu);
  assert.doesNotMatch(checkboxLabel, /href="\/privacy"/u);

  const noticeOffset = form.indexOf(EXPECTED_POLICY_NOTICE);
  const labelEndOffset = form.indexOf("</label>", form.indexOf("personalDataConsent"));
  assert.ok(noticeOffset > labelEndOffset);
  assert.match(form.slice(noticeOffset), /href="\/privacy"/u);
});

test("RFQ form submits current consent and policy versions as hidden evidence", async () => {
  const [page, form] = await Promise.all([
    readFile("app/request/page.tsx", "utf8"),
    readFile("components/request/RequestForm.tsx", "utf8"),
  ]);

  assert.match(form, /type="hidden" name="consentVersion" value=\{consentVersion\}/u);
  assert.match(form, /type="hidden" name="policyVersion" value=\{policyVersion\}/u);
  assert.match(page, /consentVersion=\{RFQ_CONSENT_VERSION\}/u);
  assert.match(page, /policyVersion=\{RFQ_POLICY_VERSION\}/u);
  assert.equal(RFQ_CONSENT_VERSION, "rfq-consent-2026-09-17-v3");
  assert.equal(RFQ_POLICY_VERSION, "privacy-policy-2026-09-17-v3");
  assert.equal(hasCurrentRfqLegalVersions({
    consentVersion: "rfq-consent-2026-09-17-v2",
    policyVersion: "privacy-policy-2026-09-17-v2",
  }), false);
  assert.equal(hasCurrentRfqLegalVersions({
    consentVersion: RFQ_CONSENT_VERSION,
    policyVersion: RFQ_POLICY_VERSION,
  }), true);
});

test("server and rollback route reject stale legal versions fail-closed", async () => {
  const [localIntake, rollbackRoute] = await Promise.all([
    readFile("services/rfq-intake/intake.ts", "utf8"),
    readFile("app/api/request/route.ts", "utf8"),
  ]);

  for (const source of [localIntake, rollbackRoute]) {
    assert.match(source, /hasCurrentRfqLegalVersions/u);
    assert.match(source, /RFQ_LEGAL_VERSION_MISMATCH_MESSAGE/u);
    assert.match(source, /status:\s*409|error\(409/u);
  }
  assert.equal(
    RFQ_LEGAL_VERSION_MISMATCH_MESSAGE,
    "Условия обработки данных обновились. Обновите страницу и отправьте заявку ещё раз.",
  );
});

test("canonical consent text deterministically produces the stored SHA-256", () => {
  const calculated = createHash("sha256")
    .update(RFQ_CONSENT_CANONICAL_TEXT, "utf8")
    .digest("hex");

  assert.equal(RFQ_CONSENT_TEXT_SHA256, calculated);
  assert.match(calculated, /^[0-9a-f]{64}$/u);
  assert.match(RFQ_CONSENT_CANONICAL_TEXT, /ООО «КИМ»/u);
  assert.match(RFQ_CONSENT_CANONICAL_TEXT, /utm_source/u);
  assert.match(RFQ_CONSENT_CANONICAL_TEXT, /удаление/u);
});

test("consent page renders the canonical document instead of a second prose copy", async () => {
  const page = await readFile("app/personal-data-consent/page.tsx", "utf8");

  assert.match(page, /RFQ_CONSENT_DOCUMENT/u);
  assert.match(page, /<LegalDocumentView document=\{RFQ_CONSENT_DOCUMENT\}/u);
  assert.doesNotMatch(page, /своей волей и в своём интересе/u);
  assert.equal(RFQ_CONSENT_DOCUMENT.sections.length, 8);
});

test("privacy policy contains all required target-processing sections", () => {
  assert.equal(RFQ_PRIVACY_POLICY_DOCUMENT.sections.length, 16);
  const titles = RFQ_PRIVACY_POLICY_DOCUMENT.sections.map(({ title }) => title).join("\n");
  for (const title of [
    "Общие положения",
    "Оператор",
    "Категории субъектов",
    "Категории и перечень персональных данных",
    "Цели обработки",
    "Правовые основания",
    "Способы и действия обработки",
    "Место и архитектура обработки RFQ",
    "Лица, действующие по поручению оператора",
    "Веб-аналитика и cookie",
    "Сроки обработки и хранения",
    "Удаление и уничтожение",
    "Права субъекта",
    "Отзыв согласия и обращения",
    "Меры защиты",
    "Изменения политики",
  ]) {
    assert.match(titles, new RegExp(title, "u"));
  }
});

test("target legal text reflects RU-first intake and Yandex 360 without foreign RFQ processors", () => {
  const publicLegalText = [
    RFQ_CONSENT_CANONICAL_TEXT,
    ...RFQ_PRIVACY_POLICY_DOCUMENT.sections.flatMap((section) => [
      ...section.paragraphs,
      ...(section.items ?? []),
    ]),
  ].join("\n");

  assert.match(publicLegalText, /первичная запись RFQ[\s\S]*Российской Федерации/u);
  assert.match(publicLegalText, /Яндекс 360/u);
  assert.match(publicLegalText, /POST \/api\/request[\s\S]*локальному сервису/u);
  assert.doesNotMatch(publicLegalText, /Make|Resend/iu);
  assert.doesNotMatch(publicLegalText, /РКН|Роскомнадзор|номер уведомления/iu);
});

test("RFQ analytics description excludes contact PII and raw form content", () => {
  const analytics = RFQ_PRIVACY_POLICY_DOCUMENT.sections.find(
    ({ id }) => id === "analytics",
  );
  assert.ok(analytics);
  const text = analytics.paragraphs.join(" ");
  for (const excluded of ["имя", "телефон", "email", "текст сообщения", "необработанное содержимое формы"]) {
    assert.match(text, new RegExp(excluded, "u"));
  }
});

test("patient and third-party personal-data warning is present without a second checkbox", async () => {
  const form = await readFile("components/request/RequestForm.tsx", "utf8");

  assert.match(
    form,
    /Не указывайте в запросе персональные данные пациентов и других третьих лиц\./u,
  );
  assert.equal(form.match(/type="checkbox"/gu)?.length, 1);
});

test("retention owner decision is complete while RKN remains a legal-acceptance blocker", async () => {
  const [report, checklist, futureTask, legalSource] = await Promise.all([
    readFile("docs/reports/legal-compliance-patch-v1-2026-09-17.md", "utf8"),
    readFile("docs/compliance/personal-data-owner-checklist.md", "utf8"),
    readFile("docs/roadmap/rfq-retention-enforcement-v1.md", "utf8"),
    readFile("lib/privacy/legal-documents.ts", "utf8"),
  ]);
  const retiredDecisionMarker = ["OWNER", "RETENTION", "DECISION", "REQUIRED"].join("_");
  const policyText = RFQ_PRIVACY_POLICY_DOCUMENT.sections
    .flatMap((section) => section.paragraphs)
    .join("\n");

  assert.equal(RFQ_RETENTION_DAYS, 365);
  assert.equal(RFQ_RETENTION_OWNER_DECISION_COMPLETE, true);
  assert.match(RFQ_CONSENT_CANONICAL_TEXT, /365 календарных дней/u);
  assert.match(policyText, /365 календарных дней/u);
  for (const text of [RFQ_CONSENT_CANONICAL_TEXT, policyText]) {
    assert.match(text, /не перешёл в договорные отношения/u);
    assert.match(text, /договорными, бухгалтерскими, налоговыми и иными законными основаниями/u);
    assert.match(text, /удалению или уничтожению/u);
  }
  assert.doesNotMatch(
    [report, checklist, futureTask, legalSource].join("\n"),
    new RegExp(retiredDecisionMarker, "u"),
  );
  assert.match(report, /RETENTION OWNER DECISION COMPLETE = YES/u);
  assert.match(report, /RKN OPERATOR RECORD = UNKNOWN/u);
  assert.match(report, /RKN OWNER CHECK = BLOCKER/u);
  assert.match(report, /LEGAL ACCEPTANCE = BLOCKED/u);
  assert.match(checklist, /Последнее содержательное взаимодействие/u);
  assert.match(futureTask, /PostgreSQL/u);
  assert.match(futureTask, /резервн/u);
  assert.match(futureTask, /почт/u);
});

test("public legal content exposes no infrastructure-sensitive implementation detail", async () => {
  const [consentPage, privacyPage, legalSource] = await Promise.all([
    readFile("app/personal-data-consent/page.tsx", "utf8"),
    readFile("app/privacy/page.tsx", "utf8"),
    readFile("lib/privacy/legal-documents.ts", "utf8"),
  ]);
  const renderedSources = `${consentPage}\n${privacyPage}\n${legalSource}`;

  assert.doesNotMatch(
    renderedSources,
    /200\.169\.179\.17|127\.0\.0\.1|localhost|5432|8787|systemd|RFQ_SMTP_PASSWORD|RFQ_DATABASE_URL|private key/iu,
  );
});
