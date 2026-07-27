import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  classifyShape,
  computeMetrics,
  DEFAULT_BARBER_INPUT,
  type BarberInput,
  type FaceShapeId,
  type Landmark,
} from '../src/lib/faceMetrics';
import { describeFace, explainChoice, scoreStyles } from '../src/lib/recommend';
import { CATALOG } from '../src/lib/catalog';
import { SHOP, mastersFor, upcomingSlots } from '../src/lib/shop';

const W = 500;
const H = 700;

/**
 * Собирает синтетическую разметку с заданными пропорциями.
 *
 * Точки расставляются симметрично относительно вертикальной оси, поэтому поза
 * получается фронтальной, а замеры воспроизводят ровно те соотношения, которые
 * подали на вход. Так проверяется вся цепочка «геометрия → метрики → форма».
 */
function buildFace(opts: {
  lengthToWidth: number;
  jawToWidth: number;
  foreheadToWidth: number;
  chinToJaw: number;
  /** Сдвиг правой половины — для проверки замера асимметрии. */
  skew?: number;
}): Landmark[] {
  const pts: Landmark[] = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5, z: 0 }));

  const cx = 250;
  const faceW = 200;
  const faceL = faceW * opts.lengthToWidth;
  const top = 90;
  const skew = opts.skew ?? 0;

  const set = (i: number, x: number, y: number) => {
    pts[i] = { x: x / W, y: y / H, z: 0 };
  };
  /** Пара симметричных точек: левая и правая. */
  const pair = (li: number, ri: number, halfWidth: number, y: number) => {
    set(li, cx - halfWidth, y);
    set(ri, cx + halfWidth + skew, y);
  };

  set(10, cx, top); // верх лба
  set(9, cx, top + faceL * 0.3); // переносица
  set(1, cx, top + faceL * 0.63); // кончик носа
  set(152, cx, top + faceL); // подбородок
  set(168, cx, top + faceL * 0.34);

  pair(234, 454, faceW / 2, top + faceL * 0.45); // ширина лица
  pair(54, 284, (faceW * opts.foreheadToWidth) / 2, top + faceL * 0.1); // ширина лба
  pair(21, 251, (faceW * opts.foreheadToWidth) / 2, top + faceL * 0.22); // виски
  pair(172, 397, (faceW * opts.jawToWidth) / 2, top + faceL * 0.82); // челюсть
  pair(148, 377, (faceW * opts.jawToWidth * opts.chinToJaw) / 2, top + faceL * 0.95);
  pair(33, 263, faceW * 0.32, top + faceL * 0.38); // внешние углы глаз
  pair(133, 362, faceW * 0.12, top + faceL * 0.38);
  pair(61, 291, faceW * 0.16, top + faceL * 0.78); // углы рта
  pair(116, 345, faceW * 0.4, top + faceL * 0.5); // скулы
  pair(105, 334, faceW * 0.2, top + faceL * 0.31); // брови

  return pts;
}

const SHAPES: Record<FaceShapeId, Parameters<typeof buildFace>[0]> = {
  oval: { lengthToWidth: 1.45, jawToWidth: 0.8, foreheadToWidth: 0.86, chinToJaw: 0.62 },
  round: { lengthToWidth: 1.22, jawToWidth: 0.8, foreheadToWidth: 0.84, chinToJaw: 0.7 },
  square: { lengthToWidth: 1.26, jawToWidth: 0.93, foreheadToWidth: 0.92, chinToJaw: 0.78 },
  oblong: { lengthToWidth: 1.68, jawToWidth: 0.85, foreheadToWidth: 0.88, chinToJaw: 0.7 },
  heart: { lengthToWidth: 1.45, jawToWidth: 0.74, foreheadToWidth: 0.94, chinToJaw: 0.5 },
  diamond: { lengthToWidth: 1.52, jawToWidth: 0.75, foreheadToWidth: 0.76, chinToJaw: 0.55 },
  triangle: { lengthToWidth: 1.4, jawToWidth: 0.95, foreheadToWidth: 0.78, chinToJaw: 0.72 },
};

