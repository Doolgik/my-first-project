/**
 * Замеры лица по разметке MediaPipe Face Mesh (468 точек).
 *
 * Всё, что здесь считается, — это реальная геометрия кадра, а не догадка модели.
 * Точки приходят в нормализованных координатах (0..1 от размера кадра), поэтому
 * перед замерами их обязательно нужно умножить на ширину/высоту: иначе соотношение
 * сторон кадра исказит все пропорции.
 */

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Индексы канонической сетки MediaPipe, которые нам нужны. */
const IDX = {
  foreheadTop: 10,
  chinBottom: 152,
  glabella: 9,
  noseBridge: 168,
  noseTip: 1,
  faceLeft: 234,
  faceRight: 454,
  templeLeft: 21,
  templeRight: 251,
  foreheadLeft: 54,
  foreheadRight: 284,
  jawLeft: 172,
  jawRight: 397,
  chinLeft: 148,
  chinRight: 377,
  eyeOuterLeft: 33,
  eyeOuterRight: 263,
  eyeInnerLeft: 133,
  eyeInnerRight: 362,
  browLeft: 105,
  browRight: 334,
  mouthLeft: 61,
  mouthRight: 291,
  cheekLeft: 116,
  cheekRight: 345,
} as const;

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Насколько голова повёрнута/наклонена. Замеры имеют смысл только на прямом лице. */
export interface Pose {
  /** 0 — строго анфас, растёт при повороте вбок. */
  yaw: number;
  /** Наклон головы к плечу, в градусах. */
  roll: number;
  /** Кивок вперёд/назад, 0 — нейтрально. */
  pitch: number;
  frontal: boolean;
  /** Что показать на экране, если поза не годится. */
  hint: string | null;
}

export interface FaceMetrics {
  /** Пиксельные замеры — нужны для отладки и для масштабирования оверлеев. */
  raw: {
    faceLength: number;
    faceWidth: number;
    foreheadWidth: number;
    templeWidth: number;
    jawWidth: number;
    chinWidth: number;
    foreheadHeight: number;
    midFaceHeight: number;
    lowerFaceHeight: number;
    eyeSpan: number;
  };
  /** Безразмерные соотношения — на них строится вся логика подбора. */
  ratios: {
    /** Длина лица к его ширине. Главный параметр. */
    lengthToWidth: number;
    /** Челюсть относительно скул: 1.0 — одинаково широкие. */
    jawToWidth: number;
    /** Лоб относительно скул. */
    foreheadToWidth: number;
    /** Лоб относительно челюсти: >1 — верх шире низа. */
    foreheadToJaw: number;
    /** Подбородок относительно челюсти: маленькое значение — острый подбородок. */
    chinToJaw: number;
    /** Доля лба в длине лица. */
    foreheadShare: number;
    /** Доля средней зоны в длине лица. */
    midShare: number;
    /** Доля нижней зоны в длине лица. */
    lowerShare: number;
  };
  /** Отклонение левой половины от правой, 0 — идеальная симметрия. */
  asymmetry: number;
  pose: Pose;
}

export type FaceShapeId =
  | 'oval'
  | 'round'
  | 'square'
  | 'oblong'
  | 'heart'
  | 'diamond'
  | 'triangle';

export interface FaceShape {
  id: FaceShapeId;
  label: string;
  /** 0..1 — насколько уверенно форма отличается от остальных. */
  confidence: number;
  /** Вторая по счёту форма: у пограничных лиц её стоит упомянуть. */
  runnerUp: { id: FaceShapeId; label: string } | null;
}

export const SHAPE_LABELS: Record<FaceShapeId, string> = {
  oval: 'Овальное',
  round: 'Круглое',
  square: 'Квадратное',
  oblong: 'Вытянутое',
  heart: 'Сердцевидное',
  diamond: 'Ромбовидное',
  triangle: 'Треугольное',
};

/**
 * Падежные формы названий.
 *
 * Тексты обоснования читает клиент, поэтому склонение нужно настоящее:
 * «на овальном лице», «с овальным контуром», а не подстановка одной формы всюду.
 */
export const SHAPE_FORMS: Record<FaceShapeId, { prepositional: string; instrumental: string }> = {
  oval: { prepositional: 'овальном', instrumental: 'овальным' },
  round: { prepositional: 'круглом', instrumental: 'круглым' },
  square: { prepositional: 'квадратном', instrumental: 'квадратным' },
  oblong: { prepositional: 'вытянутом', instrumental: 'вытянутым' },
  heart: { prepositional: 'сердцевидном', instrumental: 'сердцевидным' },
  diamond: { prepositional: 'ромбовидном', instrumental: 'ромбовидным' },
  triangle: { prepositional: 'треугольном', instrumental: 'треугольным' },
};

