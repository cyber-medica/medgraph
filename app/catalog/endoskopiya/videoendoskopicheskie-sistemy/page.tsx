import type { Metadata } from "next";

import SeoLandingPage from "@/components/seo/SeoLandingPage";
import { buildSeoLandingMetadata } from "@/lib/seo/implementation-v2";

const path = "/catalog/endoskopiya/videoendoskopicheskie-sistemy" as const;

export const metadata: Metadata = buildSeoLandingMetadata(path);

export default function Page() {
  return <SeoLandingPage path={path} />;
}
