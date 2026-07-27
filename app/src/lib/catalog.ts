import type { BarberInput, FaceShapeId } from './faceMetrics';

/**
 * Каталог мужских стрижек с парикмахерскими правилами подбора.
 *
 * Оценки в shapeFit — это не «наука о форме лица», а рабочая эвристика барберов:
 * стрижка меняет видимые пропорции головы, добавляя высоту сверху или ширину по
 * бокам. Отсюда все знаки: круглому лицу нужна высота, вытянутому — ширина.
 */

/** −2 категорически не идёт · 0 нейтрально · +2 профильно подходит */
export type Fit = -2 | -1 | 0 | 1 | 2;

export interface Hairstyle {
  id: string;
  name: string;
  nameEn: string;
  /** Одна строка: что это за стрижка. */
  summary: string;
  /** Что стрижка делает с пропорциями — из этого собирается обоснование. */
  effects: string[];
  shapeFit: Record<FaceShapeId, Fit>;
  textureFit: Record<BarberInput['texture'], Fit>;
  hairlineFit: Record<BarberInput['hairline'], Fit>;
  densityFit: Record<BarberInput['density'], Fit>;
  /** Сколько возни утром: 0 — вообще никакой. */
  stylingCost: 0 | 1 | 2;
  /** Через сколько недель нужно обновление. */
  refreshWeeks: number;
  /** Технические параметры для барбера, а не для клиента. */
  spec: {
    top: string;
    sides: string;
    back: string;
    note?: string;
  };
}

