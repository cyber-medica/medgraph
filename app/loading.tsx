export default function Loading() {
  return (
    <main className="min-h-screen bg-cm-canvas" aria-busy="true" aria-label="Загрузка страницы">
      <div className="cm-container py-10">
        <div className="cm-skeleton h-3 w-32 rounded" />
        <div className="cm-skeleton mt-5 h-9 w-2/3 max-w-xl rounded" />
        <div className="cm-skeleton mt-3 h-4 w-1/2 max-w-md rounded" />
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          <div className="cm-skeleton h-64 rounded-lg" />
          <div className="cm-skeleton h-64 rounded-lg" />
        </div>
      </div>
    </main>
  );
}
