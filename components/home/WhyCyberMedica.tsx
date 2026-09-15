const items = [
  [
    "specification",
    "Подбор по ТЗ",
    "Подбор под техническое задание: модели и комплектации по заданным требованиям.",
  ],
  [
    "compliance",
    "Проверка соответствия",
    "Сопоставляем параметры предложенного оборудования с требованиями запроса.",
  ],
  [
    "quote",
    "Подготовка КП",
    "Формируем коммерческое предложение по согласованному составу поставки.",
  ],
  [
    "alternatives",
    "Подбор аналогов",
    "Предлагаем сопоставимые варианты, когда исходная модель недоступна или требует замены.",
  ],
  [
    "procurement",
    "Сопровождение закупки",
    "Помогаем уточнить комплектацию и сведения, необходимые на этапе закупки.",
  ],
  [
    "documents",
    "Документы по запросу",
    "Предоставляем доступные документы по выбранному оборудованию в составе ответа.",
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
    compliance: (
      <>
        <path d="m5 12 4 4L19 6" />
        <path d="M4 4h16v16H4z" />
      </>
    ),
    quote: (
      <>
        <path d="M6 4.5h12v15H6z" />
        <path d="M9 9h6m-6 3h6m-6 3h4" />
      </>
    ),
    alternatives: (
      <>
        <path d="M7 7h10m0 0-3-3m3 3-3 3" />
        <path d="M17 17H7m0 0 3 3m-3-3 3-3" />
      </>
    ),
    procurement: (
      <>
        <path d="M5 8h14l-1 11H6z" />
        <path d="M9 8V5h6v3m-6 4h6" />
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
          Что получает заказчик
        </h2>
        <p className="mt-2 max-w-[42rem] text-sm leading-6 text-cm-slate">
          Оборудование ведущих производителей. Работа с государственными и частными заказчиками.
          Сопровождение поставки и документации.
        </p>
        <p className="mt-2 max-w-[42rem] text-xs leading-5 text-cm-dim">
          Сервис и сопровождение оборудования. Гарантийное и постгарантийное обслуживание через сеть профильных сервисных партнеров.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
