import type { PersistedRfqLead, RfqDeliveryClient } from "./types.ts";

export class DeliveryError extends Error {
  readonly errorClass: string;

  constructor(errorClass: string) {
    super(errorClass);
    this.name = "DeliveryError";
    this.errorClass = errorClass;
  }
}

export function buildMakePayload(lead: PersistedRfqLead) {
  return {
    id: lead.id,
    company: lead.company,
    name: lead.contactName,
    phone: lead.phone ?? "",
    email: lead.email ?? "",
    message: lead.message,
    createdAt: lead.createdAt.toISOString(),
    receivedAt: lead.createdAt.toISOString(),
    sourcePage: lead.sourcePath,
    ...lead.attribution,
    ...(lead.product
      ? {
          product: lead.product,
          productId: lead.product.id,
          productSlug: lead.product.slug,
          productModel: lead.product.model,
          productManufacturer: lead.product.manufacturer,
        }
      : {}),
  };
}

export class MakeDeliveryClient implements RfqDeliveryClient {
  private readonly url: string;
  private readonly token: string | null;
  private readonly fetchImplementation: typeof fetch;

  constructor(
    url: string,
    token: string | null,
    fetchImplementation: typeof fetch = fetch,
  ) {
    this.url = url;
    this.token = token;
    this.fetchImplementation = fetchImplementation;
  }

  async deliver(lead: PersistedRfqLead) {
    let response: Response;
    try {
      response = await this.fetchImplementation(this.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": lead.id,
          "x-cybermedica-request-id": lead.id,
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        },
        body: JSON.stringify(buildMakePayload(lead)),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new DeliveryError("make_transport_error");
    }
    if (!response.ok) {
      throw new DeliveryError(`make_http_${response.status}`);
    }
  }
}
