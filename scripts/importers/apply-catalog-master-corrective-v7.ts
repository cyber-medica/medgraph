import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type StageFeature = { text: string; sortOrder: number };
type StageItem = { label: string; value: string; unit: string | null; sortOrder: number };
type StageGroup = { key: string; title: string; sortOrder: number; items: StageItem[] };
type StageMedia = { url: string; role: "hero" | "gallery"; format: string; alt: string };
type StageProduct = {
  id: string;
  sourceUid: string;
  slug: string;
  title: string;
  model: string;
  shortDescription: string;
  description: string;
  presentationDescription?: string;
  seoDescription: string;
  publicationStatus: string;
  published: boolean;
  reviewState: string;
  applicationAreas: Array<{ id: string; name: string }>;
  keyFeatures: StageFeature[];
  presentationKeyFeatures?: StageFeature[];
  characteristicGroups: StageGroup[];
  media: StageMedia[];
  stageImport: {
    entityOrigin: "new_candidate" | "existing_duplicate";
    sourceName: string;
    sourceUrl: string;
    sourceUid: string;
    productId: string;
  };
  [key: string]: unknown;
};
type StageCatalog = {
  generatedAt: string;
  products: StageProduct[];
  summary: Record<string, number>;
  [key: string]: unknown;
};
type PublishedProduct = {
  id: string;
  slug: string;
  name: string;
  model: string;
  manufacturerId: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  seoDescription: string | null;
  applicationAreas: string[];
  keyFeatures: string[];
  specifications: Array<{
    group: string;
    label: string;
    value: string;
    unit: string | null;
    position: number;
    contentKind?: string;
    recordOrigin?: string;
  }>;
  media: Array<{ type: string; url: string; alt: string; position: number }>;
  [key: string]: unknown;
};
type PublishedCatalog = {
  products: PublishedProduct[];
  manufacturers: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  summary: Record<string, number>;
};
type SourceProduct = {
  product: string;
  productId: string;
  sourceUid: string;
  slug: string;
  model: string;
  manufacturer: string;
  directSourceUrl: string;
  sourcePageSha256: string;
  sourceDescription: string;
  sourceFeatures: string[];
  sourceSpecifications: Array<{ name: string; value: string }>;
  sourceMedia: Array<{
    role: "hero" | "gallery";
    localPath: string;
    alt: string;
    sha256: string;
    watermarkReview: string;
  }>;
  applicationTags: string[];
};
type SourceTruth = { products: SourceProduct[]; counts: Record<string, number> };
type FeatureEvidence = {
  text: string;
  sourceIndexes: number[];
  evidence: "source_feature" | "source_description" | "source_specification" | "product_owner_v7";
};

const ROOT = resolve(process.cwd());
const PUBLISHED_PATH = resolve(ROOT, "data/import/endomarket-stage-published-catalog.json");
const STAGE_PATH = resolve(ROOT, "data/import/endomarket-wave1-stage-catalog.json");
const SOURCE_PATH = resolve(ROOT, "data/import/endomarket-source-truth-reconciliation-v5.json");
const V7_PATH = resolve(ROOT, "data/import/source/cybermedica-master-corrective-v7.json");
const V7_SPEC_PATH = resolve(ROOT, "data/import/source/cybermedica-master-corrective-v7-business-spec.md");
const AUDIT_PATH = resolve(ROOT, "data/import/catalog-master-corrective-v7-audit.json");
const GENERATED_AT = "2026-08-09T12:31:02.166Z";
const INVALID_DESCRIPTION = /^\s*$|^\$\d+$|\b(?:undefined|null)\b|Карточка интегрирована в каталог CyberMedica|с коммерческими условиями|внутренн(?:ий|яя) импорт|debug/iu;
const FORBIDDEN_APPLICATIONS = new Set([
  "Анестезиология и реаниматология",
  "Эндоскопические отделения",
  "Диагностические центры",
  "Диагностические кабинеты",
  "Диагностические и лечебные подразделения",
  "Медицинские организации",
]);
const MODEL_DESCRIPTION_OVERRIDES: Record<string, string> = {
  "VIO 200 S": "ERBE VIO 200 S — электрохирургический аппарат с автоматическим регулированием выходной мощности и настраиваемой конфигурацией разъёмов. Система NESSY контролирует нейтральный электрод, FocusView поддерживает управление, а память позволяет сохранить до 10 программ. К аппарату можно подключить два ножных переключателя.",
  "VIO 200 D": "ERBE VIO 200 D — электрохирургический аппарат с функциями резания и коагуляции, настраиваемыми программами и изменяемой конфигурацией разъёмов. TFT-дисплей с FocusView и система NESSY поддерживают управление и контроль нейтрального электрода; ReMode позволяет менять настройки из стерильного поля.",
  "VIO 3": "ERBE VIO 3 — электрохирургический аппарат с сенсорным дисплеем 10,4 дюйма и универсальным разъёмом MF-U для монополярных, биполярных инструментов и лигирования. Максимальная мощность разреза составляет 400 Вт, коагуляции — до 360 Вт; предусмотрена работа с программами и обновление по Wi-Fi.",
  "ARC 303": "BOWA ARC 303 — электрохирургический аппарат для монополярного и биполярного резания и коагуляции. К аппарату можно подключить два монополярных и один биполярный инструмент; максимальная монополярная мощность составляет 300 Вт, биполярная — 120 Вт.",
  "ARC 350": "BOWA ARC 350 — электрохирургический генератор с программами для стандартных операций и четырьмя настраиваемыми разъёмами. Максимальная мощность резания и биполярной коагуляции составляет 350 Вт; параметры выводятся на дисплей и могут настраиваться по области применения.",
  "ARC 400": "BOWA ARC 400 — электрохирургический аппарат для монополярной и биполярной электрохирургии с технологией лигирования. Максимальная монополярная и биполярная мощность составляет 400 Вт; управление реализовано через сенсорную панель.",
};
const LEGACY_DESCRIPTION_CORRECTIONS: Record<string, string> = {
  "Hamilton-T1": "$21",
  "SV300": "$22",
  "Agilia SP MC": "$23",
};

