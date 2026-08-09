"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ProductMedia } from "@/lib/storefront/types";

export default function ProductGallery({
  media,
  fallbackLabel,
  productName,
}: {
  media: readonly ProductMedia[];
  fallbackLabel: string;
  productName: string;
}) {
  const orderedMedia = useMemo(
    () => [...media].sort((left, right) => left.position - right.position),
    [media],
  );
  const imageMedia = useMemo(
    () => orderedMedia.filter(({ type }) => type === "image"),
    [orderedMedia],
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const lightboxRef = useRef<HTMLDivElement | null>(null);
  const selectedMedia = orderedMedia[selectedIndex];
  const selectedImageIndex = selectedMedia
    ? imageMedia.findIndex(({ url }) => url === selectedMedia.url)
    : -1;

  const selectImage = useCallback((imageIndex: number) => {
    const image = imageMedia[imageIndex];
    if (!image) return;
    const mediaIndex = orderedMedia.findIndex(({ url }) => url === image.url);
    setSelectedIndex(mediaIndex);
  }, [imageMedia, orderedMedia]);

  const showPreviousImage = useCallback(() => {
    if (imageMedia.length < 2) return;
    selectImage((selectedImageIndex - 1 + imageMedia.length) % imageMedia.length);
  }, [imageMedia.length, selectImage, selectedImageIndex]);

  const showNextImage = useCallback(() => {
    if (imageMedia.length < 2) return;
    selectImage((selectedImageIndex + 1) % imageMedia.length);
  }, [imageMedia.length, selectImage, selectedImageIndex]);

  const handleTouchStart = useCallback((clientX: number) => {
    touchStartX.current = clientX;
  }, []);

  const handleTouchEnd = useCallback((clientX: number) => {
    if (touchStartX.current === null) return;
    const distance = clientX - touchStartX.current;
    if (Math.abs(distance) > 40) {
      if (distance > 0) showPreviousImage();
      else showNextImage();
    }
    touchStartX.current = null;
  }, [showNextImage, showPreviousImage]);

  useEffect(() => {
    if (!lightboxOpen) return;

    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    const animationFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [lightboxOpen]);

  useEffect(() => {
    if (!lightboxOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setLightboxOpen(false);
      if (event.key === "ArrowLeft") showPreviousImage();
      if (event.key === "ArrowRight") showNextImage();
      if (event.key !== "Tab") return;

      const focusable = lightboxRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen, showNextImage, showPreviousImage]);

  if (!selectedMedia) {
    return (
      <div className="grid aspect-[4/3] min-h-56 place-items-center rounded-xl border border-dashed border-[var(--cm-rule)] bg-white/70 px-4 text-center text-xs leading-6 text-cm-slate">
        <div>
          <div className="cm-empty-icon">▧</div>
          <div className="mx-auto mt-3 max-w-sm">{fallbackLabel}.</div>
        </div>
      </div>
    );
  }

  const lightboxImage = selectedImageIndex >= 0
    ? imageMedia[selectedImageIndex]
    : null;

  return (
    <div data-testid="product-gallery">
      <div
        className="relative aspect-[4/3] min-h-56 overflow-hidden rounded-xl border border-[var(--cm-rule)] bg-white sm:aspect-[16/11]"
        role="region"
        aria-roledescription="карусель изображений"
        aria-label={`Изображения: ${productName}`}
        onTouchStart={(event) => handleTouchStart(event.changedTouches[0]?.clientX ?? 0)}
        onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") showPreviousImage();
          if (event.key === "ArrowRight") showNextImage();
        }}
      >
        {selectedMedia.type === "image" ? (
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="group relative size-full cursor-zoom-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-cm-teal"
            aria-label="Увеличить изображение"
          >
            <Image
              src={selectedMedia.url}
              alt={selectedMedia.alt}
              fill
              preload={selectedImageIndex === 0}
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-contain p-2 transition duration-300 group-hover:scale-[1.015]"
            />
            <span
              className="absolute bottom-3 right-3 grid size-10 place-items-center rounded-full border border-[var(--cm-rule)] bg-white/94 text-cm-slate shadow-[0_6px_18px_rgba(11,19,32,0.14)] backdrop-blur transition group-hover:border-cm-teal/40 group-hover:text-cm-teal"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <circle cx="10.5" cy="10.5" r="5.5" />
                <path d="m15 15 4 4M10.5 8v5M8 10.5h5" />
              </svg>
            </span>
          </button>
        ) : (
          <video controls className="size-full" aria-label={selectedMedia.alt}>
            <source src={selectedMedia.url} />
          </video>
        )}
        {selectedImageIndex >= 0 && imageMedia.length > 1 ? (
          <>
          <div className="absolute bottom-3 left-3 flex gap-1.5">
            <button
              type="button"
              onClick={showPreviousImage}
              className="grid size-11 place-items-center rounded-full border border-[var(--cm-rule)] bg-white/94 text-sm font-semibold text-cm-slate shadow-[0_6px_18px_rgba(11,19,32,0.12)] backdrop-blur transition hover:border-cm-teal hover:text-cm-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cm-teal"
              aria-label="Предыдущее изображение"
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              onClick={showNextImage}
              className="grid size-11 place-items-center rounded-full border border-[var(--cm-rule)] bg-white/94 text-sm font-semibold text-cm-slate shadow-[0_6px_18px_rgba(11,19,32,0.12)] backdrop-blur transition hover:border-cm-teal hover:text-cm-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cm-teal"
              aria-label="Следующее изображение"
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-cm-ink/75 px-2.5 py-1 text-[10px] font-semibold text-white"
            aria-live="polite"
          >
            {selectedImageIndex + 1} / {imageMedia.length}
          </div>
          </>
        ) : null}
      </div>

      {lightboxOpen && lightboxImage && (
        <div
          ref={lightboxRef}
          className="fixed inset-0 z-[100] grid place-items-center bg-cm-ink/92 p-3 backdrop-blur-sm sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`Галерея: ${productName}`}
          tabIndex={-1}
          onClick={(event) => {
            if (event.currentTarget === event.target) setLightboxOpen(false);
          }}
          onTouchStart={(event) => handleTouchStart(event.changedTouches[0]?.clientX ?? 0)}
          onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
        >
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 grid size-11 place-items-center rounded-full border border-white/30 bg-black/30 text-xl text-white transition hover:bg-black/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label="Закрыть галерею"
          >
            ×
          </button>

          {imageMedia.length > 1 && (
            <>
              <button
                type="button"
                onClick={showPreviousImage}
                className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/30 text-2xl text-white transition hover:bg-black/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:left-6"
                aria-label="Предыдущее изображение"
              >
                ←
              </button>
              <button
                type="button"
                onClick={showNextImage}
                className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/30 text-2xl text-white transition hover:bg-black/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-6"
                aria-label="Следующее изображение"
              >
                →
              </button>
            </>
          )}

          <div className="relative h-[82vh] w-[88vw] max-w-6xl">
            <Image
              src={lightboxImage.url}
              alt={lightboxImage.alt}
              fill
              sizes="100vw"
              className="object-contain"
            />
          </div>
          <div className="absolute bottom-3 left-1/2 max-w-[80vw] -translate-x-1/2 rounded-full bg-black/35 px-3 py-1.5 text-center text-[11px] text-white/90 sm:bottom-5">
            {selectedImageIndex + 1} / {imageMedia.length}
          </div>
        </div>
      )}
    </div>
  );
}
