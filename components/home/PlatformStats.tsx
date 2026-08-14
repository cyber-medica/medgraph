export default function PlatformStats({
  productCount,
  manufacturerCount,
  categoryCount,
}: {
  productCount: number;
  manufacturerCount: number;
  categoryCount: number;
}) {
  const items = [
    ["Товары", productCount],
    ["Производители", manufacturerCount],
    ["Категории", categoryCount],
  ] as const;

  return (
    <section className="border-b border-[var(--cm-rule)] bg-cm-canvas">
      <div className="cm-container py-9 sm:py-11">
        <div className="cm-card overflow-hidden bg-white/92">
          <div className="border-b border-[var(--cm-rule)] bg-white px-5 py-3.5">
            <div className="cm-label !text-cm-teal">Каталог</div>
          </div>
          <div className="grid gap-px bg-[var(--cm-rule)] sm:grid-cols-2 lg:grid-cols-4">
          {items.map(([label, value]) => (
            <div
              key={label}
              className="bg-white p-5 transition duration-200 hover:bg-cm-surface-low/55"
            >
              <div className="font-sans text-2xl font-bold text-cm-ink">
                {value}
              </div>
              <div className="mt-1 cm-label">{label}</div>
              <div className="mt-3 h-1 rounded-full bg-cm-surface-low">
                <div className="h-1 w-2/3 rounded-full bg-cm-teal/60" />
              </div>
            </div>
          ))}
          </div>
        </div>
      </div>
    </section>
  );
}
