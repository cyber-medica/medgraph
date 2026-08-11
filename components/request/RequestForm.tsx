"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RequestProductContext } from "@/lib/request/product-context";
import { readBrowserAttribution, trackRfqEvent } from "@/lib/analytics/events";

interface RequestFormProps {
  initialMessage?: string;
  productContext?: RequestProductContext;
}

export default function RequestForm({
  initialMessage = "",
  productContext,
}: RequestFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const formStarted = useRef(false);

  useEffect(() => {
    trackRfqEvent("rfq_form_view", {
      productId: productContext?.id,
      productSlug: productContext?.slug,
      productModel: productContext?.model,
      productManufacturer: productContext?.manufacturer ?? undefined,
      sourcePage: window.location.pathname,
    });
  }, [productContext]);

  function handleFormStart() {
    if (formStarted.current) return;
    formStarted.current = true;
    trackRfqEvent("rfq_form_start", {
      productId: productContext?.id,
      productSlug: productContext?.slug,
      productModel: productContext?.model,
      productManufacturer: productContext?.manufacturer ?? undefined,
      sourcePage: window.location.pathname,
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const formData = new FormData(event.currentTarget);
    const attribution = readBrowserAttribution();
    if (attribution) formData.set("attribution", JSON.stringify(attribution));
    formData.set("sourcePage", window.location.pathname);
    trackRfqEvent("rfq_submit_attempt", {
      productId: productContext?.id,
      productSlug: productContext?.slug,
      productModel: productContext?.model,
      productManufacturer: productContext?.manufacturer ?? undefined,
      sourcePage: window.location.pathname,
    });

    try {
      const response = await fetch("/api/request", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        requestId?: string;
      };

      if (!response.ok || !result.ok) {
        trackRfqEvent("rfq_error", {
          errorClass: "backend_rejected",
          httpStatus: response.status,
          productId: productContext?.id,
          productSlug: productContext?.slug,
          sourcePage: window.location.pathname,
        });
        setError(
          result.error ||
            "Заявку не удалось отправить. Попробуйте ещё раз или напишите нам — мы поможем с запросом вручную."
        );
        return;
      }

      if (!result.requestId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(result.requestId)) {
        trackRfqEvent("rfq_error", {
          errorClass: "invalid_request_id",
          httpStatus: response.status,
          productId: productContext?.id,
          productSlug: productContext?.slug,
          sourcePage: window.location.pathname,
        });
        setError("Заявка принята некорректно. Пожалуйста, попробуйте ещё раз.");
        return;
      }

      trackRfqEvent("rfq_success", {
        productId: productContext?.id,
        productSlug: productContext?.slug,
        productModel: productContext?.model,
        productManufacturer: productContext?.manufacturer ?? undefined,
        requestId: result.requestId,
        sourcePage: window.location.pathname,
      });

      router.push("/thanks");
    } catch {
      trackRfqEvent("rfq_error", {
        errorClass: "network_error",
        productId: productContext?.id,
        productSlug: productContext?.slug,
        sourcePage: window.location.pathname,
      });
      setError("Не получилось отправить заявку. Проверьте подключение и попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  const fieldClassName =
    "cm-field text-[13px] placeholder:text-cm-dim";

  return (
    <form className="mt-6 space-y-5" onSubmit={handleSubmit} onChange={handleFormStart}>
      {productContext ? (
        <div
          className="rounded-md border border-[var(--cm-rule)] bg-cm-surface-low/70 p-4"
          data-testid="request-product-context"
        >
          <span className="cm-label block text-cm-dim">Выбранное оборудование</span>
          <strong className="mt-1 block text-sm text-cm-ink">
            {productContext.title}
          </strong>
          {productContext.manufacturer ? (
            <span className="mt-1 block text-xs text-cm-slate">
              {productContext.manufacturer}
            </span>
          ) : null}
          <input type="hidden" name="productId" value={productContext.id} />
          <input type="hidden" name="productSlug" value={productContext.slug} />
          <input type="hidden" name="productTitle" value={productContext.title} />
          {productContext.manufacturer ? (
            <input
              type="hidden"
              name="productManufacturer"
              value={productContext.manufacturer}
            />
          ) : null}
        </div>
      ) : null}

      <label className="block">
        <span className="cm-label mb-2 block">
          Организация <span className="text-cm-danger">*</span>
        </span>
        <input
          name="company"
          required
          maxLength={160}
          autoComplete="organization"
          placeholder="Например, ГКБ №1 или ООО «Медтехника»"
          className={fieldClassName}
        />
      </label>

      <label className="block">
        <span className="cm-label mb-2 block">
          Ваше имя <span className="text-cm-danger">*</span>
        </span>
        <input
          name="name"
          required
          maxLength={120}
          autoComplete="name"
          placeholder="Имя, должность или роль в закупке"
          className={fieldClassName}
        />
      </label>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="block">
          <span className="cm-label mb-2 block">Телефон</span>
          <input
            name="phone"
            type="tel"
            maxLength={40}
            autoComplete="tel"
            placeholder="+7 999 000-00-00"
            className={fieldClassName}
          />
        </label>
        <label className="block">
          <span className="cm-label mb-2 block">Email</span>
          <input
            name="email"
            type="email"
            maxLength={160}
            autoComplete="email"
            placeholder="name@clinic.ru"
            className={fieldClassName}
          />
        </label>
      </div>

      <p className="-mt-2 text-[11px] text-cm-dim">
        Укажите телефон или email, чтобы мы могли ответить.
      </p>

      <label className="block">
        <span className="cm-label mb-2 block">
          Что нужно подобрать? <span className="text-cm-danger">*</span>
        </span>
        <textarea
          name="message"
          required
          maxLength={3000}
          defaultValue={initialMessage}
          placeholder="Изделие, количество, сроки, важные характеристики, номер закупки или ссылка на техническое задание"
          rows={6}
          className={fieldClassName}
        />
      </label>

      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-[var(--cm-danger-soft)] p-4 text-xs leading-6 text-[var(--cm-danger)]"
        >
          {error}
        </div>
      )}

      <button
        disabled={pending}
        className="cm-button-primary w-full min-h-12 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Отправляем заявку…" : "Отправить заявку"}
      </button>

      <p className="text-center text-[10px] leading-5 text-cm-dim">
        Нажимая кнопку, вы передаёте данные только для подготовки ответа на
        вашу заявку.
      </p>
    </form>
  );
}
