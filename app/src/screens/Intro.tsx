interface Props {
  onStart: () => void;
}

export default function Intro({ onStart }: Props) {
  return (
    <div className="screen">
      <div className="eyebrow">Barber Lab · инструмент мастера</div>
      <h1>Подбор стрижки по геометрии головы</h1>
      <p className="lead">
        Снимаем четыре ракурса, размечаем лицо в 468 точках и считаем реальные пропорции.
        Дальше — подбор стрижки, обоснование и запись к мастеру.
      </p>

      <div className="card">
        <h2>Как это идёт</h2>
        <ul className="reasons">
          <li>Анфас снимается автоматически, когда голова стоит ровно</li>
          <li>Ещё три ракурса — правый, левый профиль и затылок</li>
          <li>Вы отмечаете то, что камера не видит: линию роста, плотность, тип волос</li>
          <li>На выходе — коллаж, разбор пропорций и подходящие стрижки</li>
        </ul>
      </div>

      <div className="notice">
        <strong>Снимки никуда не уходят.</strong> Разметка идёт прямо в браузере, кадры
        остаются на телефоне и стираются при закрытии вкладки. Мы не сохраняем фото и никого
        не идентифицируем.
      </div>

      <div className="btn-row">
        <button className="btn" onClick={onStart}>
          Начать скан
        </button>
      </div>
      <p className="tiny muted" style={{ textAlign: 'center', marginTop: 12 }}>
        <span className="free-badge">Бесплатно</span>
      </p>
    </div>
  );
}
