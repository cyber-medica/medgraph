import type { Metadata } from "next";
import Link from "next/link";

import Breadcrumbs from "@/components/navigation/Breadcrumbs";

export const metadata: Metadata = {
  title: "Решения",
  robots: { index: false, follow: true },
};

export default function SolutionsPage() {
  return (
    <main className="min-h-screen bg-cm-canvas">
      <header className="border-b border-[var(--cm-rule)] bg-[linear-gradient(135deg,#ffffff_0%,#f6fafc_58%,#e8f5f7_100%)]">
        <div className="cm-container py-7 sm:py-9">
          <Breadcrumbs
            items={[
              { name: "Главная", path: "/" },
              { name: "Решения", path: "/solutions" },
            ]}
          />
          <h1 className="cm-heading-1 mt-3 text-3xl font-extrabold">Решения</h1>
        </div>
      </header>
      <section className="cm-container py-6">
        <Link
          href="/solutions/portativnaya-bronkhoskopiya"
          className="cm-card block max-w-2xl p-5 text-base font-bold transition hover:border-cm-teal/35 hover:text-cm-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cm-teal"
        >
          Портативная бронхоскопия →
        </Link>
      </section>
    </main>
  );
}
