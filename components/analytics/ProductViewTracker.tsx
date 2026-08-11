"use client";

import { useEffect, useRef } from "react";

import { trackRfqEvent } from "@/lib/analytics/events";

export default function ProductViewTracker({
  productId,
  productSlug,
  productModel,
  productManufacturer,
}: {
  productId: string;
  productSlug: string;
  productModel: string;
  productManufacturer: string;
}) {
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackRfqEvent("product_view", {
      productId,
      productSlug,
      productModel,
      productManufacturer,
      sourcePage: `/catalog/${productSlug}`,
    });
  }, [productId, productManufacturer, productModel, productSlug]);
  return null;
}