function toPixels(landmarks: Landmark[], w: number, h: number): Point[] {
  return landmarks.map((p) => ({ x: p.x * w, y: p.y * h }));
}

function estimatePose(p: Point[]): Pose {
  const nose = p[IDX.noseTip];
  const left = p[IDX.faceLeft];
  const right = p[IDX.faceRight];

  // Поворот: на анфасе нос стоит посередине между краями лица.
  const dl = dist(nose, left);
  const dr = dist(nose, right);
  const yaw = Math.abs(dl - dr) / Math.max(dl, dr);

  // Наклон к плечу: угол линии глаз относительно горизонта.
  const eL = p[IDX.eyeOuterLeft];
  const eR = p[IDX.eyeOuterRight];
  const roll = (Math.atan2(eR.y - eL.y, eR.x - eL.x) * 180) / Math.PI;

  // Кивок: на нейтральной голове верх и низ лица делятся примерно поровну
  // относительно линии глаз.
  const eyeMidY = (eL.y + eR.y) / 2;
  const above = Math.abs(eyeMidY - p[IDX.foreheadTop].y);
  const below = Math.abs(p[IDX.chinBottom].y - eyeMidY);
  const pitch = (below - above * 1.6) / (below + above);

  let hint: string | null = null;
  if (yaw > 0.14) hint = 'Поверните голову прямо в камеру';
  else if (Math.abs(roll) > 9) hint = 'Держите голову ровно, без наклона';
  else if (Math.abs(pitch) > 0.22) hint = 'Не опускайте и не задирайте подбородок';

  return { yaw, roll, pitch, frontal: hint === null, hint };
}

export function computeMetrics(
  landmarks: Landmark[],
  frameWidth: number,
  frameHeight: number,
): FaceMetrics {
  const p = toPixels(landmarks, frameWidth, frameHeight);

  const faceLength = dist(p[IDX.foreheadTop], p[IDX.chinBottom]);
  const faceWidth = dist(p[IDX.faceLeft], p[IDX.faceRight]);
  const foreheadWidth = dist(p[IDX.foreheadLeft], p[IDX.foreheadRight]);
  const templeWidth = dist(p[IDX.templeLeft], p[IDX.templeRight]);
  const jawWidth = dist(p[IDX.jawLeft], p[IDX.jawRight]);
  const chinWidth = dist(p[IDX.chinLeft], p[IDX.chinRight]);
  const foreheadHeight = dist(p[IDX.foreheadTop], p[IDX.glabella]);
  const midFaceHeight = dist(p[IDX.glabella], p[IDX.noseTip]);
  const lowerFaceHeight = dist(p[IDX.noseTip], p[IDX.chinBottom]);
  const eyeSpan = dist(p[IDX.eyeOuterLeft], p[IDX.eyeOuterRight]);

  // Симметрия: сравниваем расстояния от вертикальной оси лица до парных точек.
  const axisTop = p[IDX.foreheadTop];
  const axisBottom = p[IDX.chinBottom];
  const axisDistance = (pt: Point) => {
    const vx = axisBottom.x - axisTop.x;
    const vy = axisBottom.y - axisTop.y;
    const len = Math.hypot(vx, vy) || 1;
    return ((pt.x - axisTop.x) * vy - (pt.y - axisTop.y) * vx) / len;
  };
  const pairs: [number, number][] = [
    [IDX.faceLeft, IDX.faceRight],
    [IDX.jawLeft, IDX.jawRight],
    [IDX.cheekLeft, IDX.cheekRight],
    [IDX.eyeOuterLeft, IDX.eyeOuterRight],
    [IDX.mouthLeft, IDX.mouthRight],
    [IDX.browLeft, IDX.browRight],
  ];
  const asymmetry =
    pairs.reduce((acc, [l, r]) => {
      const dLeft = Math.abs(axisDistance(p[l]));
      const dRight = Math.abs(axisDistance(p[r]));
      return acc + Math.abs(dLeft - dRight) / Math.max(dLeft, dRight, 1);
    }, 0) / pairs.length;

  const zonesTotal = foreheadHeight + midFaceHeight + lowerFaceHeight || 1;

  return {
    raw: {
      faceLength,
      faceWidth,
      foreheadWidth,
      templeWidth,
      jawWidth,
      chinWidth,
      foreheadHeight,
      midFaceHeight,
      lowerFaceHeight,
      eyeSpan,
    },
    ratios: {
      lengthToWidth: faceLength / faceWidth,
      jawToWidth: jawWidth / faceWidth,
      foreheadToWidth: foreheadWidth / faceWidth,
      foreheadToJaw: foreheadWidth / jawWidth,
      chinToJaw: chinWidth / jawWidth,
      foreheadShare: foreheadHeight / zonesTotal,
      midShare: midFaceHeight / zonesTotal,
      lowerShare: lowerFaceHeight / zonesTotal,
    },
    asymmetry,
    pose: estimatePose(p),
  };
}

