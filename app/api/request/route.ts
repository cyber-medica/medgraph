import { NextResponse } from "next/server";

import { resolveRequestProductContext } from "@/lib/request/product-context";
import { catalogRepository, productService } from "@/lib/storefront";
import {
  flattenAttribution,
  parseAttributionEnvelope,
} from "@/lib/analytics/attribution";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_STORE_MAX_ENTRIES = 5_000;

const limits = {
  company: 160,
  name: 120,
  phone: 40,
  email: 160,
  message: 3000,
};

const rateLimitStore = new Map<
  string,
  { count: number; resetAt: number; lastSeenAt: number }
>();

function readField(formData: FormData, field: keyof typeof limits) {
  return String(formData.get(field) || "")
    .trim()
    .slice(0, limits[field]);
}

function readProductSelectionField(formData: FormData, field: "productId" | "productSlug") {
  const limit = field === "productId" ? 200 : 240;
  return String(formData.get(field) || "").trim().slice(0, limit);
}

function readSourcePage(formData: FormData) {
  const value = String(formData.get("sourcePage") || "").trim().slice(0, 500);
  return value.startsWith("/") ? value : "/request";
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const forwardedIp = forwardedFor?.split(",")[0]?.trim();

  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    forwardedIp ||
    "unknown"
  );
}

function getRateLimitKey(request: Request) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent")?.trim() || "unknown";
  return `${ip}::${userAgent.slice(0, 180)}`;
}

function cleanupRateLimitStore(now: number) {
  if (rateLimitStore.size < RATE_LIMIT_STORE_MAX_ENTRIES) return;

  for (const [key, bucket] of rateLimitStore) {
    if (bucket.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }

  if (rateLimitStore.size < RATE_LIMIT_STORE_MAX_ENTRIES) return;

  const oldestKeys = [...rateLimitStore.entries()]
    .sort(([, left], [, right]) => left.lastSeenAt - right.lastSeenAt)
    .slice(0, Math.ceil(RATE_LIMIT_STORE_MAX_ENTRIES / 5))
    .map(([key]) => key);

  for (const key of oldestKeys) rateLimitStore.delete(key);
}

function checkRateLimit(request: Request) {
  const now = Date.now();
  cleanupRateLimitStore(now);

  const key = getRateLimitKey(request);
  const current = rateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
      lastSeenAt: now,
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  current.count += 1;
  current.lastSeenAt = now;

  if (current.count <= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

export async function POST(request: Request) {
  const userAgent = request.headers.get("user-agent")?.trim();

  if (!userAgent) {
    return NextResponse.json(
      {
        ok: false,
        error: "Не удалось принять заявку. Обновите страницу и попробуйте снова.",
      },
      { status: 400 },
    );
  }

  const rateLimit = checkRateLimit(request);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Слишком много запросов за короткое время. Пожалуйста, попробуйте позже.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const contentLength = Number(request.headers.get("content-length") || 0);

  if (contentLength > 100_000) {
    return NextResponse.json(
      {
        ok: false,
        error: "Описание получилось слишком длинным. Сократите текст и отправьте заявку ещё раз.",
      },
      { status: 413 }
    );
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Форму не удалось обработать. Обновите страницу и попробуйте снова.",
      },
      { status: 400 }
    );
  }

  if (String(formData.get("website") || "")) {
    return NextResponse.json({ ok: true });
  }

  const createdAt = new Date().toISOString();
  const lead = {
    id: crypto.randomUUID(),
    company: readField(formData, "company"),
    name: readField(formData, "name"),
    phone: readField(formData, "phone"),
    email: readField(formData, "email"),
    message: readField(formData, "message"),
    createdAt,
    receivedAt: createdAt,
  };

  if (!lead.company || !lead.name || !lead.message) {
    return NextResponse.json(
      { ok: false, error: "Заполните организацию, имя и описание задачи." },
      { status: 400 }
    );
  }

  if (!lead.phone && !lead.email) {
    return NextResponse.json(
      { ok: false, error: "Укажите телефон или email для ответа." },
      { status: 400 }
    );
  }

  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
    return NextResponse.json(
      { ok: false, error: "Проверьте адрес электронной почты." },
      { status: 400 }
    );
  }

  const submittedProductId = readProductSelectionField(formData, "productId");
  const submittedProductSlug = readProductSelectionField(formData, "productSlug");
  const hasSubmittedProductContext = Boolean(submittedProductId || submittedProductSlug);
  const productContext = hasSubmittedProductContext
    ? await resolveRequestProductContext(
        { id: submittedProductId, slug: submittedProductSlug },
        { catalogRepository, productService },
      )
    : null;

  if (hasSubmittedProductContext && !productContext) {
    return NextResponse.json(
      {
        ok: false,
        error: "Выбранное оборудование недоступно. Обновите страницу и попробуйте снова.",
      },
      { status: 400 },
    );
  }

  const attribution = parseAttributionEnvelope(String(formData.get("attribution") || ""));
  const attributionPayload = flattenAttribution(attribution);
  const sourcePage = readSourcePage(formData);

  const webhookUrl = process.env.CYBERMEDICA_LEADS_WEBHOOK_URL;

  if (!webhookUrl) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Приём заявок временно недоступен. Пожалуйста, свяжитесь с нами позже.",
      },
      { status: 503 }
    );
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.CYBERMEDICA_LEADS_WEBHOOK_TOKEN
          ? {
              authorization: `Bearer ${process.env.CYBERMEDICA_LEADS_WEBHOOK_TOKEN}`,
            }
          : {}),
      },
      body: JSON.stringify({
        ...lead,
        sourcePage,
        ...attributionPayload,
        ...(productContext
          ? {
              product: productContext,
              productId: productContext.id,
              productSlug: productContext.slug,
              productModel: productContext.model,
              productManufacturer: productContext.manufacturer,
            }
          : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`);
    }
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Сервис заявок временно недоступен. Попробуйте немного позже.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, requestId: lead.id });
}
