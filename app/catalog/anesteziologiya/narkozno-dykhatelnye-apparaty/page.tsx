import type { Metadata } from "next";

import SeoLandingPage from "@/components/seo/SeoLandingPage";
import { buildSeoLandingMetadataV3 } from "@/lib/seo/implementation-v3";

const path = "/catalog/anesteziologiya/narkozno-dykhatelnye-apparaty" as const;

export const metadata: Metadata = buildSeoLandingMetadataV3(path);

export default function Page() {
  return <SeoLandingPage path={path} />;
}
