import { createHash, randomUUID } from "node:crypto";

import {
  flattenAttribution,
  normalizeAttributionPath,
  parseAttributionEnvelope,
} from "../../lib/analytics/attribution.ts";
import {
  RFQ_CONSENT_EVIDENCE_TEXT,
  RFQ_CONSENT_VERSION,
  RFQ_POLICY_VERSION,
} from "../../lib/privacy/rfq-consent.ts";
import type { HashedRateLimiter } from "./rate-limit.ts";
import {
  ATTRIBUTION_KEYS,
  type NewRfqLead,
  type ProductContextResolver,
  type RfqRepository,
  type SanitizedAttribution,
} from "./types.ts";

const LIMITS = {
  company: 160,
  name: 120,
  phone: 40,
  email: 160,
  message: 3_000,
  productId: 200,
  productSlug: 240,
} as const;

export const RFQ_CONSENT_TEXT_SHA256 = createHash("sha256")
  .update(RFQ_CONSENT_EVIDENCE_TEXT)
  .digest("hex");

export interface IntakeResponse {
  status: number;
  body: { ok: boolean; error?: string; requestId?: string };
  retryAfterSeconds?: number;
}

interface IntakeDependencies {
  repository: Pick<RfqRepository, "insertLead">;
  productResolver: ProductContextResolver;
  rateLimiter: Pick<HashedRateLimiter, "check">;
  now?: () => Date;
  createRequestId?: () => string;
}

interface RequestMetadata {
  ip: string;
  userAgent: string;
}

function readField(formData: FormData, name: keyof typeof LIMITS) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, LIMITS[name]) : "";
}

function error(status: number, message: string, retryAfterSeconds?: number): IntakeResponse {
  return {
    status,
    body: { ok: false, error: message },
    ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
  };
}

export function sanitizeAttribution(raw: unknown): SanitizedAttribution {
  const envelope = parseAttributionEnvelope(raw);
  if (!envelope) return { landingPath: "/" };
  const flattened = flattenAttribution(envelope);
  const attribution: SanitizedAttribution = {
    landingPath: normalizeAttributionPath(flattened.landingPath),
  };
  if (typeof flattened.initialReferrer === "string" && flattened.initialReferrer) {
    attribution.initialReferrer = flattened.initialReferrer;
  }
  for (const key of ATTRIBUTION_KEYS) {
    const value = flattened[key];
    if (typeof value === "string" && value) attribution[key] = value.slice(0, 240);
  }
  return attribution;
}

export async function handleRfqIntake(
  formData: FormData,
  metadata: RequestMetadata,
  dependencies: IntakeDependencies,
): Promise<IntakeResponse> {
  if (!metadata.userAgent.trim()) {
    return error(400, "Не удалось принять заявку. Обновите страницу и попробуйте снова.");
  }

  const rateLimit = dependencies.rateLimiter.check({
    ip: metadata.ip,
    userAgent: metadata.userAgent,
  });
  if (!rateLimit.allowed) {
    return error(
      429,
      "Слишком много запросов за короткое время. Пожалуйста, попробуйте позже.",
      rateLimit.retryAfterSeconds,
    );
  }

  if (String(formData.get("website") || "")) {
    return { status: 200, body: { ok: true } };
  }
  if (formData.get("personalDataConsent") !== "accepted") {
    return error(400, "Подтвердите согласие на обработку персональных данных.");
  }

  const company = readField(formData, "company");
  const contactName = readField(formData, "name");
  const phone = readField(formData, "phone") || null;
  const email = readField(formData, "email") || null;
  const message = readField(formData, "message");
  if (!company || !contactName || !message) {
    return error(400, "Заполните организацию, имя и описание задачи.");
  }
  if (!phone && !email) {
    return error(400, "Укажите телефон или email для ответа.");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return error(400, "Проверьте адрес электронной почты.");
  }

  const productId = readField(formData, "productId") || null;
  const productSlug = readField(formData, "productSlug") || null;
  const productSelectionPresent = Boolean(productId || productSlug);
  const product = productSelectionPresent
    ? await dependencies.productResolver.resolve({ id: productId, slug: productSlug })
    : null;
  if (productSelectionPresent && !product) {
    return error(
      400,
      "Выбранное оборудование недоступно. Обновите страницу и попробуйте снова.",
    );
  }

  const now = (dependencies.now ?? (() => new Date()))();
  const lead: NewRfqLead = {
    id: (dependencies.createRequestId ?? randomUUID)(),
    company,
    contactName,
    phone,
    email,
    message,
    product,
    sourcePath: normalizeAttributionPath(formData.get("sourcePage")),
    attribution: sanitizeAttribution(formData.get("attribution")),
    consentVersion: RFQ_CONSENT_VERSION,
    consentTextSha256: RFQ_CONSENT_TEXT_SHA256,
    policyVersion: RFQ_POLICY_VERSION,
    consentAt: now,
    createdAt: now,
  };

  try {
    await dependencies.repository.insertLead(lead);
  } catch {
    return error(
      503,
      "Сервис заявок временно недоступен. Попробуйте немного позже.",
    );
  }

  return { status: 200, body: { ok: true, requestId: lead.id } };
}
