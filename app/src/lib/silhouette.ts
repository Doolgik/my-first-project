import type { Landmark } from './faceMetrics';

/**
 * Контур причёски поверх снятого кадра.
 *
 * Это не фотореалистичная примерка — это силуэт, построенный по реальной разметке
 * головы: объём сверху, ширина по бокам и глубина чёлки берутся из параметров
 * конкретной стрижки. Он честно показывает форму и пропорции, но не текстуру.
 * Фотореализм появится, когда подключим генерацию (см. generate.ts).
 */

export interface SilhouetteParams {
  /** Объём над макушкой в долях длины лица. */
  topHeight: number;
  /** Насколько силуэт шире (+) или уже (−) головы по бокам. */
  sideWidth: number;
  /** Глубина чёлки в долях высоты лба: 0 — лоб открыт полностью. */
  fringe: number;
  /** Форма пробора. */
  part: 'none' | 'side' | 'center';
}

export const SILHOUETTES: Record<string, SilhouetteParams> = {
  buzz: { topHeight: 0.01, sideWidth: -0.01, fringe: 0.08, part: 'none' },
  buzzFade: { topHeight: 0.02, sideWidth: -0.03, fringe: 0.08, part: 'none' },
  crew: { topHeight: 0.08, sideWidth: -0.02, fringe: 0.12, part: 'none' },
  frenchCrop: { topHeight: 0.06, sideWidth: 0.0, fringe: 0.62, part: 'none' },
  texturedCrop: { topHeight: 0.1, sideWidth: 0.01, fringe: 0.5, part: 'none' },
  caesar: { topHeight: 0.05, sideWidth: 0.0, fringe: 0.78, part: 'none' },
  pompadour: { topHeight: 0.32, sideWidth: -0.02, fringe: 0.0, part: 'none' },
  quiff: { topHeight: 0.26, sideWidth: -0.02, fringe: 0.05, part: 'none' },
  slickBack: { topHeight: 0.14, sideWidth: 0.0, fringe: 0.0, part: 'none' },
  sidePart: { topHeight: 0.14, sideWidth: 0.0, fringe: 0.2, part: 'side' },
  undercut: { topHeight: 0.2, sideWidth: -0.05, fringe: 0.1, part: 'none' },
  curtains: { topHeight: 0.09, sideWidth: 0.05, fringe: 0.55, part: 'center' },
  curlyTop: { topHeight: 0.19, sideWidth: 0.04, fringe: 0.3, part: 'none' },
  ivyLeague: { topHeight: 0.12, sideWidth: -0.01, fringe: 0.22, part: 'side' },
};

export const DEFAULT_SILHOUETTE: SilhouetteParams = {
  topHeight: 0.1,
  sideWidth: 0,
  fringe: 0.3,
  part: 'none',
};

interface P {
  x: number;
  y: number;
}

const IDX = {
  foreheadTop: 10,
  chin: 152,
  glabella: 9,
  earLeft: 234,
  earRight: 454,
  templeLeft: 21,
  templeRight: 251,
  hairLeft: 54,
  hairRight: 284,
};

/**
 * Строит SVG-path причёски в координатах кадра.
 *
 * MediaPipe размечает только лицо и не видит череп выше лба, поэтому макушка
 * достраивается пропорционально длине лица — для силуэта этого достаточно.
 */
export function buildSilhouettePath(
  landmarks: Landmark[],
  frameWidth: number,
  frameHeight: number,
  params: SilhouetteParams,
): string {
  const px = (i: number): P => ({
    x: landmarks[i].x * frameWidth,
    y: landmarks[i].y * frameHeight,
  });

  const top = px(IDX.foreheadTop);
  const chin = px(IDX.chin);
  const glabella = px(IDX.glabella);
  const earL = px(IDX.earLeft);
  const earR = px(IDX.earRight);
  const templeL = px(IDX.templeLeft);
  const templeR = px(IDX.templeRight);
  const hairL = px(IDX.hairLeft);
  const hairR = px(IDX.hairRight);

  const faceLen = Math.hypot(top.x - chin.x, top.y - chin.y);
  const faceW = Math.hypot(earL.x - earR.x, earL.y - earR.y);
  const foreheadH = Math.hypot(top.x - glabella.x, top.y - glabella.y);

  const side = faceW * params.sideWidth;
  const crownY = top.y - faceLen * (0.26 + params.topHeight);
  const crownX = top.x;

  // Боковые опоры: чуть выше уха, разведённые на sideWidth.
  const anchorL: P = { x: earL.x - side, y: (earL.y + templeL.y) / 2 };
  const anchorR: P = { x: earR.x + side, y: (earR.y + templeR.y) / 2 };

  // Нижний край причёски на лбу.
  const fringeDrop = foreheadH * params.fringe;
  const edgeL: P = { x: hairL.x, y: top.y + fringeDrop };
  const edgeR: P = { x: hairR.x, y: top.y + fringeDrop };

  const n = (v: number) => Math.round(v * 10) / 10;

  let d = `M ${n(anchorL.x)} ${n(anchorL.y)}`;
  // Левый бок вверх к макушке.
  d += ` C ${n(anchorL.x - faceW * 0.04)} ${n(templeL.y - faceLen * 0.12)},`;
  d += ` ${n(crownX - faceW * 0.5)} ${n(crownY + faceLen * 0.06)},`;
  d += ` ${n(crownX)} ${n(crownY)}`;
  // Макушка вниз к правому боку.
  d += ` C ${n(crownX + faceW * 0.5)} ${n(crownY + faceLen * 0.06)},`;
  d += ` ${n(anchorR.x + faceW * 0.04)} ${n(templeR.y - faceLen * 0.12)},`;
  d += ` ${n(anchorR.x)} ${n(anchorR.y)}`;
  // Правый висок к краю чёлки.
  d += ` L ${n(edgeR.x)} ${n(edgeR.y)}`;

  // Линия чёлки обратно налево. Пробор задаёт её форму.
  if (params.part === 'center') {
    const midY = top.y + fringeDrop * 0.35;
    d += ` C ${n(crownX + faceW * 0.2)} ${n(edgeR.y)},`;
    d += ` ${n(crownX + faceW * 0.06)} ${n(midY)},`;
    d += ` ${n(crownX)} ${n(midY)}`;
    d += ` C ${n(crownX - faceW * 0.06)} ${n(midY)},`;
    d += ` ${n(crownX - faceW * 0.2)} ${n(edgeL.y)},`;
    d += ` ${n(edgeL.x)} ${n(edgeL.y)}`;
  } else if (params.part === 'side') {
    const lowX = crownX - faceW * 0.18;
    d += ` C ${n(crownX + faceW * 0.18)} ${n(edgeR.y - fringeDrop * 0.5)},`;
    d += ` ${n(lowX + faceW * 0.1)} ${n(edgeL.y + fringeDrop * 0.35)},`;
    d += ` ${n(edgeL.x)} ${n(edgeL.y + fringeDrop * 0.15)}`;
  } else {
    d += ` C ${n(crownX + faceW * 0.22)} ${n(edgeR.y + fringeDrop * 0.18)},`;
    d += ` ${n(crownX - faceW * 0.22)} ${n(edgeL.y + fringeDrop * 0.18)},`;
    d += ` ${n(edgeL.x)} ${n(edgeL.y)}`;
  }

  d += ' Z';
  return d;
}

export const silhouetteFor = (styleId: string): SilhouetteParams =>
  SILHOUETTES[styleId] ?? DEFAULT_SILHOUETTE;
