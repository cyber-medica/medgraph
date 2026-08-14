const items = [
  {
    title: "Регистрационные удостоверения",
    text: "Все регистрационные удостоверения, инструкции и документы в одном месте.",
  },
  {
    title: "Аналоги",
    text: "Быстрый подбор аналогов медицинских изделий.",
  },
  {
    title: "Совместимость",
    text: "Проверка совместимости изделий и оборудования.",
  },
  {
    title: "Тендерная аналитика",
    text: "История закупок, заказчики и цены.",
  },
  {
    title: "Подбор оборудования",
    text: "Помощь в выборе оборудования по техническим параметрам и назначению.",
  },
  {
    title: "Коммерческие предложения",
    text: "Получите коммерческое предложение за несколько минут.",
  },
];

export default function Advantages() {
  return (
    <section className="bg-cm-surface-low py-16">
      <div className="cm-container">
        <h2 className="cm-heading-2 text-center text-[1.55rem] font-extrabold">
          Почему Кибермедика
        </h2>

        <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-7 text-cm-slate">
          Каталог оборудования для клиник, инженеров и закупочных команд.
        </p>

        <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.title}
              className="cm-card p-5"
            >
              <h3 className="cm-heading-3 text-sm font-bold">
                {item.title}
              </h3>

              <p className="mt-3 text-xs leading-6 text-cm-slate">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
