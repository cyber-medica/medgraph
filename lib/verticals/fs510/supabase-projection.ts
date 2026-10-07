import "server-only";

import { getSupabasePublicEnvironment } from "@/lib/supabase/env";

import type { PublicProductPageRow } from "./types.ts";

const PUBLIC_SCHEMA = "public_api";

export class SupabaseConfigurationError extends Error {
  constructor() {
    super(
      "Supabase public configuration is missing or ambiguous.",
    );
    this.name = "SupabaseConfigurationError";
  }
}

export class SupabaseQueryError extends Error {
  constructor(status: number, message: string) {
    super(`Supabase Data API вернул ${status}: ${message}`);
    this.name = "SupabaseQueryError";
  }
}

interface ServerSupabaseClient {
  getProductPage(slug: string): Promise<PublicProductPageRow | null>;
}

function getEnvironment() {
  try {
    return getSupabasePublicEnvironment(process.env);
  } catch {
    throw new SupabaseConfigurationError();
  }
}

export function createServerSupabaseClient(): ServerSupabaseClient {
  const { url, publicCredential } = getEnvironment();

  return {
    async getProductPage(slug) {
      const endpoint = new URL(`${url}/rest/v1/product_pages`);
      endpoint.searchParams.set(
        "select",
        "product_id,locale,page_payload,projection_version,built_at",
      );
      endpoint.searchParams.set("page_payload->>slug", `eq.${slug}`);
      endpoint.searchParams.set("locale", "eq.ru-RU");
      endpoint.searchParams.set("limit", "1");

      const headers = new Headers({
        Accept: "application/json",
        "Accept-Profile": PUBLIC_SCHEMA,
        apikey: publicCredential.key,
      });
      if (publicCredential.sendAsBearer) {
        headers.set("Authorization", `Bearer ${publicCredential.key}`);
      }
      const response = await fetch(endpoint, {
        cache: "no-store",
        headers,
      });

      if (!response.ok) {
        const message = (await response.text()).slice(0, 300);
        throw new SupabaseQueryError(response.status, message);
      }

      const rows = (await response.json()) as PublicProductPageRow[];
      return rows[0] ?? null;
    },
  };
}
