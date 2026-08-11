export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-200">
      <div className="max-w-7xl mx-auto h-20 px-8 flex items-center justify-between">

        <div className="flex items-center gap-3">

          <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold">
            C
          </div>

          <div>
            <div className="font-bold text-xl">
              Кибермедика
            </div>

            <div className="text-xs text-gray-500">
              Каталог оборудования
            </div>
          </div>

        </div>

        <nav className="hidden lg:flex items-center gap-8 text-gray-600">

          <a href="#">Каталог</a>

          <a href="#">Производители</a>

          <a href="#">Производители</a>

          <a href="#">Тендеры</a>

          <a href="#">Контакты</a>

        </nav>

        <button className="bg-blue-600 hover:bg-blue-700 transition text-white px-6 py-3 rounded-xl font-medium">
          Запросить КП
        </button>

      </div>
    </header>
  );
}
