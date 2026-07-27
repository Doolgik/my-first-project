import { CATALOG, type Hairstyle } from './catalog';
import { SHAPE_FORMS, type BarberInput, type FaceMetrics, type FaceShape } from './faceMetrics';

/**
 * Подбор стрижек и сборка обоснования.
 *
 * Тексты формулируются прямо, но нейтрально: описываем контур и пропорции,
 * не оценивая внешность. Формулировки собираются из шаблонов, а не пишутся
 * моделью на ходу, — так они предсказуемы и их можно вычитать один раз.
 */

export interface ScoredStyle {
  style: Hairstyle;
  score: number;
  /** Что именно сыграло в плюс — показываем барберу. */
  pros: string[];
  /** Что играет против. Показываем всегда: барберу нужна полная картина. */
  cons: string[];
}

const WEIGHTS = {
  shape: 3.0,
  texture: 2.2,
  hairline: 2.6,
  density: 1.8,
  styling: 1.6,
};

const TEXTURE_LABEL: Record<BarberInput['texture'], string> = {
  straight: 'прямые волосы',
  wavy: 'волнистые волосы',
  curly: 'кудрявые волосы',
  coily: 'жёсткий завиток',
};

export function scoreStyles(
  shape: FaceShape,
  input: BarberInput,
  metrics: FaceMetrics,
): ScoredStyle[] {
  return CATALOG.map((style) => {
    const pros: string[] = [];
    const cons: string[] = [];

    const shapeFit = style.shapeFit[shape.id];
    const textureFit = style.textureFit[input.texture];
    const hairlineFit = style.hairlineFit[input.hairline];
    const densityFit = style.densityFit[input.density];

    // Уверенность в форме лица масштабирует её вклад: на пограничном контуре
    // форма не должна перевешивать всё остальное.
    let score =
      shapeFit * WEIGHTS.shape * shape.confidence +
      textureFit * WEIGHTS.texture +
      hairlineFit * WEIGHTS.hairline +
      densityFit * WEIGHTS.density;

    const forms = SHAPE_FORMS[shape.id];
    if (shapeFit >= 2) pros.push(`профильно идёт под ${shape.label.toLowerCase()} лицо`);
    else if (shapeFit <= -1) cons.push(`спорно смотрится на ${forms.prepositional} лице`);

    if (textureFit >= 2) pros.push(`хорошо ложится на ${TEXTURE_LABEL[input.texture]}`);
    else if (textureFit <= -1) cons.push(`плохо держит форму на ${TEXTURE_LABEL[input.texture]}`);

    if (input.hairline !== 'stable') {
      if (hairlineFit >= 2) pros.push('закрывает углы линии роста');
      else if (hairlineFit <= -1) cons.push('полностью открывает линию роста');
    }

    if (input.density === 'thinning') {
      if (densityFit >= 2) pros.push('работает на небольшой плотности');
      else if (densityFit <= -1) cons.push('требует плотных волос, иначе просвечивает');
    }

    // Готовность возиться утром: если её нет, дорогие в укладке стрижки падают.
    const budget = input.styling === 'none' ? 0 : input.styling === 'quick' ? 1 : 2;
    if (style.stylingCost > budget) {
      score -= (style.stylingCost - budget) * WEIGHTS.styling * 2;
      cons.push(
        style.stylingCost === 2
          ? 'нужен фен и укладочное средство каждое утро'
          : 'нужна минута укладки после душа',
      );
    } else if (style.stylingCost === 0 && budget === 0) {
      pros.push('не требует укладки вообще');
    }

    // Заметная асимметрия — повод предпочесть стрижку с несимметричной формой.
    if (metrics.asymmetry > 0.06) {
      if (style.id === 'sidePart' || style.id === 'texturedCrop') {
        score += 1.5;
        pros.push('несимметричная форма уравновешивает разницу сторон');
      }
    }

    return { style, score, pros, cons };
  }).sort((a, b) => b.score - a.score);
}