const analyse = (id: FaceShapeId) => {
  const metrics = computeMetrics(buildFace(SHAPES[id]), W, H);
  return { metrics, shape: classifyShape(metrics) };
};

test('замеры воспроизводят заданные пропорции', () => {
  const metrics = computeMetrics(buildFace(SHAPES.oval), W, H);
  assert.ok(Math.abs(metrics.ratios.lengthToWidth - 1.45) < 0.01);
  assert.ok(Math.abs(metrics.ratios.jawToWidth - 0.8) < 0.01);
  assert.ok(Math.abs(metrics.ratios.foreheadToWidth - 0.86) < 0.01);
  assert.ok(Math.abs(metrics.ratios.chinToJaw - 0.62) < 0.01);
});

test('симметричное лицо считается фронтальным', () => {
  const { metrics } = analyse('oval');
  assert.equal(metrics.pose.frontal, true, metrics.pose.hint ?? '');
  assert.ok(metrics.asymmetry < 0.01);
});

test('перекошенное лицо ловится как асимметрия', () => {
  const metrics = computeMetrics(buildFace({ ...SHAPES.oval, skew: 26 }), W, H);
  assert.ok(metrics.asymmetry > 0.06, `асимметрия ${metrics.asymmetry}`);
});

test('каждая форма лица распознаётся по своим пропорциям', () => {
  (Object.keys(SHAPES) as FaceShapeId[]).forEach((id) => {
    const { shape } = analyse(id);
    assert.equal(shape.id, id, `${id} определилось как ${shape.id}`);
  });
});

test('доли зон лица дают в сумме единицу', () => {
  const { metrics } = analyse('oval');
  const sum =
    metrics.ratios.foreheadShare + metrics.ratios.midShare + metrics.ratios.lowerShare;
  assert.ok(Math.abs(sum - 1) < 1e-6);
});

const ready: BarberInput = { ...DEFAULT_BARBER_INPUT, styling: 'ready' };
const top = (id: FaceShapeId, input: BarberInput, n = 3) => {
  const { metrics, shape } = analyse(id);
  return scoreStyles(shape, input, metrics)
    .slice(0, n)
    .map((s) => s.style.id);
};

test('круглому лицу предлагают объём сверху', () => {
  const picks = top('round', ready, 4);
  assert.ok(
    picks.some((id) => ['pompadour', 'quiff', 'undercut'].includes(id)),
    `в топе: ${picks.join(', ')}`,
  );
});

test('вытянутому лицу не предлагают помпадур', () => {
  const picks = top('oblong', ready, 5);
  assert.ok(!picks.includes('pompadour'), `в топе: ${picks.join(', ')}`);
});

test('вытянутому лицу предлагают то, что даёт ширину', () => {
  const picks = top('oblong', ready, 4);
  assert.ok(
    picks.some((id) => ['curtains', 'frenchCrop', 'caesar', 'texturedCrop'].includes(id)),
    `в топе: ${picks.join(', ')}`,
  );
});

test('при отступающей линии роста зачёс назад уступает кропу', () => {
  const { metrics, shape } = analyse('oval');
  const scored = scoreStyles(shape, { ...ready, hairline: 'deep' }, metrics);
  const rank = (id: string) => scored.findIndex((s) => s.style.id === id);
  assert.ok(rank('frenchCrop') < rank('slickBack'), 'кроп должен быть выше зачёса назад');
  assert.ok(rank('caesar') < rank('pompadour'), 'цезарь должен быть выше помпадура');
});

test('без готовности укладываться в топ идут стрижки без укладки', () => {
  const { metrics, shape } = analyse('oval');
  const scored = scoreStyles(shape, { ...DEFAULT_BARBER_INPUT, styling: 'none' }, metrics);
  assert.equal(scored[0].style.stylingCost, 0, `выбрано: ${scored[0].style.name}`);
});

