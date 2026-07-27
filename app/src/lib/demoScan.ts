import { computeMetrics, type Landmark } from './faceMetrics';
import type { ScanResult } from '../screens/Scan';

/**
 * Демонстрационный скан для режима `?demo`.
 *
 * Нужен, чтобы показать экран подбора без живого клиента: на встрече с
 * барбершопом, при отладке и на устройстве без камеры. Разметка синтетическая,
 * но проходит через тот же расчёт метрик, что и настоящая, а плейсхолдеры
 * нарисованы по тем же координатам — поэтому контур причёски садится на голову
 * ровно так же, как на реальном кадре.
 */

const FRAME = { width: 500, height: 700 };

const CX = 250;
const FACE_W = 200;
const TOP = 130;
const FACE_L = FACE_W * 1.42;

/** Пропорции «среднего» мужского лица — ближе всего к овальному контуру. */
const PROPORTIONS = {
  jawToWidth: 0.84,
  foreheadToWidth: 0.88,
  chinToJaw: 0.66,
};

function buildLandmarks(): Landmark[] {
  const pts: Landmark[] = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5, z: 0 }));

  const set = (i: number, x: number, y: number) => {
    pts[i] = { x: x / FRAME.width, y: y / FRAME.height, z: 0 };
  };
  const pair = (li: number, ri: number, halfWidth: number, y: number) => {
    set(li, CX - halfWidth, y);
    set(ri, CX + halfWidth, y);
  };

  set(10, CX, TOP);
  set(9, CX, TOP + FACE_L * 0.3);
  set(1, CX, TOP + FACE_L * 0.63);
  set(152, CX, TOP + FACE_L);
  set(168, CX, TOP + FACE_L * 0.34);

  pair(234, 454, FACE_W / 2, TOP + FACE_L * 0.45);
  pair(54, 284, (FACE_W * PROPORTIONS.foreheadToWidth) / 2, TOP + FACE_L * 0.1);
  pair(21, 251, (FACE_W * PROPORTIONS.foreheadToWidth) / 2, TOP + FACE_L * 0.22);
  pair(172, 397, (FACE_W * PROPORTIONS.jawToWidth) / 2, TOP + FACE_L * 0.82);
  pair(148, 377, (FACE_W * PROPORTIONS.jawToWidth * PROPORTIONS.chinToJaw) / 2, TOP + FACE_L * 0.95);
  pair(33, 263, FACE_W * 0.32, TOP + FACE_L * 0.38);
  pair(133, 362, FACE_W * 0.12, TOP + FACE_L * 0.38);
  pair(61, 291, FACE_W * 0.16, TOP + FACE_L * 0.78);
  pair(116, 345, FACE_W * 0.4, TOP + FACE_L * 0.5);
  pair(105, 334, FACE_W * 0.2, TOP + FACE_L * 0.31);

  return pts;
}

const svg = (body: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FRAME.width} ${FRAME.height}">` +
      `<rect width="${FRAME.width}" height="${FRAME.height}" fill="#1b1b21"/>${body}</svg>`,
  )}`;

const SKIN = '#3a3038';
const NECK = '#2f2830';

/** Голова анфас — рисуется по тем же координатам, что и разметка выше. */
function frontPlaceholder(): string {
  const cy = TOP + FACE_L / 2;
  const rx = FACE_W / 2;
  const ry = FACE_L / 2;
  return svg(
    `<rect x="${CX - 46}" y="${TOP + FACE_L - 40}" width="92" height="150" rx="30" fill="${NECK}"/>` +
      `<ellipse cx="${CX}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${SKIN}"/>` +
      `<ellipse cx="${CX - 64}" cy="${TOP + FACE_L * 0.38}" rx="17" ry="9" fill="#0f0d10"/>` +
      `<ellipse cx="${CX + 64}" cy="${TOP + FACE_L * 0.38}" rx="17" ry="9" fill="#0f0d10"/>` +
      `<path d="M ${CX - 34} ${TOP + FACE_L * 0.78} q 34 16 68 0" stroke="#0f0d10" stroke-width="7" fill="none" stroke-linecap="round"/>`,
  );
}

/** Профиль: тот же овал, сдвинутый и суженный, плюс силуэт носа. */
function profilePlaceholder(dir: 1 | -1): string {
  const cy = TOP + FACE_L / 2;
  const cx = CX + dir * 18;
  const noseX = cx + dir * 74;
  return svg(
    `<rect x="${cx - 46}" y="${TOP + FACE_L - 40}" width="92" height="150" rx="30" fill="${NECK}"/>` +
      `<ellipse cx="${cx}" cy="${cy}" rx="${FACE_W * 0.42}" ry="${FACE_L / 2}" fill="${SKIN}"/>` +
      `<path d="M ${cx + dir * 60} ${cy - 30} L ${noseX} ${cy + 6} L ${cx + dir * 56} ${cy + 26} Z" fill="${SKIN}"/>` +
      `<circle cx="${cx - dir * 40}" cy="${cy + 4}" r="15" fill="${NECK}"/>`,
  );
}

/** Затылок: лица нет, только контур головы и шея. */
function backPlaceholder(): string {
  const cy = TOP + FACE_L / 2;
  return svg(
    `<rect x="${CX - 52}" y="${TOP + FACE_L - 50}" width="104" height="160" rx="32" fill="${NECK}"/>` +
      `<ellipse cx="${CX}" cy="${cy}" rx="${FACE_W * 0.52}" ry="${FACE_L * 0.48}" fill="${SKIN}"/>`,
  );
}

export function buildDemoScan(): ScanResult {
  const landmarks = buildLandmarks();
  return {
    shots: {
      front: frontPlaceholder(),
      right: profilePlaceholder(1),
      left: profilePlaceholder(-1),
      back: backPlaceholder(),
    },
    landmarks,
    // Тот же расчёт, что и на живом кадре, — демо не идёт в обход логики.
    metrics: computeMetrics(landmarks, FRAME.width, FRAME.height),
    frame: FRAME,
  };
}

/** Демо включается через `?demo` в адресе. */
export const isDemoMode = () =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo');
