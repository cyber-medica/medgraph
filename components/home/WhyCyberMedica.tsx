const items = [
  [
    "manufacturers",
    "Оборудование ведущих производителей",
    "В каталоге представлены опубликованные модели из разных категорий медицинской техники.",
  ],
  [
    "specification",
    "Подбор под техническое задание",
    "Уточняем класс, модель и требования, чтобы подготовить релевантные варианты.",
  ],
  [
    "organizations",
    "Работа с государственными и частными заказчиками",
    "Принимаем запросы от государственных и частных медицинских организаций.",
  ],
  [
    "documents",
    "Сопровождение поставки и документации",
    "Помогаем согласовать комплект поставки и доступный набор сопроводительных материалов.",
  ],
  [
    "service",
    "Сервис и сопровождение оборудования",
    "Гарантийное и постгарантийное обслуживание через сеть профильных сервисных партнеров.",
  ],
] as const;

type TrustIconKind = (typeof items)[number][0];

function TrustIcon({ kind }: { kind: TrustIconKind }) {
  const paths = {
    manufacturers: (
      <>
        <path d="M4.5 20V8.5L12 4l7.5 4.5V20" />
        <path d="M8.5 20v-5h7v5M8 10.5h1m3 0h1m3 0h1" />
      </>
    ),
    specification: (
      <>
        <path d="M7 4.5h7l3 3V20H7z" />
        <path d="M14 4.5V8h3M10 12h4m-4 3h4" />
      </>
    ),
    organizations: (
      <>
        <path d="M5 20v-9h14v9M9 11V6h6v5" />
        <path d="M9 15h2m2 0h2m-4 5v-2h2v2" />
      </>
    ),
    documents: (
      <>
        <path d="M5.5 6.5h8l3 3v10h-11z" />
        <path d="M13.5 6.5v3h3M9 13h4m-4 3h4M9 3.5h8l2 2v10" />
      </>
    ),
    service: (
      <>
        <path d="M12 3.5a4 4 0 0 0-3.8 5.2L4.7 12.2a2 2 0 0 0 2.8 2.8l3.5-3.5a4 4 0 0 0 5.3-3.8l-2.4 2.4-2-2z" />
        <path d="m12.5 14.5 5.8 5.8M15.2 17.2l-2.7 2.7" />
      </>
    ),
  } as const;

  return (
    <span
      aria-hidden="true"
      className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--cm-rule)] bg-cm-teal-soft text-cm-teal"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none">
        <g
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {paths[kind]}
        </g>
      </svg>
    </span>
  );
}

export default function WhyCyberMedica() {
  return (
    <section
      aria-labelledby="platform-benefits-title"
      className="cm-section bg-cm-canvas"
    >
      <div className="cm-container">
        <h2
          id="platform-benefits-title"
          className="cm-heading-2 text-2xl font-extrabold leading-[1.2] sm:text-[26px] lg:text-[30px]"
        >
          Подбор и сопровождение поставки
        </h2>
        <p className="mt-2 max-w-[42rem] text-sm leading-6 text-cm-slate">
          Практическая поддержка на пути от технической задачи до согласования комплектации.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {items.map(([kind, title, text]) => (
            <div
              key={title}
              className="cm-card min-h-[9.5rem] p-4 sm:p-5"
            >
              <TrustIcon kind={kind} />
              <h3 className="cm-heading-3 mt-4 text-[15px] font-bold leading-5">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-cm-slate">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