export const CATALOG: Hairstyle[] = [
  {
    id: 'buzz',
    name: 'Бокс',
    nameEn: 'Buzz cut',
    summary: 'Одна длина машинкой по всей голове.',
    effects: ['полностью открывает контур черепа', 'не добавляет ни высоты, ни ширины'],
    shapeFit: { oval: 2, round: -1, square: 2, oblong: 0, heart: 0, diamond: -1, triangle: 1 },
    textureFit: { straight: 2, wavy: 2, curly: 1, coily: 2 },
    hairlineFit: { stable: 2, receding: 2, deep: 2 },
    densityFit: { thick: 2, normal: 2, thinning: 2 },
    stylingCost: 0,
    refreshWeeks: 2,
    spec: {
      top: 'машинка №2–3 (6–9 мм)',
      sides: 'машинка №1–2 (3–6 мм)',
      back: 'в одну длину с боками',
      note: 'Показывает форму черепа как есть — на неровном затылке будет заметно.',
    },
  },
  {
    id: 'buzzFade',
    name: 'Бокс с фейдом',
    nameEn: 'Buzz cut with fade',
    summary: 'Короткий верх, растушёванные в кожу бока.',
    effects: ['сужает бока', 'визуально приподнимает верх головы', 'подчёркивает линию челюсти'],
    shapeFit: { oval: 2, round: 1, square: 2, oblong: 0, heart: 1, diamond: 0, triangle: 2 },
    textureFit: { straight: 2, wavy: 2, curly: 1, coily: 2 },
    hairlineFit: { stable: 2, receding: 2, deep: 1 },
    densityFit: { thick: 2, normal: 2, thinning: 1 },
    stylingCost: 0,
    refreshWeeks: 2,
    spec: {
      top: 'машинка №3–4 (9–12 мм)',
      sides: 'фейд от 0 до №2, линия перехода на уровне виска',
      back: 'фейд по дуге затылка',
    },
  },
  {
    id: 'crew',
    name: 'Канадка',
    nameEn: 'Crew cut',
    summary: 'Короткие бока, чуть длиннее верх с плавным переходом ко лбу.',
    effects: ['даёт умеренную высоту сверху', 'сужает бока', 'открывает лоб'],
    shapeFit: { oval: 2, round: 2, square: 1, oblong: -1, heart: 0, diamond: 1, triangle: 2 },
    textureFit: { straight: 2, wavy: 2, curly: 0, coily: 0 },
    hairlineFit: { stable: 2, receding: 0, deep: -1 },
    densityFit: { thick: 2, normal: 2, thinning: 0 },
    stylingCost: 1,
    refreshWeeks: 4,
    spec: {
      top: '3–5 см, сводится к 2 см у лба',
      sides: 'машинка №1–2 с переходом',
      back: 'плавный переход в бока',
    },
  },
  {
    id: 'frenchCrop',
    name: 'Французский кроп',
    nameEn: 'French crop',
    summary: 'Прямая чёлка вперёд, короткие бока.',
    effects: ['укорачивает лоб чёлкой', 'добавляет ширины в верхней зоне', 'не добавляет высоты'],
    shapeFit: { oval: 1, round: 0, square: 1, oblong: 2, heart: 2, diamond: 2, triangle: 0 },
    textureFit: { straight: 2, wavy: 2, curly: 1, coily: 0 },
    hairlineFit: { stable: 2, receding: 2, deep: 1 },
    densityFit: { thick: 2, normal: 2, thinning: 1 },
    stylingCost: 1,
    refreshWeeks: 4,
    spec: {
      top: '4–6 см, чёлка вперёд на лоб',
      sides: 'машинка №1–2, фейд по желанию',
      back: 'короткий, в бока',
      note: 'Рабочий вариант при отступающей линии роста: чёлка закрывает углы.',
    },
  },
  {
    id: 'texturedCrop',
    name: 'Текстурный кроп',
    nameEn: 'Textured crop',
    summary: 'Кроп с рваной, филированной текстурой сверху.',
    effects: ['даёт объём без высоты', 'маскирует редкие зоны', 'смягчает прямые линии'],
    shapeFit: { oval: 2, round: 1, square: 2, oblong: 1, heart: 2, diamond: 1, triangle: 1 },
    textureFit: { straight: 1, wavy: 2, curly: 2, coily: 1 },
    hairlineFit: { stable: 2, receding: 2, deep: 1 },
    densityFit: { thick: 2, normal: 2, thinning: 2 },
    stylingCost: 1,
    refreshWeeks: 5,
    spec: {
      top: '5–7 см, филировка, текстура матовой пастой',
      sides: 'фейд №0–2',
      back: 'фейд по затылку',
    },
  },
  {
    id: 'caesar',
    name: 'Цезарь',
    nameEn: 'Caesar cut',
    summary: 'Короткая ровная чёлка, одна длина сверху.',
    effects: ['максимально укорачивает лоб', 'даёт горизонтальную линию', 'не добавляет высоты'],
    shapeFit: { oval: 1, round: -1, square: 1, oblong: 2, heart: 2, diamond: 1, triangle: 0 },
    textureFit: { straight: 2, wavy: 1, curly: 0, coily: 0 },
    hairlineFit: { stable: 2, receding: 2, deep: 2 },
    densityFit: { thick: 2, normal: 2, thinning: 1 },
    stylingCost: 0,
    refreshWeeks: 4,
    spec: {
      top: '3–4 см в одну длину',
      sides: 'машинка №2',
      back: 'машинка №2',
      note: 'Самый прямой способ закрыть высокий лоб.',
    },
  },
  {
    id: 'pompadour',
    name: 'Помпадур',
    nameEn: 'Pompadour',
    summary: 'Крупный объём сверху, зачёсанный назад и вверх.',
    effects: ['сильно добавляет высоты', 'вытягивает лицо вверх', 'полностью открывает лоб'],
    shapeFit: { oval: 2, round: 2, square: 1, oblong: -2, heart: -1, diamond: 0, triangle: 2 },
    textureFit: { straight: 2, wavy: 2, curly: 0, coily: -1 },
    hairlineFit: { stable: 2, receding: -2, deep: -2 },
    densityFit: { thick: 2, normal: 1, thinning: -2 },
    stylingCost: 2,
    refreshWeeks: 4,
    spec: {
      top: '10–15 см, объём от корней',
      sides: 'фейд или машинка №1–2',
      back: 'плавный переход',
      note: 'Требует фена и помады каждое утро. Без укладки не работает.',
    },
  },
  {
    id: 'quiff',
    name: 'Квифф',
    nameEn: 'Quiff',
    summary: 'Объём надо лбом, зачёсанный вверх и слегка назад.',
    effects: ['добавляет высоты', 'открывает лоб', 'сужает верхнюю зону визуально'],
    shapeFit: { oval: 2, round: 2, square: 2, oblong: -2, heart: -1, diamond: 1, triangle: 2 },
    textureFit: { straight: 2, wavy: 2, curly: 1, coily: 0 },
    hairlineFit: { stable: 2, receding: -1, deep: -2 },
    densityFit: { thick: 2, normal: 2, thinning: -1 },
    stylingCost: 2,
    refreshWeeks: 4,
    spec: {
      top: '8–12 см, короче к затылку',
      sides: 'фейд №0–2',
      back: 'короткий',
    },
  },
  {
    id: 'slickBack',
    name: 'Зачёс назад',
    nameEn: 'Slick back',
    summary: 'Волосы зачёсаны назад по всей длине.',
    effects: ['полностью открывает лоб и линию роста', 'вытягивает лицо', 'сужает силуэт'],
    shapeFit: { oval: 2, round: 1, square: 2, oblong: -1, heart: -2, diamond: 0, triangle: 1 },
    textureFit: { straight: 2, wavy: 1, curly: -1, coily: -2 },
    hairlineFit: { stable: 2, receding: -2, deep: -2 },
    densityFit: { thick: 2, normal: 1, thinning: -2 },
    stylingCost: 2,
    refreshWeeks: 6,
    spec: {
      top: 'от 12 см',
      sides: 'средние, зачёсываются назад',
      back: 'средний',
      note: 'Открывает линию роста целиком — все её особенности будут видны.',
    },
  },
  {
    id: 'sidePart',
    name: 'Пробор',
    nameEn: 'Side part',
    summary: 'Классический боковой пробор с укладкой набок.',
    effects: ['даёт асимметрию', 'частично прикрывает одну сторону лба', 'сдержанный силуэт'],
    shapeFit: { oval: 2, round: 1, square: 2, oblong: 1, heart: 1, diamond: 2, triangle: 1 },
    textureFit: { straight: 2, wavy: 1, curly: -1, coily: -2 },
    hairlineFit: { stable: 2, receding: 1, deep: 0 },
    densityFit: { thick: 2, normal: 2, thinning: 1 },
    stylingCost: 1,
    refreshWeeks: 5,
    spec: {
      top: '6–10 см с проделанным пробором',
      sides: 'машинка №2–3 или ножницами',
      back: 'плавный переход',
      note: 'Асимметрия пробора уравновешивает заметную разницу сторон лица.',
    },
  },
  {
    id: 'undercut',
    name: 'Андеркат',
    nameEn: 'Undercut',
    summary: 'Резкая граница: длинный верх, выбритые бока без перехода.',
    effects: ['максимально сужает бока', 'даёт вертикальный силуэт', 'жёсткий контраст'],
    shapeFit: { oval: 2, round: 2, square: 1, oblong: -1, heart: 0, diamond: 1, triangle: 2 },
    textureFit: { straight: 2, wavy: 2, curly: 1, coily: 0 },
    hairlineFit: { stable: 2, receding: -1, deep: -2 },
    densityFit: { thick: 2, normal: 2, thinning: -1 },
    stylingCost: 2,
    refreshWeeks: 3,
    spec: {
      top: 'от 10 см, без перехода',
      sides: 'машинка №0–1, чёткая граница',
      back: 'машинка №0–1',
    },
  },
  {
    id: 'curtains',
    name: 'Шторки',
    nameEn: 'Curtains',
    summary: 'Пробор посередине, волосы падают по обе стороны лба.',
    effects: ['добавляет ширины по бокам', 'закрывает виски и края лба', 'снимает высоту'],
    shapeFit: { oval: 1, round: -1, square: 1, oblong: 2, heart: 2, diamond: 2, triangle: 0 },
    textureFit: { straight: 2, wavy: 2, curly: 1, coily: -1 },
    hairlineFit: { stable: 2, receding: 1, deep: 0 },
    densityFit: { thick: 2, normal: 2, thinning: 0 },
    stylingCost: 1,
    refreshWeeks: 6,
    spec: {
      top: '12–16 см, пробор по центру',
      sides: 'средние, ножницами',
      back: 'средний',
    },
  },
  {
    id: 'curlyTop',
    name: 'Кудрявый топ',
    nameEn: 'Curly top',
    summary: 'Естественный завиток сверху, короткие бока.',
    effects: ['даёт объём во все стороны', 'смягчает угловатый контур', 'добавляет высоты'],
    shapeFit: { oval: 2, round: 1, square: 2, oblong: 0, heart: 1, diamond: 1, triangle: 2 },
    textureFit: { straight: -2, wavy: 1, curly: 2, coily: 2 },
    hairlineFit: { stable: 2, receding: 1, deep: 0 },
    densityFit: { thick: 2, normal: 2, thinning: 0 },
    stylingCost: 1,
    refreshWeeks: 6,
    spec: {
      top: '7–12 см, работа по завитку, без филировки насухо',
      sides: 'фейд №0–2',
      back: 'фейд',
    },
  },
  {
    id: 'ivyLeague',
    name: 'Ivy League',
    nameEn: 'Ivy League',
    summary: 'Удлинённая канадка с возможностью пробора.',
    effects: ['умеренная высота', 'аккуратный сдержанный силуэт', 'открывает лоб частично'],
    shapeFit: { oval: 2, round: 1, square: 2, oblong: 0, heart: 1, diamond: 2, triangle: 1 },
    textureFit: { straight: 2, wavy: 2, curly: 0, coily: -1 },
    hairlineFit: { stable: 2, receding: 0, deep: -1 },
    densityFit: { thick: 2, normal: 2, thinning: 0 },
    stylingCost: 1,
    refreshWeeks: 5,
    spec: {
      top: '5–8 см, длиннее у лба',
      sides: 'машинка №2 с переходом',
      back: 'плавный переход',
    },
  },
];

export const findStyle = (id: string) => CATALOG.find((s) => s.id === id);
