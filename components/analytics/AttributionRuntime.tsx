"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { captureBrowserAttribution, trackRfqEvent } from "@/lib/analytics/events";
import { readApprovedMetricaCounterId } from "@/lib/analytics/metrica";

export default function AttributionRuntime() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    captureBrowserAttribution();
  }, [pathname, searchParams]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>("a[href]");
      if (!link) return;
      const href = new URL(link.href, window.location.href);
      if (href.origin !== window.location.origin || href.pathname !== "/request") return;
      trackRfqEvent("rfq_cta_click", {
        productId: href.searchParams.get("productId") ?? undefined,
        productSlug: href.searchParams.get("product") ?? undefined,
        sourcePage: window.location.pathname,
      });
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    const counterId = readApprovedMetricaCounterId();
    if (counterId === null || window.location.hostname !== "cyber-medica.ru") return;
    if (document.querySelector('script[data-cybermedica-metrica="true"]')) return;
    if (!window.ym) {
      const queuedYm = (...args: unknown[]) => {
        queuedYm.a ??= [];
        queuedYm.a.push(args);
      };
      queuedYm.a = [] as unknown[][];
      window.ym = queuedYm;
    }
    const queuedYm = window.ym;
    queuedYm.l = Date.now();
    window.ym(counterId, "init", {
      accurateTrackBounce: true,
      clickmap: true,
      trackLinks: true,
    });

    let loaded = false;
    let timeout = 0;
    function loadMetrica() {
      if (loaded) return;
      loaded = true;
      window.clearTimeout(timeout);
      window.removeEventListener("pointerdown", loadMetrica);
      window.removeEventListener("keydown", loadMetrica);
      const script = document.createElement("script");
      script.async = true;
      script.dataset.cybermedicaMetrica = "true";
      script.src = "https://mc.yandex.ru/metrika/tag.js";
      document.head.append(script);
    }

    // Attribution and the Metrica command queue are ready immediately. The
    // network-heavy third-party runtime starts after the critical render path,
    // or earlier on the user's first interaction, without losing queued goals.
    timeout = window.setTimeout(loadMetrica, 5_000);
    window.addEventListener("pointerdown", loadMetrica, { passive: true, once: true });
    window.addEventListener("keydown", loadMetrica, { once: true });

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("pointerdown", loadMetrica);
      window.removeEventListener("keydown", loadMetrica);
    };
  }, []);

  return null;
}
