import { useCallback, useEffect, useRef, useState } from 'react';
import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import { detect, grabFrame, loadLandmarker } from '../lib/faceMesh';
import { computeMetrics, type FaceMetrics, type Landmark } from '../lib/faceMetrics';

export interface ScanResult {
  shots: Record<AngleId, string>;
  landmarks: Landmark[];
  metrics: FaceMetrics;
  frame: { width: number; height: number };
}

type AngleId = 'front' | 'right' | 'left' | 'back';

const ANGLES: { id: AngleId; label: string; hint: string; needsFace: boolean }[] = [
  { id: 'front', label: 'Анфас', hint: 'Смотрите прямо в камеру', needsFace: true },
  { id: 'right', label: 'Справа', hint: 'Поверните голову влево', needsFace: false },
  { id: 'left', label: 'Слева', hint: 'Поверните голову вправо', needsFace: false },
  { id: 'back', label: 'Затылок', hint: 'Повернитесь спиной к камере', needsFace: false },
];

/** Сколько кадров подряд поза должна быть корректной перед автоспуском. */
const STABLE_FRAMES = 14;

interface Props {
  onDone: (result: ScanResult) => void;
}

export default function Scan({ onDone }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number>(0);
  const stableRef = useRef(0);
  const stepRef = useRef(0);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  const [shots, setShots] = useState<Partial<Record<AngleId, string>>>({});
  const [hint, setHint] = useState('Наведите камеру на лицо');
  const [faceFound, setFaceFound] = useState(false);

  // Данные анфаса нужны для всех замеров — держим отдельно от снимков.
  const frontRef = useRef<{ landmarks: Landmark[]; metrics: FaceMetrics; w: number; h: number } | null>(
    null,
  );

  stepRef.current = step;

  const capture = useCallback(
    (angle: AngleId, landmarks: Landmark[] | null) => {
      const video = videoRef.current;
      if (!video) return;

      const shot = grabFrame(video);
      if (!shot) return;

      if (angle === 'front' && landmarks) {
        frontRef.current = {
          landmarks,
          metrics: computeMetrics(landmarks, video.videoWidth, video.videoHeight),
          w: video.videoWidth,
          h: video.videoHeight,
        };
      }

      setShots((prev) => {
        const next = { ...prev, [angle]: shot };
        const done = ANGLES.every((a) => next[a.id]);
        if (done && frontRef.current) {
          const f = frontRef.current;
          // Отдаём результат следующим тиком, чтобы не менять состояние во время рендера.
          setTimeout(
            () =>
              onDone({
                shots: next as Record<AngleId, string>,
                landmarks: f.landmarks,
                metrics: f.metrics,
                frame: { width: f.w, height: f.h },
              }),
            250,
          );
        }
        return next;
      });

      stableRef.current = 0;
      setStep((s) => Math.min(s + 1, ANGLES.length - 1));
    },
    [onDone],
  );

  /** Рисуем те самые линии, по которым идут замеры, — видно, что это не декорация. */
  const drawOverlay = useCallback((landmarks: Landmark[] | null, w: number, h: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.clearRect(0, 0, w, h);
    if (!landmarks) return;

    const P = (i: number) => ({ x: landmarks[i].x * w, y: landmarks[i].y * h });
    const line = (a: number, b: number, color: string) => {
      const p1 = P(a);
      const p2 = P(b);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, w * 0.004);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    };

    // Контур лица точками — показывает, что сетка держится.
    ctx.fillStyle = 'rgba(217, 154, 63, 0.55)';
    const oval = [
      10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400,
      377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
    ];
    const r = Math.max(1.5, w * 0.0035);
    oval.forEach((i) => {
      const p = P(i);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    });

    line(10, 152, 'rgba(217, 154, 63, 0.85)'); // длина лица
    line(54, 284, 'rgba(78, 168, 122, 0.8)'); // ширина лба
    line(234, 454, 'rgba(78, 168, 122, 0.8)'); // ширина скул
    line(172, 397, 'rgba(78, 168, 122, 0.8)'); // ширина челюсти
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1706 } },
          audio: false,
        });
        if (cancelled) return;

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        landmarkerRef.current = await loadLandmarker();
        if (cancelled) return;
        setStatus('ready');
        loop();
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Доступ к камере запрещён. Разрешите камеру в настройках браузера и обновите страницу.'
            : err instanceof DOMException && err.name === 'NotFoundError'
              ? 'Камера не найдена.'
              : 'Не удалось запустить камеру или загрузить модель разметки.';
        setError(message);
        setStatus('error');
      }
    }

    function loop() {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !landmarker || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const { landmarks } = detect(landmarker, video, performance.now());
      drawOverlay(landmarks, video.videoWidth, video.videoHeight);
      setFaceFound(Boolean(landmarks));

      const current = ANGLES[stepRef.current];

      if (current.needsFace) {
        if (!landmarks) {
          stableRef.current = 0;
          setHint('Лицо не найдено — подойдите ближе');
        } else {
          const metrics = computeMetrics(landmarks, video.videoWidth, video.videoHeight);
          if (metrics.pose.frontal) {
            stableRef.current += 1;
            setHint(
              stableRef.current > STABLE_FRAMES / 2 ? 'Замер идёт, не двигайтесь' : 'Держите так',
            );
            if (stableRef.current >= STABLE_FRAMES) {
              capture(current.id, landmarks);
            }
          } else {
            stableRef.current = 0;
            setHint(metrics.pose.hint ?? current.hint);
          }
        }
      } else {
        setHint(current.hint);
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [capture, drawOverlay]);

  if (status === 'error') {
    return (
      <div className="screen">
        <div className="center-state">
          <div className="gate__icon">📷</div>
          <h2>Камера недоступна</h2>
          <p className="muted tiny">{error}</p>
          <button className="btn btn--ghost btn--sm" onClick={() => location.reload()}>
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  const current = ANGLES[step];

  return (
    <div className="screen">
      <div className="eyebrow">Шаг {step + 1} из {ANGLES.length} · {current.label}</div>

      <div className="camera">
        <video ref={videoRef} playsInline muted />
        <canvas ref={canvasRef} />
        {status === 'loading' && (
          <div className="camera__hint">Загружаем модель разметки…</div>
        )}
        {status === 'ready' && (
          <>
            <div className="camera__badge">{faceFound ? '468 точек' : 'поиск лица'}</div>
            <div className={`camera__hint${hint === 'Держите так' || hint === 'Замер идёт, не двигайтесь' ? ' camera__hint--ok' : ''}`}>
              {hint}
            </div>
          </>
        )}
      </div>

      <div className="angles">
        {ANGLES.map((a, i) => (
          <div
            key={a.id}
            className={`angle${i === step ? ' angle--active' : ''}${shots[a.id] ? ' angle--done' : ''}`}
          >
            {shots[a.id] && <img src={shots[a.id]} alt={a.label} />}
            <span>{a.label}</span>
          </div>
        ))}
      </div>

      {current.needsFace ? (
        <p className="tiny muted">
          Анфас снимается автоматически, когда голова стоит ровно. По этому кадру считаются
          все пропорции — остальные ракурсы идут в коллаж.
        </p>
      ) : (
        <p className="tiny muted">
          На этом ракурсе лицо не размечается — снимок нужен только для коллажа.
        </p>
      )}

      <div className="btn-row">
        {!current.needsFace && (
          <button
            className="btn"
            disabled={status !== 'ready'}
            onClick={() => capture(current.id, null)}
          >
            Снять {current.label.toLowerCase()}
          </button>
        )}
      </div>
    </div>
  );
}