/** Читаемый разбор пропорций из голых чисел. */
export function describeFace(
  metrics: FaceMetrics,
  shape: FaceShape,
  input: BarberInput,
): string[] {
  const r = metrics.ratios;
  const out: string[] = [];
  const pct = (v: number) => Math.round(v * 100);

  const elongation = pct(r.lengthToWidth - 1);
  if (r.lengthToWidth >= 1.55) {
    out.push(`Лицо вытянутое: высота больше ширины на ${elongation}%.`);
  } else if (r.lengthToWidth <= 1.28) {
    out.push(`Лицо компактное: высота превышает ширину всего на ${elongation}%.`);
  } else {
    out.push(`Пропорции сбалансированы: высота больше ширины на ${elongation}%.`);
  }

  if (r.jawToWidth >= 0.9) {
    out.push('Челюсть по ширине почти равна скулам — контур ближе к прямоугольному.');
  } else if (r.jawToWidth <= 0.76) {
    out.push('Челюсть заметно уже скул — контур сужается книзу.');
  } else {
    out.push('Челюсть умеренно уже скул — переход плавный.');
  }

  if (r.foreheadToJaw >= 1.15) {
    out.push('Верхняя треть шире нижней: лоб доминирует над линией челюсти.');
  } else if (r.foreheadToJaw <= 0.9) {
    out.push('Нижняя треть шире верхней: челюсть доминирует над лбом.');
  }

  const foreheadShare = pct(r.foreheadShare);
  if (r.foreheadShare >= 0.34) {
    out.push(`Лоб занимает ${foreheadShare}% высоты лица — выше среднего.`);
  } else if (r.foreheadShare <= 0.27) {
    out.push(`Лоб занимает ${foreheadShare}% высоты лица — ниже среднего.`);
  }

  if (metrics.asymmetry > 0.06) {
    out.push(
      `Стороны лица различаются на ${pct(metrics.asymmetry)}% — заметно при прямом ракурсе.`,
    );
  }

  if (input.hairline === 'receding') {
    out.push('Линия роста волос отступает в висках.');
  } else if (input.hairline === 'deep') {
    out.push('Линия роста волос отступает глубоко, углы выражены.');
  }
  if (input.density === 'thinning') {
    out.push('Плотность волос снижена в теменной зоне.');
  }

  if (shape.runnerUp) {
    out.push(
      `Контур пограничный между «${shape.label.toLowerCase()}» и «${shape.runnerUp.label.toLowerCase()}» — подбор идёт по общим для обоих правилам.`,
    );
  }

  return out;
}

/** Почему именно эта стрижка: связываем замеры с тем, что стрижка делает. */
export function explainChoice(
  scored: ScoredStyle,
  metrics: FaceMetrics,
  shape: FaceShape,
): string[] {
  const r = metrics.ratios;
  const out: string[] = [];

  const addsHeight = scored.style.effects.some((e) => e.includes('высот'));
  const addsWidth = scored.style.effects.some((e) => e.includes('ширин'));
  const opensForehead = scored.style.effects.some((e) => e.includes('открыва'));
  const coversForehead = scored.style.effects.some(
    (e) => e.includes('укорачивает лоб') || e.includes('закрывает'),
  );

  if (r.lengthToWidth >= 1.55) {
    if (addsWidth) out.push('Даёт ширину в средней зоне — уравновешивает вытянутость.');
    if (addsHeight) out.push('Добавляет высоту сверху, а лицо и так вытянутое — берём с осторожностью.');
  } else if (r.lengthToWidth <= 1.28) {
    if (addsHeight) out.push('Добавляет высоту сверху — вытягивает компактное лицо.');
    if (addsWidth) out.push('Добавляет ширину по бокам, а лицо и так широкое.');
  }

  if (r.foreheadShare >= 0.34 && coversForehead) {
    out.push('Чёлка сокращает открытую часть лба.');
  }
  if (r.foreheadShare <= 0.27 && opensForehead) {
    out.push('Открывает лоб, визуально удлиняя верхнюю треть.');
  }
  if (r.jawToWidth >= 0.9 && scored.style.effects.some((e) => e.includes('смягч'))) {
    out.push('Мягкая текстура снимает жёсткость прямой линии челюсти.');
  }
  if (r.jawToWidth <= 0.76 && scored.style.effects.some((e) => e.includes('челюст'))) {
    out.push('Подчёркивает линию челюсти, добавляя ей веса.');
  }

  if (!out.length) {
    out.push(`Нейтрально сочетается с ${SHAPE_FORMS[shape.id].instrumental} контуром.`);
  }
  return out;
}
