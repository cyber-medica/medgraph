import "./globals.css";

import type { Metadata } from "next";
import { Onest } from "next/font/google";
import { Suspense } from "react";
import AttributionRuntime from "@/components/analytics/AttributionRuntime";
import Header from "@/components/layout/Header";
import Footer from "@/components/home/Footer";
import CloudCatalogPreviewBanner from "@/components/storefront/CloudCatalogPreviewBanner";
import { isCloudPreviewCatalog } from "@/lib/storefront/data-source";
import { isProductionIndexingEnvironment } from "@/lib/storefront/indexing";

const allowIndexing = isProductionIndexingEnvironment();
const onest = Onest({
  display: "swap",
  fallback: ["Inter", "system-ui", "sans-serif"],
  preload: true,
  subsets: ["cyrillic", "latin"],
  variable: "--font-onest",
  weight: "variable",
});
const siteUrl = "https://cyber-medica.ru";
const siteTitle = "Кибермедика — экспертная база медицинских изделий";
const siteDescription =
  "Кибермедика помогает врачам, инженерам и закупщикам проверять медицинские изделия: регистрационные документы, характеристики, совместимость, аналоги и источники данных.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: "%s | Кибермедика",
  },
  description: siteDescription,
  applicationName: "Кибермедика",
  authors: [{ name: "Кибермедика" }],
  creator: "Кибермедика",
  publisher: "Кибермедика",
  keywords: [
    "Кибермедика",
    "медицинские изделия",
    "регистрационные документы",
    "медицинское оборудование",
    "совместимость медицинских изделий",
    "аналоги медицинских изделий",
    "закупки медицинского оборудования",
    "база знаний медицинских изделий",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    siteName: "Кибермедика",
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
  },
  robots: {
    index: allowIndexing,
    follow: allowIndexing,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The document shell must never wait for the remote catalog.
  // Route-level components own catalog loading and failure handling.
  const cloudPreview = isCloudPreviewCatalog();

  return (
    <html lang="ru">
      <body className={`${onest.variable} bg-cm-canvas font-sans text-cm-ink antialiased`}>
        <Header
          products={[]}
          manufacturers={[]}
          categories={[]}
        />
        <CloudCatalogPreviewBanner enabled={cloudPreview} />
        <Suspense fallback={null}>
          <AttributionRuntime />
        </Suspense>
        {children}
        <Footer />
      </body>
    </html>
  );
}
