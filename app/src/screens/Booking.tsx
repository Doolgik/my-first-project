import { useMemo, useState } from 'react';
import { findStyle } from '../lib/catalog';
import { SHOP, formatSlot, mastersFor, upcomingSlots } from '../lib/shop';

interface Props {
  styleId: string;
  onBack: () => void;
}

export default function Booking({ styleId, onBack }: Props) {
  const style = findStyle(styleId);
  const masters = useMemo(() => mastersFor(styleId), [styleId]);
  const slots = useMemo(() => upcomingSlots(), []);
  const [picked, setPicked] = useState<{ masterId: string; start: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  if (confirmed && picked) {
    const master = SHOP.masters.find((m) => m.id === picked.masterId);
    return (
      <div className="screen">
        <div className="center-state">
          <div className="gate__icon">✓</div>
          <h2>Записан</h2>
          <p className="muted">
            {style?.name} · {master?.name}
            <br />
            {formatSlot(picked.start)} · {SHOP.address}
          </p>
          <p className="tiny muted" style={{ marginTop: 8 }}>
            Демонстрационная запись — в реальном шопе здесь будет запрос в его CRM.
          </p>
          <button className="btn btn--ghost btn--sm" onClick={onBack} style={{ marginTop: 16 }}>
            Назад к подбору
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="eyebrow">{SHOP.name} · {SHOP.address}</div>
      <h1>Кто это сделает</h1>
      <p className="lead">
        Мастера отсортированы по тому, насколько «{style?.name}» — их профиль.
      </p>

      <div className="card">
        {masters.map((master) => {
          const isSpecialist = master.specialties.includes(styleId);
          const masterSlots = slots.filter((s) => s.masterId === master.id).slice(0, 4);

          return (
            <div key={master.id}>
              <div className="master">
                <div className="master__avatar">{master.initials}</div>
                <div className="master__body">
                  <div className="master__name">
                    {master.name}
                    {isSpecialist && <span className="tag">профиль</span>}
                  </div>
                  <div className="master__meta">
                    {master.experience} лет · рейтинг {master.rating}
                  </div>
                </div>
                <div className="master__price">{master.price.toLocaleString('ru-RU')} ₽</div>
              </div>

              <div className="slots" style={{ marginBottom: 14 }}>
                {masterSlots.length === 0 && (
                  <span className="tiny muted">Ближайших окон нет</span>
                )}
                {masterSlots.map((slot) => {
                  const on = picked?.masterId === master.id && picked?.start === slot.start;
                  return (
                    <button
                      key={slot.start}
                      className={`slot${on ? ' slot--on' : ''}`}
                      onClick={() => setPicked({ masterId: master.id, start: slot.start })}
                    >
                      {formatSlot(slot.start)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card card--flat">
        <h2>Услуги</h2>
        {SHOP.services.map((s) => (
          <div className="metric" key={s.id}>
            <span className="muted">
              {s.name} · {s.minutes} мин
            </span>
            <span className="metric__value">{s.price.toLocaleString('ru-RU')} ₽</span>
          </div>
        ))}
      </div>

      <div className="btn-row">
        <button className="btn btn--ghost" onClick={onBack}>
          Назад
        </button>
        <button className="btn" disabled={!picked} onClick={() => setConfirmed(true)}>
          {picked ? 'Записать' : 'Выберите время'}
        </button>
      </div>
    </div>
  );
}
