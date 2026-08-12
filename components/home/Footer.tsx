import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-cm-ink text-white">
      <div className="cm-container grid gap-5 py-6 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr] lg:gap-8">
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
      </div>
      <div className="border-t border-white/10">
        <div className="cm-container py-3 text-[10px] text-white/65">
          <span>© 2026 Кибермедика. Все права защищены.</span>
        </div>
      </div>
    </footer>
  );
}
