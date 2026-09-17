import nodemailer from "nodemailer";

import {
  ATTRIBUTION_KEYS,
  type PersistedRfqLead,
  type RfqDeliveryClient,
  type YandexSmtpConfig,
} from "./types.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface RfqEmailMessage {
  subject: string;
  messageId: string;
  text: string;
  html: string;
}

interface SmtpMailOptions extends RfqEmailMessage {
  from: string;
  to: string;
  replyTo?: string;
  date: Date;
  disableFileAccess: true;
  disableUrlAccess: true;
}

interface SmtpTransport {
  sendMail(options: SmtpMailOptions): Promise<unknown>;
}

export class DeliveryError extends Error {
  readonly errorClass: string;

  constructor(errorClass: string) {
    super(errorClass);
    this.name = "DeliveryError";
    this.errorClass = errorClass;
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function present(value: string | null | undefined) {
  return value?.trim() || "—";
}

function textLine(label: string, value: string | null | undefined) {
  return `${label}: ${present(value)}`;
}

function htmlLine(label: string, value: string | null | undefined) {
  return `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(present(value))}</dd>`;
}

export function smtpMessageId(requestId: string) {
  if (!UUID_PATTERN.test(requestId)) throw new DeliveryError("invalid_request_id");
  return `<rfq-${requestId.toLowerCase()}@cyber-medica.ru>`;
}

export function buildRfqEmail(lead: PersistedRfqLead): RfqEmailMessage {
  const messageId = smtpMessageId(lead.id);
  const subject = `Новая заявка с cyber-medica.ru — ${lead.id.slice(0, 8).toLowerCase()}`;
  const productLines = lead.product
    ? [
        textLine("Товар", lead.product.title),
        textLine("Модель", lead.product.model),
        textLine("Производитель", lead.product.manufacturer),
      ]
    : [];
  const attributionLines = [
    textLine("Посадочная страница", lead.attribution.landingPath),
    ...ATTRIBUTION_KEYS
      .filter((key) => lead.attribution[key])
      .map((key) => textLine(key, lead.attribution[key])),
  ];
  const text = [
    textLine("Request ID", lead.id),
    textLine("Получено", lead.createdAt.toISOString()),
    "",
    textLine("Организация", lead.company),
    textLine("Контактное лицо", lead.contactName),
    textLine("Телефон", lead.phone),
    textLine("Email", lead.email),
    "",
    "Текст заявки:",
    lead.message,
    ...(productLines.length > 0 ? ["", ...productLines] : []),
    "",
    textLine("Источник", lead.sourcePath),
    ...attributionLines,
  ].join("\n");

  const productHtml = lead.product
    ? `<h2>Оборудование</h2><dl>${[
        htmlLine("Товар", lead.product.title),
        htmlLine("Модель", lead.product.model),
        htmlLine("Производитель", lead.product.manufacturer),
      ].join("")}</dl>`
    : "";
  const attributionHtml = [
    htmlLine("Посадочная страница", lead.attribution.landingPath),
    ...ATTRIBUTION_KEYS
      .filter((key) => lead.attribution[key])
      .map((key) => htmlLine(key, lead.attribution[key])),
  ].join("");
  const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body>
<h1>Новая заявка с cyber-medica.ru</h1>
<dl>${htmlLine("Request ID", lead.id)}${htmlLine("Получено", lead.createdAt.toISOString())}</dl>
<h2>Контакт</h2>
<dl>${htmlLine("Организация", lead.company)}${htmlLine("Контактное лицо", lead.contactName)}${htmlLine("Телефон", lead.phone)}${htmlLine("Email", lead.email)}</dl>
<h2>Текст заявки</h2>
<p>${escapeHtml(lead.message).replace(/\r?\n/gu, "<br>")}</p>
${productHtml}
<h2>Источник</h2>
<dl>${htmlLine("Путь", lead.sourcePath)}${attributionHtml}</dl>
</body></html>`;

  return { subject, messageId, text, html };
}

function classifySmtpError(error: unknown) {
  if (!error || typeof error !== "object") return "smtp_internal_error";
  const record = error as { code?: unknown; responseCode?: unknown };
  if (typeof record.responseCode === "number" && Number.isInteger(record.responseCode)) {
    return `smtp_response_${record.responseCode}`;
  }
  if (typeof record.code === "string") {
    const safeCode = record.code.toLowerCase().replace(/[^a-z0-9_]/gu, "").slice(0, 40);
    if (safeCode) return `smtp_${safeCode}`;
  }
  return "smtp_transport_error";
}

function createSmtpTransport(config: YandexSmtpConfig): SmtpTransport {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.port === 587,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    logger: false,
    debug: false,
    tls: {
      minVersion: "TLSv1.2",
      servername: config.host,
    },
  });
}

export class YandexSmtpDeliveryClient implements RfqDeliveryClient {
  private readonly config: YandexSmtpConfig;
  private readonly transport: SmtpTransport;

  constructor(
    config: YandexSmtpConfig,
    transport: SmtpTransport = createSmtpTransport(config),
  ) {
    this.config = config;
    this.transport = transport;
  }

  async deliver(lead: PersistedRfqLead) {
    const message = buildRfqEmail(lead);
    try {
      await this.transport.sendMail({
        ...message,
        from: this.config.from,
        to: this.config.to,
        ...(this.config.replyTo ? { replyTo: this.config.replyTo } : {}),
        date: lead.createdAt,
        disableFileAccess: true,
        disableUrlAccess: true,
      });
    } catch (error) {
      throw new DeliveryError(classifySmtpError(error));
    }
  }
}
