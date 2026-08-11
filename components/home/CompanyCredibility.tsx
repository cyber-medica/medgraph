export default function CompanyCredibility() {
  return (
    <section
      aria-labelledby="company-credibility-title"
      className="border-y border-[var(--cm-rule)] bg-white py-10 sm:py-12"
    >
      <div className="cm-container grid gap-5 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:items-start lg:gap-12">
        <div>
          <p className="cm-label !text-cm-teal">О компании</p>
          <h2
            id="company-credibility-title"
            className="cm-balanced mt-3 text-2xl font-extrabold leading-[1.2] tracking-[-0.025em] sm:text-[26px] lg:text-[30px]"
          >
            Кибермедика помогает подобрать оборудование под задачу учреждения
          </h2>
        </div>
        <div className="grid gap-4 text-sm leading-7 text-cm-slate sm:grid-cols-2">
          <p>
            Мы специализируемся на поставках медицинского оборудования разных
            категорий для клиник и медицинских организаций.
          </p>
          <p>
            Помогаем уточнить технические требования и подготовить предложение
            под запрос заказчика без неподтверждённых обещаний о комплектации и сроках.
          </p>
        </div>
      </div>
    </section>
  );
}