/**
 * Эталонные профили форм лица.
 *
 * Это парикмахерская классификация, а не медицинская: она описывает, как контур
 * читается визуально. Вместо жёстких if-else считаем расстояние до каждого
 * эталона — так пограничные лица честно получают низкую уверенность вместо
 * уверенного вранья.
 */
const SHAPE_PROFILES: Record<
  FaceShapeId,
  { lengthToWidth: number; jawToWidth: number; foreheadToWidth: number; chinToJaw: number }
> = {
  oval: { lengthToWidth: 1.45, jawToWidth: 0.80, foreheadToWidth: 0.86, chinToJaw: 0.62 },
  round: { lengthToWidth: 1.22, jawToWidth: 0.80, foreheadToWidth: 0.84, chinToJaw: 0.70 },
  square: { lengthToWidth: 1.26, jawToWidth: 0.93, foreheadToWidth: 0.92, chinToJaw: 0.78 },
  oblong: { lengthToWidth: 1.68, jawToWidth: 0.85, foreheadToWidth: 0.88, chinToJaw: 0.70 },
  heart: { lengthToWidth: 1.45, jawToWidth: 0.74, foreheadToWidth: 0.94, chinToJaw: 0.50 },
  diamond: { lengthToWidth: 1.52, jawToWidth: 0.75, foreheadToWidth: 0.76, chinToJaw: 0.55 },
  triangle: { lengthToWidth: 1.40, jawToWidth: 0.95, foreheadToWidth: 0.78, chinToJaw: 0.72 },
};

/** Веса подобраны так, чтобы длина лица весила больше мелких признаков. */
const SHAPE_WEIGHTS = {
  lengthToWidth: 3.2,
  jawToWidth: 2.4,
  foreheadToWidth: 1.8,
  chinToJaw: 1.0,
};

export function classifyShape(metrics: FaceMetrics): FaceShape {
  const r = metrics.ratios;

  const scored = (Object.keys(SHAPE_PROFILES) as FaceShapeId[])
    .map((id) => {
      const ref = SHAPE_PROFILES[id];
      const err =
        SHAPE_WEIGHTS.lengthToWidth * Math.abs(r.lengthToWidth - ref.lengthToWidth) +
        SHAPE_WEIGHTS.jawToWidth * Math.abs(r.jawToWidth - ref.jawToWidth) +
        SHAPE_WEIGHTS.foreheadToWidth * Math.abs(r.foreheadToWidth - ref.foreheadToWidth) +
        SHAPE_WEIGHTS.chinToJaw * Math.abs(r.chinToJaw - ref.chinToJaw);
      return { id, err };
    })
    .sort((a, b) => a.err - b.err);

  const best = scored[0];
  const second = scored[1];

  // Уверенность — это отрыв от второго места, а не абсолютная близость к эталону.
  const gap = second.err - best.err;
  const confidence = Math.max(0.35, Math.min(0.95, 0.45 + gap * 1.8));

  return {
    id: best.id,
    label: SHAPE_LABELS[best.id],
    confidence,
    runnerUp:
      confidence < 0.7 ? { id: second.id, label: SHAPE_LABELS[second.id] } : null,
  };
}

/**
 * Признаки, которые сетка лица не видит в принципе: линия роста волос, густота,
 * тип завитка. Их отмечает барбер руками — притворяться, что мы их измерили,
 * было бы враньём.
 */
export interface BarberInput {
  hairline: 'stable' | 'receding' | 'deep';
  density: 'thick' | 'normal' | 'thinning';
  texture: 'straight' | 'wavy' | 'curly' | 'coily';
  /** Сколько клиент готов тратить на укладку каждое утро. */
  styling: 'none' | 'quick' | 'ready';
}

export const DEFAULT_BARBER_INPUT: BarberInput = {
  hairline: 'stable',
  density: 'normal',
  texture: 'straight',
  styling: 'quick',
};
