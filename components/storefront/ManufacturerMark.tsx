import Image from "next/image";
import { getManufacturerLogoPresentation } from "@/lib/storefront/manufacturer-logo-policy";

export default function ManufacturerMark({
  slug,
  name,
  size = "md",
}: {
  slug: string;
  name: string;
  size?: "sm" | "md" | "lg" | "hero";
}) {
  const presentation = getManufacturerLogoPresentation({ slug, name });
  const sizes = {
    sm: "size-9",
    md: "size-11",
    lg: "size-14",
    hero: "h-10 w-[min(150px,100%)] sm:h-14 sm:w-[200px]",
  } as const;
  const imageSizes = { sm: "36px", md: "44px", lg: "56px", hero: "(max-width: 639px) 150px, 200px" } as const;

  if (presentation.kind === "graphic" && presentation.assetUrl) {
    return (
      <span
        className={`relative flex ${sizes[size]} shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--cm-rule)] ${presentation.assetSurface === "dark" ? "bg-[#273746]" : "bg-white"}`}
        data-logo-kind="graphic"
      >
        <Image
          src={presentation.assetUrl}
          alt={presentation.alt}
          width={presentation.assetWidth}
          height={presentation.assetHeight}
          sizes={imageSizes[size]}
          loading={size === "hero" ? "eager" : "lazy"}
          className="h-auto max-h-full w-auto max-w-full object-contain p-[5%]"
        />
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={`${name} — типографический логотип`}
      title={name}
      data-logo-kind="fallback"
      className={`grid ${size === "hero" ? "size-10 sm:size-14" : sizes[size]} shrink-0 place-items-center overflow-hidden rounded-lg border border-[var(--cm-rule)] bg-[linear-gradient(145deg,#ffffff_0%,#eef7f8_100%)] px-1 font-bold tracking-[-0.04em] text-cm-teal-dark shadow-[inset_0_0_0_1px_rgba(255,255,255,0.65)]`}
    >
      <span aria-hidden="true" className={size === "hero" ? "text-sm" : size === "sm" ? "text-[10px]" : "text-xs"}>
        {presentation.monogram}
      </span>
    </span>
  );
}
