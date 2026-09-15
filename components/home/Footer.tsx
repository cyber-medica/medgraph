import Image from "next/image";
import Link from "next/link";
import { PUBLIC_COMPANY } from "@/lib/company/public-company";

export default function Footer() {
  return (
    <footer className="bg-cm-ink text-white">
      <div className="cm-container grid gap-5 py-6 sm:grid-cols-2 lg:grid-cols-[1.2fr_0.8fr_0.75fr_0.9fr_1fr] lg:gap-8">
        <div>
          <Link href="/" aria-label="Кибермедика — главная" className="inline-flex min-h-[44px] items-center">
            <Image
              src="/brand/cybermedica-logo.png"
              alt="Кибермедика"
              width={160}
              height={34}
              className="h-auto w-40"
            />
          </Link>
          <p className="mt-2 max-w-xs text-[11px] leading-5 text-white/70">
            Подбор и поставка медицинского оборудования для государственных и частных организаций.
          </p>
          <p className="mt-3 text-[10px] leading-5 text-white/65">
            {PUBLIC_COMPANY.legalName}<br />
            ИНН {PUBLIC_COMPANY.inn}
          </p>
        </div>

        <div>
          <div className="cm-label !text-white/65">Компания</div>
          <div className="mt-3 flex flex-col gap-2 text-[11px] text-white/75">
            <Link href="/about" className="transition duration-200 hover:text-white">О компании</Link>
            <Link href="/contacts" className="transition duration-200 hover:text-white">Контакты</Link>
            <Link href="/privacy" className="transition duration-200 hover:text-white">Политика конфиденциальности</Link>
            <Link href="/personal-data-consent" className="transition duration-200 hover:text-white">Согласие на обработку данных</Link>
          </div>
        </div>

        <div>
          <div className="cm-label !text-white/65">Платформа</div>
          <div className="mt-3 flex flex-col gap-2 text-[11px] text-white/75">
            <Link href="/catalog" className="transition duration-200 hover:text-white">Каталог</Link>
            <Link href="/manufacturers" className="transition duration-200 hover:text-white">Производители</Link>
          </div>
        </div>

        <div>
          <div className="cm-label !text-white/65">Запрос на оборудование</div>
          <div className="mt-3 flex flex-col gap-2 text-[11px] text-white/75">
            <Link href="/request" className="transition duration-200 hover:text-white">Запросить КП</Link>
            <Link href="/search" className="transition duration-200 hover:text-white">Найти модель</Link>
            <Link href="/manufacturers" className="transition duration-200 hover:text-white">Выбрать производителя</Link>
          </div>
        </div>

        <div>
          <div className="cm-label !text-white/65">Связаться</div>
          <div className="mt-3 flex flex-col gap-2 text-[11px] text-white/75">
            <a href={PUBLIC_COMPANY.phoneHref} className="transition duration-200 hover:text-white">{PUBLIC_COMPANY.phoneDisplay}</a>
            <a href={PUBLIC_COMPANY.emailHref} className="break-all transition duration-200 hover:text-white">{PUBLIC_COMPANY.email}</a>
            <span>{PUBLIC_COMPANY.businessHours}</span>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="cm-container py-3 text-[10px] text-white/65">
          <span>© 2026 Кибермедика. Все права защищены.</span>
        </div>
      </div>
    </footer>
  );
}
