import type { Metadata } from "next";

import Hero from "@/components/home/Hero";
import Equipment from "@/components/home/Equipment";
import FeaturedManufacturers from "@/components/home/FeaturedManufacturers";
import Categories from "@/components/home/Categories";
import WhyCyberMedica from "@/components/home/WhyCyberMedica";
import CompanyCredibility from "@/components/home/CompanyCredibility";
import CTA from "@/components/home/CTA";
import JsonLd from "@/components/seo/JsonLd";
import {
  categoryService,
  manufacturerService,
  productService,
  storefrontDataSource,
} from "@/lib/storefront";
import { buildStorefrontMetadata } from "@/lib/storefront/seo";
import { buildHomepageStructuredData } from "@/lib/storefront/structured-data";
import { formatCountryForPublic } from "@/lib/storefront/country-presentation";
import {
  selectEndoMarketStageFeaturedProducts,
  selectPublishedFeaturedProducts,
} from "@/lib/storefront/featured-products";
import { loadHomepageOverviewSources } from "@/lib/storefront/homepage-overview";

const homepageDescription =
  "Поставка и подбор профессионального медицинского оборудования для государственных и частных медицинских организаций.";

const HOMEPAGE_CATEGORY_SLUGS = [
  "ventilators",
  "patient-monitors",
  "syringe-pumps",
  "ultrasound-systems",
  "endoscopy-systems",
  "x-ray-systems",
  "defibrillator-monitors",
  "respiratory-support-devices",
] as const;

const homepageCategoryOrder = new Map<string, number>(
  HOMEPAGE_CATEGORY_SLUGS.map((slug, index) => [slug, index]),
);

export const metadata: Metadata = buildStorefrontMetadata({
  title: "Кибермедика — медицинское оборудование для клиник и учреждений",
  description: homepageDescription,
  canonical: "/",
});

export default async function Home() {
  const { products, manufacturers, categories } = await loadHomepageOverviewSources({
    products: () => productService.getActiveProducts(),
    manufacturers: () => manufacturerService.getManufacturers(),
    categories: () => categoryService.getCategories(),
  });
  const categoryProductCounts = new Map<string, number>();
  const manufacturerProductCounts = new Map<string, number>();

  for (const product of products ?? []) {
    categoryProductCounts.set(
      product.categoryId,
      (categoryProductCounts.get(product.categoryId) ?? 0) + 1,
    );
    manufacturerProductCounts.set(
      product.manufacturerId,
      (manufacturerProductCounts.get(product.manufacturerId) ?? 0) + 1,
    );
  }

  const categoryEntries = products && categories ? categories
    .map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      shortDescription: category.shortDescription,
      productCount: categoryProductCounts.get(category.id) ?? 0,
    }))
    .filter(({ productCount }) => productCount > 0)
    .sort((left, right) => {
      const preferredOrder =
        (homepageCategoryOrder.get(left.slug) ?? Number.MAX_SAFE_INTEGER)
        - (homepageCategoryOrder.get(right.slug) ?? Number.MAX_SAFE_INTEGER);
      return preferredOrder
        || right.productCount - left.productCount
        || left.name.localeCompare(right.name, "ru-RU");
    })
    .slice(0, 8) : null;
  const manufacturerEntries = products && manufacturers ? manufacturers
    .map((manufacturer) => ({
      id: manufacturer.id,
      slug: manufacturer.slug,
      name: manufacturer.name,
      country: formatCountryForPublic(manufacturer.country),
      logoUrl: manufacturer.logoUrl,
      productCount: manufacturerProductCounts.get(manufacturer.id) ?? 0,
    }))
    .filter(({ productCount }) => productCount > 0)
    .sort((left, right) =>
      right.productCount - left.productCount ||
      left.name.localeCompare(right.name, "ru-RU"),
    )
    .slice(0, 8) : null;
  const catalogEquipment = products
    ? storefrontDataSource === "cloud_preview"
      ? selectEndoMarketStageFeaturedProducts(products)
      : selectPublishedFeaturedProducts(products)
    : null;

  return (
    <main className="min-h-screen bg-cm-canvas">
      {storefrontDataSource !== "cloud_preview" && (
        <JsonLd data={buildHomepageStructuredData(homepageDescription)} />
      )}
      <Hero products={products ?? []} />
      <Equipment
        products={catalogEquipment}
        manufacturers={manufacturers ?? []}
        categories={categories ?? []}
        minimumProductCount={storefrontDataSource === "cloud_preview" ? 4 : 1}
      />
      <Categories categories={categoryEntries} />
      <FeaturedManufacturers manufacturers={manufacturerEntries} />
      <WhyCyberMedica />
      <CompanyCredibility />
      <CTA />
    </main>
  );
}
