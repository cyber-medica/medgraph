"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Global render failure", { digest: error.digest ?? "unavailable" });
  }, [error.digest]);

  return (
    <html lang="ru">
      <head>
        <title>Кибермедика — временная ошибка</title>
      </head>
      <body
        style={{
          margin: 0,
          minWidth: 320,
          background: "#f4f7fa",
          color: "#0b1320",
          fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        }}
      >
        <main
          style={{
            display: "grid",
            minHeight: "100vh",
            placeItems: "center",
            padding: 24,
          }}
        >
          <section
            aria-labelledby="global-error-title"
            style={{
              width: "min(100%, 560px)",
              border: "1px solid rgba(11, 19, 32, 0.13)",
              borderRadius: 12,
              background: "#ffffff",
              padding: 28,
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, color: "#b42318", fontSize: 12, fontWeight: 700 }}>
              ВРЕМЕННАЯ ОШИБКА
            </p>
            <h1 id="global-error-title" style={{ margin: "12px 0 0", fontSize: 24 }}>
              Не удалось открыть страницу
            </h1>
            <p style={{ margin: "12px auto 0", maxWidth: 440, color: "#4e6070", lineHeight: 1.6 }}>
              Данные не изменены. Повторите загрузку через несколько секунд.
            </p>
            <button
              type="button"
              onClick={unstable_retry}
              style={{
                minHeight: 46,
                marginTop: 22,
                border: "1px solid #0b7b8e",
                borderRadius: 10,
                background: "#0b1320",
                color: "#ffffff",
                cursor: "pointer",
                font: "inherit",
                fontWeight: 600,
                padding: "10px 20px",
              }}
            >
              Повторить
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
