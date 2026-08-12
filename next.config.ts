import type { NextConfig } from "next";

import { APPROVED_PUBLIC_MEDIA_HOSTS } from "./lib/public-media-policy.ts";
import {
  CANONICAL_ORIGIN_FAMILY,
  safeRoutingHeaderValue,
} from "./lib/canonical-routing-gate.ts";
import { getStorefrontDataSource } from "./lib/storefront/data-source.ts";

const isDevelopment = process.env.NODE_ENV === "development";
const isCloudPreview = getStorefrontDataSource(process.env) === "cloud_preview";
const cloudMediaOrigins = APPROVED_PUBLIC_MEDIA_HOSTS
  .map((hostname) => `https://${hostname}`)
  .join(" ");
const canonicalRoutingHeaders = [
  {
    key: "X-CyberMedica-Origin",
    value: CANONICAL_ORIGIN_FAMILY,
  },
  {
    key: "X-CyberMedica-Deployment",
    value: safeRoutingHeaderValue(process.env.VERCEL_DEPLOYMENT_ID, "local"),
  },
  {
    key: "X-CyberMedica-Release",
    value: safeRoutingHeaderValue(process.env.VERCEL_GIT_COMMIT_SHA, "untracked"),
  },
] as const;

export const runtimeResearchDatasetExcludes = [
  "./data/research/**/*",
] as const;

export const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://mc.yandex.ru https://yastatic.net${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://mc.yandex.ru ${cloudMediaOrigins}`,
  "font-src 'self' data:",
  `connect-src 'self' https://mc.yandex.ru${isDevelopment ? " ws: wss:" : ""}`,
  `media-src 'self' ${cloudMediaOrigins}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
].join("; ");

export const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), bluetooth=(), browsing-topics=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), serial=(), usb=()",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
] as const;

export const internalAuthHeaders = [
  {
    key: "Cache-Control",
    value: "private, no-store, max-age=0, must-revalidate",
  },
  { key: "Pragma", value: "no-cache" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
] as const;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.cyber-medica.ru" }],
        destination: "https://cyber-medica.ru/:path*",
        permanent: true,
      },
    ];
  },
  outputFileTracingExcludes: {
    "/*": [
      ...runtimeResearchDatasetExcludes,
      "./data/legacy/**/*",
      "./supabase/migrations/**/*",
    ],
  },
  images: {
    // Image configuration is compiled into the deployment artifact. Keep the
    // trusted Cloud media host available even when that artifact was built
    // with the static Storefront source and is later used by Preview.
    remotePatterns: APPROVED_PUBLIC_MEDIA_HOSTS.map((hostname) => ({
      protocol: "https" as const,
      hostname,
    })),
  },
  async headers() {
    const previewHeaders = isCloudPreview
      ? [
          {
            source: "/",
            headers: [
              { key: "Cache-Control", value: "private, no-cache, no-store, max-age=0, must-revalidate" },
              { key: "X-Robots-Tag", value: "noindex, nofollow" },
            ],
          },
          ...["/catalog/:path*", "/manufacturers/:path*", "/search", "/compare"].map((source) => ({
            source,
            headers: [
              { key: "Cache-Control", value: "private, no-cache, no-store, max-age=0, must-revalidate" },
              { key: "X-Robots-Tag", value: "noindex, nofollow" },
            ],
          })),
        ]
      : [];
    return [
      {
        source: "/(.*)",
        headers: [...securityHeaders, ...canonicalRoutingHeaders],
      },
      {
        source: "/api/request",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, no-store, max-age=0, must-revalidate",
          },
        ],
      },
      ...[
        "/auth/callback",
        "/internal/login",
        "/internal/review/hamilton-t1",
      ].map((source) => ({ source, headers: [...internalAuthHeaders] })),
      ...previewHeaders,
    ];
  },
};

export default nextConfig;