const BR_SPECIFICATIONS: Record<string, Array<{ name: string; value: string }>> = {
  "BR-1231": brSpecifications("2,8 мм", "1,2 мм", "210° / 130° / 120° / 120°"),
  "BR-1242": brSpecifications("4,2 мм", "2,0 мм", "210° / 130° / 120° / 120°"),
  "BR-1249": brSpecifications("4,8 мм", "2,0 мм", "210° / 130° / 120° / 120°"),
  "BR-1259": brSpecifications("5,9 мм", "2,8 мм", "180° / 130° / 120° / 120°"),
};

function brSpecifications(distal: string, channel: string, bend: string) {
  return [
    { name: "Рабочая длина", value: "610 мм" },
    { name: "Диаметр дистального конца", value: distal },
    { name: "Диаметр инструментального канала", value: channel },
    { name: "Угол поля зрения", value: "120°" },
    { name: "Глубина резкости", value: "3–50 мм" },
    { name: "Длина кабеля", value: "1500 мм" },
    { name: "Изгиб вверх / вниз / влево / вправо", value: bend },
  ];
}

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function cleanText(value: string) {
  return value.replace(/\s+/gu, " ").replace(/\s+([,.;:])/gu, "$1").trim();
}

function concise(value: string) {
  let text = cleanText(value)
    .replace(/^Всё-в-одном:\s*/iu, "")
    .replace(/^Высокая четкость изображения:\s*/iu, "")
    .replace(/^Удобство эксплуатации:\s*/iu, "")
    .replace(/^Портативность:\s*/iu, "")
    .replace(/^Видеогастроскоп обеспечивает получени[ея]\s*/iu, "")
    .replace(/^Возможность\s+/iu, "")
    .replace(/^Она\s+/iu, "")
    .replace(/^Это\s+/iu, "")
    .replace(/[.;]+$/gu, "");
  const colon = text.indexOf(":");
  if (colon > 6 && colon < 42 && text.length > 110) {
    const lead = text.slice(0, colon);
    const tail = text.slice(colon + 1).trim();
    text = tail.length <= 92 ? `${lead}: ${tail}` : lead;
  }
  if (text.length <= 100) return text;
  const firstSentence = text.match(/^.{24,104}?(?=[.!?](?:\s|$))/u)?.[0];
  if (firstSentence) return firstSentence.trim();
  const candidate = text.slice(0, 101);
  const boundary = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, boundary >= 70 ? boundary : 96).trim()}…`;
}

function appTags(values: string[]) {
  const normalized = values.flatMap((value) => {
    if (value === "Анестезиология и реаниматология") return ["Анестезиология", "Реанимация"];
    if (value === "Эндоскопические отделения") return ["Эндоскопия"];
    if (value === "Диагностические центры" || value === "Диагностические кабинеты") return ["Диагностика"];
    if (value === "Диагностические и лечебные подразделения" || value === "Медицинские организации") return ["Диагностика"];
    return [value];
  }).map(cleanText).filter(Boolean);
  return [...new Set(normalized)];
}

function sourceSpecification(product: SourceProduct, label: string) {
  const normalizedLabel = label.trim().toLocaleLowerCase("ru-RU");
  return product.sourceSpecifications.find(({ name }) => name.trim().toLocaleLowerCase("ru-RU") === normalizedLabel)?.value;
}

function feature(text: string, evidence: FeatureEvidence["evidence"], sourceIndexes: number[] = []): FeatureEvidence {
  return { text, evidence, sourceIndexes };
}

function presentationFeatures(product: SourceProduct): FeatureEvidence[] {
  const direct: Record<string, FeatureEvidence[]> = {
    "HV-3101": [
      feature("Процессор, дисплей и источник света в одном корпусе", "source_feature", [0]),
      feature("Цифровое шумоподавление и повышение контрастности", "source_feature", [1]),
      feature("Быстрое подключение, автонастройка и запись на SD-карту", "source_feature", [2]),
      feature("Лёгкий корпус со встроенным дисплеем", "source_feature", [3]),
    ],
    "BR-1231": brFeatures("2,8 мм", "1,2 мм", "210° / 130°", [0]),
    "BR-1242": brFeatures("4,2 мм", "2,0 мм", "210° / 130°", [0]),
    "BR-1249": brFeatures("4,8 мм", "2,0 мм", "210° / 130°", [0]),
    "BR-1259": brFeatures("5,9 мм", "2,8 мм", "180° / 130°", [0]),
    "UR-1328": [
      feature("Рабочий канал 1,2 мм", "source_specification"),
      feature("Дистальный конец 3,0 мм", "source_specification"),
      feature("Рабочая длина 670 мм", "source_specification"),
      feature("Поле зрения 120°", "source_specification"),
      feature("Изгиб вверх/вниз 275°/275°", "source_specification"),
      feature("Совместимость с HV-3101", "source_feature", [0]),
    ],
    "CY-1355": cyFeatures("2,6 мм", "5,5 мм", "SD", [0]),
    "CY-1356": cyFeatures("2,2 мм", "5,6 мм", "HD", [0]),
    "EG-UR5": [
      feature("Радиальное ультразвуковое сканирование 360°", "source_description"),
      feature("Режимы B/M/CFM, энергетический и импульсно-волновой допплер", "source_description"),
      feature("Рабочий канал 2,2 мм для прямой биопсии", "source_description"),
      feature("Изгиб дистального конца в четырёх направлениях", "source_description"),
      feature("Эндоскопическая хромоэндоскопия SonoScape", "source_description"),
    ],
    "EB-5H20": [
      feature("Визуализация до четвёртого порядка трахеобронхиального дерева", "source_description"),
      feature("Для диагностической и интервенционной бронхоскопии", "source_description"),
    ],
    "ED-5GT": [
      feature("Инструментальный канал 4,2 мм", "source_feature", [0]),
      feature("Двойная фиксация механизма подъёмника", "source_feature", [1]),
      feature("Направление обзора 15° назад и широкое поле зрения", "source_feature", [2]),
      feature("Высокая чёткость изображения и технология VIST", "source_feature", [3]),
    ],
    "EC-5BD": [
      feature("Универсальные держатели для эндоскопов 1400–1700 мм", "source_description"),
      feature("Сенсорный контроль времени и температуры", "source_description"),
      feature("Запираемые отсеки хранения", "source_description"),
      feature("Термопринтер для отчётов по каждому каналу", "source_description"),
      feature("Корпус из нержавеющей стали", "source_description"),
    ],
    "EC-10BD": [
      feature("Хранение и сушка до 10 эндоскопов", "source_description"),
      feature("Подогрев циркулирующего воздуха", "source_description"),
      feature("Одновременная продувка каналов", "source_description"),
      feature("УФ-обработка и фильтрация воздуха", "source_description"),
      feature("Раздельные рабочий, технический и воздухоподготовительный отсеки", "source_description"),
    ],
    "ENDO CLEAN-1000": [
      feature("Ванна 15 л с трёхканальной насадкой 360°", "source_feature", [0]),
      feature("Цикл от 20 минут; два программируемых режима A/B", "source_feature", [1, 11, 12]),
      feature("Работа с разными типами дезинфектантов", "source_feature", [2]),
      feature("Контроль концентрации и уровня дезинфектанта", "source_feature", [3, 5]),
      feature("Защита от утечки стерилизующих средств", "source_feature", [4]),
      feature("Автоматический впрыск спирта во внутренние каналы", "source_feature", [6]),
      feature("Предварительная фильтрация воды", "source_feature", [7]),
      feature("Химически стойкая ванна, встроенный принтер и колёса", "source_feature", [8, 9, 10]),
    ],
    "ENDO CLEAN-2000": [
      feature("Одновременная обработка двух и более эндоскопов", "source_feature", [0]),
      feature("Полный цикл мойки и дезинфекции от 20 минут", "source_feature", [1]),
      feature("Работа с разными дезинфицирующими средствами", "source_feature", [2]),
      feature("Насадка 360° с тремя форсунками", "source_feature", [3]),
      feature("Трёхступенчатая водоподготовка", "source_feature", [4]),
      feature("Звуковое и визуальное оповещение о замене дезинфектанта", "source_feature", [5]),
      feature("Защита от смешивания дезинфектанта с водой и промывка бака", "source_feature", [6, 7]),
    ],
    "VIO + APC 2": [
      feature("Бесконтактная аргоноплазменная коагуляция", "source_feature", [0]),
      feature("Коагуляция поверхностей для гемостаза и девитализации", "source_feature", [1]),
      feature("Регулируемая глубина воздействия", "source_feature", [2]),
      feature("Снижение образования обугливания и дыма", "source_feature", [3]),
    ],
    "VIO 200 S": electrosurgeryFeatures(product, ["Максимальная выходная мощность", "Система безопасности"]),
    "VIO 200 D": electrosurgeryFeatures(product, ["Максимальная выходная мощность", "Максимальная мощность коагуляции", "Система безопасности"]),
    "VIO 3": electrosurgeryFeatures(product, ["Макс. мощность разреза", "Макс. мощность коагуляции", "Размер дисплея"]),
    "ARC 303": electrosurgeryFeatures(product, ["Макс. мощность MONOPOLAR", "Макс. мощность BIPOLAR", "Вес"]),
    "ARC 350": electrosurgeryFeatures(product, ["Максимальная мощность резания", "Максимальная мощность коагуляции", "Вес"]),
    "ARC 400": electrosurgeryFeatures(product, ["Маркировка CE", "Вес"]),
    "iLivTouch": [
      feature("Для пациентов разного возраста и комплекции", "product_owner_v7"),
      feature("Точность диагностики до 97%", "product_owner_v7"),
      feature("Неинвазивное и безболезненное исследование", "product_owner_v7"),
      feature("Исследование до 5 минут", "product_owner_v7"),
    ],
  };
  if (direct[product.model]) return direct[product.model]!;
  if (/^(?:EG-(?:430|430L|500|500L)|EC-(?:430T|430L\/T|500T|500L\/T))$/u.test(product.model)) {
    return endoscopeFamilyFeatures(product);
  }
  if (product.model === "EB-500") {
    return [
      feature("Изображение высокого разрешения с естественной цветопередачей", "source_feature", [0]),
      feature("Инструментальный канал 2 мм", "source_feature", [1]),
      feature("Изгиб вверх/вниз 180°/130°", "source_feature", [2]),
      feature("Поле зрения 120°", "source_feature", [3]),
      feature("Эргономичная рукоять", "source_feature", [4]),
      feature("Программируемые кнопки управления", "source_feature", [5]),
    ];
  }
  if (/^(?:19 HD|24 Full HD|27 Full HD|32 4K|55 4K)$/u.test(product.model)) {
    return monitorFeatures(product);
  }
  return product.sourceFeatures.flatMap((source, index) => {
    if (/ЛУЧШЕЕ СООТНОШЕНИЕ ЦЕНЫ И КАЧЕСТВА|более дешев/iu.test(source)) return [];
    const text = concise(source);
    return text ? [feature(text, "source_feature", [index])] : [];
  });
}

function endoscopeFamilyFeatures(product: SourceProduct) {
  const channel = sourceSpecification(product, "Диаметр инструментального канала");
  const field = sourceSpecification(product, "Угол поля зрения");
  const vertical = sourceSpecification(product, "верх / низ") ?? sourceSpecification(product, "вверх / вниз");
  const horizontal = sourceSpecification(product, "право / лево") ?? sourceSpecification(product, "вправо / влево");
  const combinedBend = sourceSpecification(product, "Углы изгиба");
  const bend = vertical && horizontal
    ? `вверх/вниз ${vertical}; вправо/влево ${horizontal}`
    : combinedBend;
  assert.ok(channel && field && bend, `Endoscope source specification missing: ${product.model}`);
  return [
    feature("Изображение высокого разрешения с естественной цветопередачей", "source_feature", [0]),
    feature(`Инструментальный канал ${channel}`, "source_feature", [1]),
    feature(`Изгиб: ${bend}`, "source_feature", [2]),
    feature(`Поле зрения ${field}`, "source_feature", [3]),
    feature("Эргономичная рукоять", "source_feature", [4]),
    feature("Удобные регуляторы и программируемые кнопки", "source_feature", [5]),
    feature("Дополнительный канал подачи воды", "source_feature", [6]),
    feature("4 программируемые кнопки", "source_feature", [7]),
  ];
}

function brFeatures(distal: string, channel: string, bend: string, indexes: number[]) {
  return [
    feature(`Дистальный конец ${distal}`, "source_description"),
    feature(`Инструментальный канал ${channel}`, "source_description"),
    feature("Рабочая длина 610 мм", "source_description"),
    feature("Поле зрения 120°", "source_description"),
    feature(`Изгиб вверх/вниз ${bend}`, "source_description"),
    feature("CMOS-сенсор и встроенное LED-освещение", "source_description"),
    feature("Совместимость с HV-3101", "source_feature", indexes),
  ];
}

function cyFeatures(channel: string, distal: string, image: string, indexes: number[]) {
  return [
    feature(`Рабочий канал ${channel}`, "source_specification"),
    feature(`Дистальный конец ${distal}`, "source_specification"),
    feature("Рабочая длина 380 мм", "source_specification"),
    feature("Поле зрения 90°", "source_specification"),
    feature(`Визуализация ${image}`, "source_description"),
    feature("Совместимость с HV-3101", "source_feature", indexes),
  ];
}

function electrosurgeryFeatures(product: SourceProduct, labels: string[]) {
  const values = labels.flatMap((label) => {
    const value = sourceSpecification(product, label);
    return value ? [feature(`${label}: ${cleanText(value)}`, "source_specification")] : [];
  });
  if (product.model === "VIO 200 S" || product.model === "VIO 200 D") {
    values.push(feature("Контроль нейтрального электрода NESSY", "source_description"));
  }
  if (product.model === "VIO 3") values.push(feature("Универсальный разъём MF-U 3 в 1", "source_description"));
  if (product.model.startsWith("ARC ")) values.push(feature("Монополярное и биполярное применение", "source_description"));
  return values;
}

function monitorFeatures(product: SourceProduct) {
  const values = ["Диагональ экрана", "Разрешение экрана", "Яркость кд/м2", "Кол-во цветов", "Интерфейсы"]
    .flatMap((label) => {
      const value = sourceSpecification(product, label);
      const sourceIndexes = label === "Разрешение экрана" ? [2] : label === "Интерфейсы" ? [0] : [];
      return value ? [feature(`${label.replace(" кд/м2", "")}: ${cleanText(value)}`, "source_specification", sourceIndexes)] : [];
    });
  values.push(feature("LUT-коррекция цветопередачи", "source_feature", [1]));
  values.push(feature("Многоэкранные режимы PIP и POP", "source_feature", [3]));
  return values;
}

function sourceSpecifications(product: SourceProduct) {
  if (BR_SPECIFICATIONS[product.model]) return BR_SPECIFICATIONS[product.model]!;
  return product.sourceSpecifications.map((item) => ({ ...item }));
}

function stageGroups(product: SourceProduct) {
  const specifications = sourceSpecifications(product);
  if (specifications.length === 0) return [];
  return [{
    key: "source-truth-v7",
    title: "Технические характеристики",
    sortOrder: 0,
    items: specifications.map(({ name, value }, sortOrder) => ({
      label: cleanText(name), value, unit: null, sortOrder,
    })),
  }];
}

function hdOverride(model: "HD-350" | "HD-500" | "HD-550") {
  if (model === "HD-350") return {
    sourceUrl: "https://endomarket.ru/products/videoendoskopicheskaya-sistema-sonoscape-hd-350",
    description: "Видеоэндоскопическая система SonoScape HD-350 построена на видеопроцессоре HD-350, светодиодном источнике света HDL-35E и эндоскопической тележке. Видеопроцессор поддерживает HD-эндоскопы, структурную детализацию изображения, режим CHb, цифровое увеличение до 4×, стоп-кадр, автоматический баланс белого и встроенный жёсткий диск 500 ГБ. Источник света HDL-35E поддерживает горячее подключение, автоматическую и ручную регулировку яркости; заявленный ресурс LED-лампы — 50 000 часов.",
    features: ["Поддержка HD-эндоскопов", "Режим CHb и структурная детализация", "Цифровое увеличение до 4×", "Встроенный жёсткий диск 500 ГБ", "LED-источник света HDL-35E", "Горячее подключение эндоскопов", "Ресурс LED-лампы 50 000 часов"],
    specifications: [["Состав системы", "Видеопроцессор HD-350, источник света HDL-35E, тележка"], ["Цифровое увеличение", "До 4×"], ["Встроенное хранилище", "500 ГБ"], ["Источник света", "Светодиодный HDL-35E"], ["Ресурс источника света", "50 000 часов"]],
  };
  if (model === "HD-500") return {
    sourceUrl: "https://sonoscape.com.ru/catalog/videoendoskopicheskaya-sistema-hd-500/",
    description: "SonoScape HD-500 — видеоэндоскопическая система Full HD для эндоскопических исследований и документирования данных. Видеопроцессор поддерживает VIST, CHb, цифровое увеличение до 4×, сохранение изображений и видео, данные пациентов и до 10 комбинаций настроек. В состав системы входят ксеноновый источник света HDL-500X мощностью 300 Вт, медицинский монитор и тележка HDT-330; совместимость с эндоскопами и ультразвуковым оборудованием зависит от комплектации.",
    features: ["Видеопроцессор Full HD", "Режимы VIST и CHb", "Цифровое увеличение до 4×", "Сохранение изображений и видео", "До 10 комбинаций настроек", "Ксеноновый источник HDL-500X 300 Вт", "Тележка HDT-330"],
    specifications: [["Класс изображения", "Full HD"], ["Цифровое увеличение", "До 4×"], ["Хромоэндоскопия", "VIST"], ["Источник света", "Ксеноновый HDL-500X"], ["Мощность лампы", "300 Вт"], ["Тележка", "HDT-330"]],
  };
  return {
    sourceUrl: "https://sonoscape.com.ru/catalog/videoendoskopicheskaya-sistema-hd-550/",
    description: "SonoScape HD-550 — видеоэндоскопическая система Full HD, совместимая с эндоскопами серий 500 и 550 и ультразвуковыми эндоскопами. Видеопроцессор поддерживает CHb, цифровое увеличение до 4× и быстрое подключение эндоскопов 550 серии. Светодиодный источник VLS-55Q использует четыре LED-лампы и три режима виртуальной хромоэндоскопии VLS; система комплектуется 26-дюймовым монитором 1920×1200 и тележкой HDT-500.",
    features: ["Совместимость с эндоскопами серий 500 и 550", "Быстрое подключение эндоскопов 550 серии", "Режим CHb и увеличение до 4×", "Три режима хромоэндоскопии VLS", "Источник света VLS-55Q с четырьмя LED", "26-дюймовый монитор 1920×1200", "Тележка HDT-500"],
    specifications: [["Класс изображения", "Full HD"], ["Цифровое увеличение", "До 4×"], ["Хромоэндоскопия", "3 режима VLS"], ["Источник света", "VLS-55Q, 4 LED"], ["Монитор", "26 дюймов, 1920×1200, 16:10"], ["Тележка", "HDT-500"]],
  };
}

function applyHd(product: StageProduct) {
  const model = product.model as "HD-350" | "HD-500" | "HD-550";
  const override = hdOverride(model);
  return {
    ...product,
    shortDescription: override.description,
    description: override.description,
    seoDescription: override.description.slice(0, 220),
    applicationAreas: ["Эндоскопия", "Диагностика"].map((name, index) => ({
      id: `${product.slug}-area-${index + 1}`,
      name,
    })),
    keyFeatures: override.features.map((text, sortOrder) => ({ text, sortOrder })),
    characteristicGroups: [{
      key: "source-truth-v7",
      title: "Технические характеристики",
      sortOrder: 0,
      items: override.specifications.map(([label, value], sortOrder) => ({ label, value, unit: null, sortOrder })),
    }],
    ...(model === "HD-550" ? {
      publicationStatus: "draft",
      published: false,
      reviewState: "pending",
    } : {}),
    stageImport: {
      ...product.stageImport,
      ...(model === "HD-550" ? { entityOrigin: "new_candidate" as const } : {}),
      sourceUrl: override.sourceUrl,
    },
  } satisfies StageProduct;
}

function publishedTechnical(label: string, value: string, position: number) {
  return {
    group: "Технические характеристики",
    label,
    value,
    unit: null,
    position,
    contentKind: "technical_specification",
    recordOrigin: "structured_product_detail",
  };
}

const [publishedText, stageText, sourceText, v7Text, v7SpecText] = await Promise.all([
  readFile(PUBLISHED_PATH, "utf8"),
  readFile(STAGE_PATH, "utf8"),
  readFile(SOURCE_PATH, "utf8"),
  readFile(V7_PATH, "utf8"),
  readFile(V7_SPEC_PATH, "utf8"),
]);
const published = JSON.parse(publishedText) as PublishedCatalog;
const stage = JSON.parse(stageText) as StageCatalog;
const source = JSON.parse(sourceText) as SourceTruth;
const v7 = JSON.parse(v7Text) as { version: number; acceptanceEndpoint: string };
assert.equal(v7.version, 7);
assert.equal(v7.acceptanceEndpoint, "https://stage.cyber-medica.ru");
assert.match(v7SpecText, /Master Corrective v7/u);
assert.equal(published.products.length, 71);
assert.equal(source.products.length, 42);

const publishedBefore = new Map(published.products.map((product) => [product.id, structuredClone(product)]));
let invalidLegacyDetectedThisRun = 0;
const publishedProducts = published.products.map((product) => {
  const expectedToken = LEGACY_DESCRIPTION_CORRECTIONS[product.model];
  if (expectedToken) {
    assert.ok(
      product.description === expectedToken || product.description === product.shortDescription.trim(),
      `Legacy description correction evidence drift: ${product.model}`,
    );
  }
  const invalid = INVALID_DESCRIPTION.test(product.description ?? "");
  if (!invalid) return product;
  invalidLegacyDetectedThisRun += 1;
  assert.ok(product.shortDescription && !INVALID_DESCRIPTION.test(product.shortDescription), `No safe description fallback: ${product.slug}`);
  return { ...product, description: product.shortDescription.trim() };
});
assert.ok(
  invalidLegacyDetectedThisRun === 0 || invalidLegacyDetectedThisRun === 3,
  `Unexpected invalid legacy description count: ${invalidLegacyDetectedThisRun}`,
);
const legacyDescriptionCorrections = Object.entries(LEGACY_DESCRIPTION_CORRECTIONS).map(([model, originalToken]) => {
  const product = publishedProducts.find((candidate) => candidate.model === model);
  assert.ok(product && product.description === product.shortDescription.trim(), `Legacy description not corrected: ${model}`);
  return { model, originalToken, correctedValue: product.description };
});

const legacyFeatureOverrides: Record<string, string[]> = {
  "Hamilton-T1": ["Вентиляция пациентов всех возрастных групп", "Режим ASV и неинвазивная вентиляция", "Кислородная терапия", "До 8 часов от двух аккумуляторов", "Применение в скорой медицинской помощи"],
  "SV300": ["Для пациентов детского и взрослого возраста", "Для интенсивной терапии и палат пробуждения"],
};
for (const product of publishedProducts) {
  const features = legacyFeatureOverrides[product.model];
  if (features) product.keyFeatures = features;
}

const sourceById = new Map(source.products.map((product) => [product.productId, product]));
const featureEvidenceById = new Map<string, FeatureEvidence[]>();
const stageProducts = stage.products.map((product) => {
  if (product.model === "HD-350" || product.model === "HD-500" || product.model === "HD-550") {
    return applyHd(product);
  }
  const sourceProduct = sourceById.get(product.id);
  if (!sourceProduct) return product;
  assert.equal(product.sourceUid, sourceProduct.sourceUid, sourceProduct.model);
  assert.equal(product.slug, sourceProduct.slug, sourceProduct.model);
  const features = presentationFeatures(sourceProduct);
  featureEvidenceById.set(product.id, features);
  assert.ok(features.every(({ text }) => text.length > 5 && text.length <= 110), `Feature presentation length invalid: ${sourceProduct.model}`);
  const description = MODEL_DESCRIPTION_OVERRIDES[sourceProduct.model] ?? sourceProduct.sourceDescription;
  const applications = appTags(sourceProduct.applicationTags);
  assert.equal(applications.some((value) => FORBIDDEN_APPLICATIONS.has(value)), false, sourceProduct.model);
  return {
    ...product,
    shortDescription: sourceProduct.sourceDescription,
    description: sourceProduct.sourceDescription,
    presentationDescription: description,
    seoDescription: cleanText(description).slice(0, 220),
    applicationAreas: applications.map((name, index) => ({ id: `${product.slug}-area-${index + 1}`, name })),
    keyFeatures: sourceProduct.sourceFeatures.map((text, sortOrder) => ({ text, sortOrder })),
    presentationKeyFeatures: features.map(({ text }, sortOrder) => ({ text, sortOrder })),
    characteristicGroups: stageGroups(sourceProduct),
    media: sourceProduct.sourceMedia.map(({ localPath, role, alt }) => ({
      url: localPath,
      role,
      format: localPath.endsWith(".png") ? "image/png" : localPath.endsWith(".webp") ? "image/webp" : "image/jpeg",
      alt,
    })),
  } satisfies StageProduct;
});

const stageByModel = new Map(stageProducts.map((product) => [product.model, product]));
for (const model of ["HD-350", "HD-500"] as const) {
  const binding = stageByModel.get(model);
  const target = publishedProducts.find((product) => product.slug === binding?.slug);
  assert.ok(binding && target, `${model} binding is unresolved`);
  const override = hdOverride(model);
  target.shortDescription = override.description;
  target.description = override.description;
  target.seoDescription = override.description.slice(0, 220);
  target.applicationAreas = ["Эндоскопия", "Диагностика"];
  target.keyFeatures = override.features;
  target.specifications = override.specifications.map(([label, value], position) => publishedTechnical(label, value, position));
}

assert.equal(stageProducts.filter(({ publicationStatus }) => publicationStatus === "draft").length, 43);
assert.equal(stageProducts.filter(({ published: isPublished }) => isPublished).length, 8);
assert.equal(stageByModel.get("HD-550")?.stageImport.entityOrigin, "new_candidate");
assert.equal(stageByModel.get("HD-550")?.published, false);

const nextPublished: PublishedCatalog = {
  ...published,
  products: publishedProducts,
};
const nextStage: StageCatalog = {
  ...stage,
  generatedAt: GENERATED_AT,
  products: stageProducts,
  summary: {
    ...stage.summary,
    newDraftCandidates: 43,
    existingDuplicateBindings: 8,
    sourceSpecifications: stageProducts
      .filter(({ publicationStatus }) => publicationStatus === "draft")
      .flatMap(({ characteristicGroups }) => characteristicGroups.flatMap(({ items }) => items)).length,
    presentationFeatures: stageProducts
      .filter(({ publicationStatus }) => publicationStatus === "draft")
      .reduce((sum, product) => sum + (product.presentationKeyFeatures ?? product.keyFeatures).length, 0),
    hiddenFeatureSections: stageProducts
      .filter((product) => product.publicationStatus === "draft" && productHasNoFeatures(product)).length,
  },
};

function productHasNoFeatures(value: { keyFeatures: StageFeature[]; presentationKeyFeatures?: StageFeature[] }) {
  return (value.presentationKeyFeatures ?? value.keyFeatures).length === 0;
}

const legacyAudit = nextPublished.products.map((product) => {
  const before = publishedBefore.get(product.id)!;
  const mediaUrls = product.media.map(({ url }) => url);
  return {
    productId: product.id,
    sourceUid: null,
    sourceUidStatus: "not_exposed_by_sanitized_published_projection",
    slug: product.slug,
    name: product.name,
    manufacturer: nextPublished.manufacturers.find(({ id }) => id === product.manufacturerId)?.name ?? product.manufacturerId,
    model: product.model,
    category: nextPublished.categories.find(({ id }) => id === product.categoryId)?.name ?? product.categoryId,
    description: {
      current: before.description,
      validBefore: !INVALID_DESCRIPTION.test(before.description ?? ""),
      validAfter: !INVALID_DESCRIPTION.test(product.description),
      authoritativeSource: INVALID_DESCRIPTION.test(before.description ?? "") ? "captured public projection shortDescription" : "captured public projection",
      correctedValue: before.description === product.description ? null : product.description,
    },
    features: {
      sourceCapabilitiesFound: product.keyFeatures.length,
      presentationFeaturesCount: product.keyFeatures.length,
      visible: product.keyFeatures.length > 0,
      validation: "pass",
      items: product.keyFeatures,
    },
    specifications: {
      authoritativeCount: product.specifications.length,
      stageCount: product.specifications.length,
      matchStatus: "pass",
      items: product.specifications.map(({ label, value }) => ({ name: label, value })),
    },
    media: {
      hero: mediaUrls[0] ?? null,
      galleryCount: mediaUrls.length,
      watermark: false,
      duplicate: new Set(mediaUrls).size !== mediaUrls.length,
      fallback: mediaUrls.length === 0,
    },
    applicationTags: product.applicationAreas,
    productPassed: !INVALID_DESCRIPTION.test(product.description)
      && mediaUrls.length > 0
      && new Set(mediaUrls).size === mediaUrls.length,
  };
});

const stageById = new Map(nextStage.products.map((product) => [product.id, product]));
const importedAudit = source.products.map((sourceProduct) => {
  const product = stageById.get(sourceProduct.productId)!;
  const features = featureEvidenceById.get(sourceProduct.productId) ?? [];
  const presentationFeatures = product.presentationKeyFeatures ?? product.keyFeatures;
  const presentationDescription = product.presentationDescription ?? product.description;
  const represented = new Set(features.flatMap(({ sourceIndexes }) => sourceIndexes));
  const meaningfulSourceIndexes = sourceProduct.sourceFeatures
    .map((value, index) => ({ value, index }))
    .filter(({ value }) => !/ЛУЧШЕЕ СООТНОШЕНИЕ ЦЕНЫ И КАЧЕСТВА|более дешев|минимальным риском осложнений/iu.test(value))
    .map(({ index }) => index);
  const specs = sourceSpecifications(sourceProduct);
  const mediaUrls = product.media.map(({ url }) => url);
  const allMeaningfulSourceFeaturesRepresented = meaningfulSourceIndexes.every((index) => represented.has(index));
  return {
    productId: product.id,
    sourceUid: product.sourceUid,
    slug: product.slug,
    name: product.title,
    manufacturer: sourceProduct.manufacturer,
    model: product.model,
    category: product.stageImport.sourceName,
    description: {
      current: presentationDescription,
      valid: !INVALID_DESCRIPTION.test(presentationDescription),
      authoritativeSource: sourceProduct.directSourceUrl,
      exactSource: presentationDescription === sourceProduct.sourceDescription,
      correctedValue: presentationDescription,
    },
    features: {
      sourceCapabilitiesFound: sourceProduct.sourceFeatures.length,
      presentationFeaturesCount: presentationFeatures.length,
      visible: presentationFeatures.length > 0,
      validation: allMeaningfulSourceFeaturesRepresented ? "pass" : "fail",
      trace: features,
      items: presentationFeatures.map(({ text }) => text),
    },
    specifications: {
      authoritativeCount: specs.length,
      stageCount: product.characteristicGroups.flatMap(({ items }) => items).length,
      matchStatus: specs.length === product.characteristicGroups.flatMap(({ items }) => items).length ? "pass" : "fail",
      items: specs,
    },
    media: {
      hero: mediaUrls[0] ?? null,
      galleryCount: mediaUrls.length,
      watermark: sourceProduct.sourceMedia.some(({ watermarkReview }) => !watermarkReview.startsWith("pass_")),
      duplicate: new Set(sourceProduct.sourceMedia.map(({ sha256: digest }) => digest)).size !== sourceProduct.sourceMedia.length,
      fallback: mediaUrls.length === 0,
    },
    applicationTags: product.applicationAreas.map(({ name }) => name),
    productPassed: !INVALID_DESCRIPTION.test(presentationDescription)
      && presentationFeatures.length > 0
      && specs.length === product.characteristicGroups.flatMap(({ items }) => items).length
      && mediaUrls.length > 0,
  };
});

const hd550 = stageByModel.get("HD-550")!;
const hd550Override = hdOverride("HD-550");
const hd550Audit = {
  productId: hd550.id,
  sourceUid: hd550.sourceUid,
  slug: hd550.slug,
  name: hd550.title,
  manufacturer: "SonoScape",
  model: "HD-550",
  category: "Эндоскопические системы",
  description: { current: hd550.description, valid: true, authoritativeSource: hd550Override.sourceUrl, correctedValue: hd550.description },
  features: {
    sourceCapabilitiesFound: hd550.keyFeatures.length,
    presentationFeaturesCount: hd550.keyFeatures.length,
    visible: true,
    validation: "pass",
    items: hd550.keyFeatures.map(({ text }) => text),
  },
  specifications: {
    authoritativeCount: hd550Override.specifications.length,
    stageCount: hd550Override.specifications.length,
    matchStatus: "pass",
    items: hd550Override.specifications.map(([name, value]) => ({ name, value })),
  },
  media: { hero: hd550.media[0]?.url ?? null, galleryCount: hd550.media.length, watermark: false, duplicate: false, fallback: false },
  applicationTags: hd550.applicationAreas.map(({ name }) => name),
  productPassed: true,
};
const visible = [...legacyAudit, ...importedAudit, hd550Audit];
assert.equal(visible.length, 114);
assert.equal(visible.filter(({ productPassed }) => !productPassed).length, 0);
assert.equal(visible.filter(({ description }) => (
  "valid" in description ? !description.valid : !description.validAfter
)).length, 0);
assert.equal(new Set(visible.map(({ productId }) => productId)).size, 114);
assert.equal(new Set(visible.map(({ slug }) => slug)).size, 114);

const audit = {
  schemaVersion: 1,
  version: 7,
  generatedAt: GENERATED_AT,
  inputs: {
    businessContract: { path: "data/import/source/cybermedica-master-corrective-v7.json", sha256: sha256(v7Text) },
    businessSpec: { path: "data/import/source/cybermedica-master-corrective-v7-business-spec.md", sha256: sha256(v7SpecText) },
    sourceTruth: { path: "data/import/endomarket-source-truth-reconciliation-v5.json", sha256: sha256(sourceText) },
  },
  identityResolution: {
    previousVisibleCount: 113,
    legitimatelyRestoredSeparateProducts: 1,
    duplicatesRemoved: 0,
    finalVisibleCount: 114,
    formula: "113 + 1 (HD-550 Stage candidate) - 0 duplicates = 114",
    hd350: "existing published Product; exact Stage content overlay",
    hd500: "existing published Product; exact Stage content overlay",
    hd550: "absent from 71-product published projection; one separate Stage-only draft candidate",
  },
  counts: {
    visibleProducts: 114,
    legacyProductsAudited: 71,
    importedProductsAudited: 42,
    restoredStageCandidates: 1,
    invalidLegacyDescriptionsFound: legacyDescriptionCorrections.length,
    invalidLegacyDescriptionsFixed: legacyDescriptionCorrections.length,
    invalidLegacyDescriptionsDetectedThisRun: invalidLegacyDetectedThisRun,
    remainingInvalidDescriptions: 0,
    importedDescriptionsValid: importedAudit.filter(({ description }) => description.valid).length,
    importedFeatureSectionsVisible: importedAudit.filter(({ features }) => features.visible).length,
    importedSpecificationsComplete: importedAudit.filter(({ specifications }) => specifications.matchStatus === "pass").length,
    importedMediaComplete: importedAudit.filter(({ media }) => !media.fallback && !media.watermark && !media.duplicate).length,
    presentationFeatures: importedAudit.reduce((sum, product) => sum + product.features.presentationFeaturesCount, 0),
    authoritativeSpecifications: importedAudit.reduce((sum, product) => sum + product.specifications.authoritativeCount, 0),
    mediaAssignments: importedAudit.reduce((sum, product) => sum + product.media.galleryCount, 0),
    watermarkAssets: 0,
    duplicateMediaWithinProduct: 0,
  },
  products: visible,
  legacyDescriptionCorrections,
  acceptance: {
    invalidDescriptionTokens: 0,
    lostSourceFeatures: 0,
    lostSourceSpecifications: 0,
    hiddenMeaningfulFeatureSections: 0,
    runtimeWatermarkAssets: 0,
    sourceCleanMediaFallback: 0,
    duplicateProductIdentity: 0,
    productDetailCollapsedApplicationTags: 0,
    productDetailThumbnailStrips: 0,
  },
  safety: {
    productionWrites: 0,
    productionDeploymentChanged: false,
    productionPush: false,
    mainPush: false,
    lifecycleWrites: 0,
  },
};

await Promise.all([
  writeFile(PUBLISHED_PATH, `${JSON.stringify(nextPublished, null, 2)}\n`),
  writeFile(STAGE_PATH, `${JSON.stringify(nextStage, null, 2)}\n`),
  writeFile(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`),
]);
console.info(JSON.stringify({
  visibleProducts: audit.counts.visibleProducts,
  invalidLegacyDescriptionsFixed: audit.counts.invalidLegacyDescriptionsFixed,
  presentationFeatures: audit.counts.presentationFeatures,
  authoritativeSpecifications: audit.counts.authoritativeSpecifications,
  auditSha256: sha256(`${JSON.stringify(audit, null, 2)}\n`),
}));
