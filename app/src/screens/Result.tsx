import { useMemo, useState } from 'react';
import { classifyShape, type BarberInput } from '../lib/faceMetrics';
import { describeFace, explainChoice, scoreStyles } from '../lib/recommend';
import { buildSilhouettePath, silhouetteFor } from '../lib/silhouette';
import { isGenerationConfigured } from '../lib/generate';
import type { ScanResult } from './Scan';

interface Props {
  scan: ScanResult;
  input: BarberInput;
  onBook: (styleId: string) => void;
  onRescan: () => void;
  /** Данные синтетические — это должно быть видно на экране. */
  demo?: boolean;
}

const ANGLE_LABELS: Record<string, string> = {
  front: 'Анфас',
  right: 'Справа',
  left: 'Слева',
  back: 'Затылок',
};

const STYLING_LABEL = ['без укладки', 'минута утром', 'фен и средство'];

export default function Result({ scan, input, onBook, onRescan, demo }: Props) {
  const shape = useMemo(() => classifyShape(scan.metrics), [scan.metrics]);
  const scored = useMemo(
    () => scoreStyles(shape, input, scan.metrics),
    [shape, input, scan.metrics],
  );
  const [selectedId, setSelectedId] = useState(scored[0].style.id);

  const selected = scored.find((s) => s.style.id === selectedId) ?? scored[0];
  const description = useMemo(
    () => describeFace(scan.metrics, shape, input),
    [scan.metrics, shape, input],
  );
  const why = useMemo(
    () => explainChoice(selected, scan.metrics, shape),
    [selected, scan.metrics, shape],
  );

  const silhouettePath = useMemo(
    () =>
      buildSilhouettePath(
        scan.landmarks,
        scan.frame.width,
        scan.frame.height,
        silhouetteFor(selected.style.id),
      ),
    [scan.landmarks, scan.frame, selected.style.id],
  );

  const r = scan.metrics.ratios;
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div className="screen">
      <div className="eyebrow">Результат</div>

      {demo && (
        <div className="notice">
          <strong>Демо-режим.</strong> Снимков клиента нет — показаны схемы головы с
          синтетической разметкой. Замеры, подбор и обоснование считаются по той же логике,
          что и на живом кадре.
        </div>
      )}

      {/* Коллаж: четыре снятых ракурса, на анфасе — контур выбранной стрижки. */}
      <div className="collage">
        {(['front', 'right', 'left', 'back'] as const).map((angle) => (
          <div className="collage__cell" key={angle}>
            <img src={scan.shots[angle]} alt={ANGLE_LABELS[angle]} />
            {angle === 'front' && (
              <svg
                viewBox={`0 0 ${scan.frame.width} ${scan.frame.height}`}
                preserveAspectRatio="xMidYMid slice"
              >
                <path d={silhouettePath} fill="rgba(20, 16, 12, 0.82)" />
                <path
                  d={silhouettePath}
                  fill="none"
                  stroke="rgba(217, 154, 63, 0.9)"
                  strokeWidth={scan.frame.width * 0.006}
                />
              </svg>
            )}
            <span className="collage__label">{ANGLE_LABELS[angle]}</span>
          </div>
        ))}
      </div>

      {!isGenerationConfigured() && (
        <div className="notice">
          <strong>Это контур, а не фотопримерка.</strong> Силуэт построен по реальной разметке
          вашей головы и показывает объём и пропорции стрижки. Фотореалистичный рендер
          подключается отдельным сервисом генерации.
        </div>
      )}

      {/* Разбор внешности */}
      <div className="card">
        <div className="shape">
          <div className="shape__name">{shape.label} лицо</div>
          <div className="confidence">уверенность {pct(shape.confidence)}</div>
        </div>

        <ul className="reasons">
          {description.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="card card--flat">
        <h2>Замеры</h2>
        <div className="metric">
          <span className="muted">Высота к ширине</span>
          <span className="metric__value">{r.lengthToWidth.toFixed(2)}</span>
        </div>
        <div className="metric">
          <span className="muted">Челюсть к скулам</span>
          <span className="metric__value">{r.jawToWidth.toFixed(2)}</span>
        </div>
        <div className="metric">
          <span className="muted">Лоб к скулам</span>
          <span className="metric__value">{r.foreheadToWidth.toFixed(2)}</span>
        </div>
        <div className="metric">
          <span className="muted">Лоб к челюсти</span>
          <span className="metric__value">{r.foreheadToJaw.toFixed(2)}</span>
        </div>
        <div className="metric">
          <span className="muted">Доли зон (лоб / средняя / низ)</span>
          <span className="metric__value">
            {pct(r.foreheadShare)} · {pct(r.midShare)} · {pct(r.lowerShare)}
          </span>
        </div>
        <div className="metric">
          <span className="muted">Асимметрия</span>
          <span className="metric__value">{pct(scan.metrics.asymmetry)}</span>
        </div>
      </div>

      {/* Подбор */}
      <h2 style={{ marginTop: 6 }}>Подходящие стрижки</h2>
      <div className="styles">
        {scored.slice(0, 6).map((item, i) => (
          <button
            key={item.style.id}
            className={`style${item.style.id === selected.style.id ? ' style--active' : ''}`}
            onClick={() => setSelectedId(item.style.id)}
          >
            <span className="style__rank">{i + 1}</span>
            <span className="style__body">
              <span className="style__name">{item.style.name}</span>
              <span className="style__meta">
                {item.style.nameEn} · {STYLING_LABEL[item.style.stylingCost]} · обновлять
                раз в {item.style.refreshWeeks} нед.
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* Обоснование выбранного */}
      <div className="card" style={{ marginTop: 14 }}>
        <h2>{selected.style.name}</h2>
        <p className="tiny muted" style={{ marginTop: -4 }}>
          {selected.style.summary}
        </p>

        <div className="eyebrow" style={{ marginTop: 16 }}>Почему подходит</div>
        <ul className="reasons">
          {why.map((line) => (
            <li key={line}>{line}</li>
          ))}
          {selected.pros.map((line) => (
            <li key={line}>{line[0].toUpperCase() + line.slice(1)}</li>
          ))}
        </ul>

        {selected.cons.length > 0 && (
          <>
            <div className="eyebrow" style={{ marginTop: 16 }}>Что учесть</div>
            <ul className="reasons reasons--con">
              {selected.cons.map((line) => (
                <li key={line}>{line[0].toUpperCase() + line.slice(1)}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Технические параметры — это читает барбер, не клиент. */}
      <div className="card card--flat">
        <h2>Параметры стрижки</h2>
        <div className="metric">
          <span className="muted">Верх</span>
          <span className="metric__value">{selected.style.spec.top}</span>
        </div>
        <div className="metric">
          <span className="muted">Бока</span>
          <span className="metric__value">{selected.style.spec.sides}</span>
        </div>
        <div className="metric">
          <span className="muted">Затылок</span>
          <span className="metric__value">{selected.style.spec.back}</span>
        </div>
        {selected.style.spec.note && (
          <p className="tiny muted" style={{ marginTop: 10, marginBottom: 0 }}>
            {selected.style.spec.note}
          </p>
        )}
      </div>

      <div className="btn-row">
        <button className="btn btn--ghost" onClick={onRescan}>
          Заново
        </button>
        <button className="btn" onClick={() => onBook(selected.style.id)}>
          К мастерам
        </button>
      </div>
    </div>
  );
}
