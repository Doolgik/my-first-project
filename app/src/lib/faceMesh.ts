import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { Landmark } from './faceMetrics';

/**
 * Обёртка над MediaPipe Face Landmarker.
 *
 * Модель и WASM лежат в public/mp, а не на CDN: приложение работает в офлайне,
 * и ни один кадр не покидает телефон барбера.
 */

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

export function loadLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    const base = import.meta.env.BASE_URL;
    landmarkerPromise = FilesetResolver.forVisionTasks(`${base}mp/wasm`)
      .then((fileset) =>
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: `${base}mp/face_landmarker.task`,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
        }),
      )
      .catch((err) => {
        // Даём следующему вызову шанс повторить: иначе одна сетевая ошибка
        // навсегда ломает экран сканирования.
        landmarkerPromise = null;
        throw err;
      });
  }
  return landmarkerPromise;
}

export interface DetectResult {
  landmarks: Landmark[] | null;
}

export function detect(
  landmarker: FaceLandmarker,
  video: HTMLVideoElement,
  timestampMs: number,
): DetectResult {
  const result = landmarker.detectForVideo(video, timestampMs);
  const first = result.faceLandmarks?.[0];
  return { landmarks: first && first.length ? (first as Landmark[]) : null };
}

/** Снимок текущего кадра видео в data URL — из него собирается коллаж. */
export function grabFrame(video: HTMLVideoElement, maxWidth = 720): string {
  const scale = Math.min(1, maxWidth / video.videoWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  // Фронтальная камера показывает зеркальную картинку; в снимок пишем как есть,
  // чтобы замеры и коллаж совпадали с реальной стороной головы.
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}