test('кудрявым не предлагают зачёс назад первым', () => {
  const { metrics, shape } = analyse('oval');
  const scored = scoreStyles(shape, { ...ready, texture: 'curly' }, metrics);
  const rank = (id: string) => scored.findIndex((s) => s.style.id === id);
  assert.ok(rank('curlyTop') < rank('slickBack'), 'кудрявый топ должен обходить зачёс назад');
});

test('у каждой стрижки заполнены правила и параметры', () => {
  const shapeIds: FaceShapeId[] = [
    'oval', 'round', 'square', 'oblong', 'heart', 'diamond', 'triangle',
  ];
  CATALOG.forEach((style) => {
    shapeIds.forEach((id) => {
      assert.ok(
        typeof style.shapeFit[id] === 'number',
        `${style.id}: нет правила для формы ${id}`,
      );
    });
    assert.ok(style.spec.top && style.spec.sides && style.spec.back, `${style.id}: пустой spec`);
    assert.ok(style.effects.length > 0, `${style.id}: не описаны эффекты`);
  });
});

test('идентификаторы стрижек уникальны', () => {
  const ids = CATALOG.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('у мастеров разные расписания', () => {
  // Час ночи, чтобы сегодняшние окна не отфильтровались как прошедшие.
  const from = new Date('2026-07-27T01:00:00Z');
  const slots = upcomingSlots(from, 3);
  assert.ok(slots.length > 0, 'расписание пустое');

  const byMaster = new Map<string, string>();
  SHOP.masters.forEach((m) => {
    const times = slots
      .filter((s) => s.masterId === m.id)
      .map((s) => s.start)
      .join(',');
    assert.ok(times.length > 0, `${m.name}: нет ни одного окна`);
    byMaster.set(m.id, times);
  });

  assert.equal(
    new Set(byMaster.values()).size,
    SHOP.masters.length,
    'расписания мастеров совпадают — маска занятости выродилась',
  );
});

test('расписание отдаётся по возрастанию времени', () => {
  const slots = upcomingSlots(new Date('2026-07-27T01:00:00Z'), 3);
  const sorted = [...slots].sort((a, b) => a.start.localeCompare(b.start));
  assert.deepEqual(slots, sorted);
});

test('мастера-профильники идут первыми', () => {
  const ranked = mastersFor('pompadour');
  assert.ok(
    ranked[0].specialties.includes('pompadour'),
    `первым идёт ${ranked[0].name}, не специалист`,
  );
});

test('тексты обоснования склоняются правильно', () => {
  // Ловим подстановку именительного падежа в места, где нужен предложный или
  // творительный: «на овальное лице», «с овальное контуром».
  const broken = /(ое|ая|ый)\s+(лице|контуром)/;

  (Object.keys(SHAPES) as FaceShapeId[]).forEach((id) => {
    const { metrics, shape } = analyse(id);
    (['none', 'quick', 'ready'] as const).forEach((styling) => {
      scoreStyles(shape, { ...DEFAULT_BARBER_INPUT, styling }, metrics).forEach((scored) => {
        const lines = [
          ...scored.pros,
          ...scored.cons,
          ...explainChoice(scored, metrics, shape),
          ...describeFace(metrics, shape, DEFAULT_BARBER_INPUT),
        ];
        lines.forEach((line) => {
          assert.ok(!broken.test(line), `кривое склонение: "${line}"`);
          assert.ok(line.trim().length > 0, 'пустая строка обоснования');
        });
      });
    });
  });
});

test('обоснование не пустует ни для одной формы лица', () => {
  (Object.keys(SHAPES) as FaceShapeId[]).forEach((id) => {
    const { metrics, shape } = analyse(id);
    const scored = scoreStyles(shape, DEFAULT_BARBER_INPUT, metrics);
    assert.ok(describeFace(metrics, shape, DEFAULT_BARBER_INPUT).length >= 2, `${id}: пустой разбор`);
    assert.ok(explainChoice(scored[0], metrics, shape).length >= 1, `${id}: нет объяснения выбора`);
  });
});
