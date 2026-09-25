import type { RequestProductContext } from "../../lib/request/product-context.ts";

export const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "yclid",
] as const;

export type AttributionKey = (typeof ATTRIBUTION_KEYS)[number];

export interface SanitizedAttribution extends Partial<Record<AttributionKey, string>> {
  initialReferrer?: string;
  landingPath: string;
}

export type DeliveryStatus = "pending" | "delivered" | "failed";

export interface YandexSmtpConfig {
  host: "smtp.yandex.ru";
  port: 465 | 587;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  to: string;
  replyTo: string | null;
}

export interface NewRfqLead {
  id: string;
  company: string;
  contactName: string;
  phone: string | null;
  email: string | null;
  message: string;
  product: RequestProductContext | null;
  sourcePath: string;
  attribution: SanitizedAttribution;
  consentVersion: string;
  consentTextSha256: string;
  policyVersion: string;
  consentAt: Date;
  createdAt: Date;
}

export interface PersistedRfqLead extends NewRfqLead {
  deliveryStatus: DeliveryStatus;
  deliveryAttempts: number;
  lastDeliveryError: string | null;
}

export interface DeliveryClaim extends PersistedRfqLead {
  deliveryLockToken: string;
}

export interface RfqRepository {
  insertLead(lead: NewRfqLead): Promise<PersistedRfqLead>;
  claimNextDelivery(input: {
    lockToken: string;
    now: Date;
    leaseSeconds: number;
    maxAttempts: number;
  }): Promise<DeliveryClaim | null>;
  markDelivered(input: {
    id: string;
    lockToken: string;
    deliveredAt: Date;
  }): Promise<boolean>;
  markFailed(input: {
    id: string;
    lockToken: string;
    errorClass: string;
    nextAttemptAt: Date;
  }): Promise<boolean>;
  healthCheck(): Promise<void>;
  close(): Promise<void>;
}

export interface ProductContextResolver {
  resolve(selection: {
    id: string | null;
    slug: string | null;
  }): Promise<RequestProductContext | null>;
}

export interface RfqDeliveryClient {
  deliver(lead: PersistedRfqLead): Promise<void>;
}

export interface SafeLogger {
  info(event: string, fields?: Record<string, string | number | boolean | null>): void;
  error(event: string, fields?: Record<string, string | number | boolean | null>): void;
}
