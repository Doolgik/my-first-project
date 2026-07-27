import type { BarberInput } from '../lib/faceMetrics';

/**
 * То, что разметка лица не видит в принципе.
 *
 * MediaPipe даёт геометрию лица, но не линию роста волос, не плотность и не тип
 * завитка. Их отмечает барбер — притворяться, что мы их измерили, было бы враньём,
 * а на подбор они влияют сильнее формы лица.
 */

interface Props {
  value: BarberInput;
  onChange: (next: BarberInput) => void;
  onNext: () => void;
}

interface FieldProps<K extends keyof BarberInput> {
  label: string;
  field: K;
  options: { value: BarberInput[K]; label: string }[];
  value: BarberInput;
  onChange: (next: BarberInput) => void;
}

function Field<K extends keyof BarberInput>({
  label,
  field,
  options,
  value,
  onChange,
}: FieldProps<K>) {
  return (
    <div className="field">
      <div className="field__label">{label}</div>
      <div className="choices">
        {options.map((opt) => (
          <button
            key={String(opt.value)}
            className={`choice${value[field] === opt.value ? ' choice--on' : ''}`}
            onClick={() => onChange({ ...value, [field]: opt.value })}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Profile({ value, onChange, onNext }: Props) {
  return (
    <div className="screen">
      <div className="eyebrow">Отметки мастера</div>
      <h1>Что камера не видит</h1>
      <p className="lead">
        Разметка даёт геометрию лица, но не волосы. Эти четыре пункта влияют на подбор
        сильнее, чем форма лица.
      </p>

      <Field
        label="Линия роста волос"
        field="hairline"
        value={value}
        onChange={onChange}
        options={[
          { value: 'stable', label: 'Ровная' },
          { value: 'receding', label: 'Отступает' },
          { value: 'deep', label: 'Глубокие углы' },
        ]}
      />

      <Field
        label="Плотность"
        field="density"
        value={value}
        onChange={onChange}
        options={[
          { value: 'thick', label: 'Густые' },
          { value: 'normal', label: 'Обычные' },
          { value: 'thinning', label: 'Редеют' },
        ]}
      />

      <Field
        label="Тип волос"
        field="texture"
        value={value}
        onChange={onChange}
        options={[
          { value: 'straight', label: 'Прямые' },
          { value: 'wavy', label: 'Волнистые' },
          { value: 'curly', label: 'Кудрявые' },
          { value: 'coily', label: 'Жёсткий завиток' },
        ]}
      />

      <Field
        label="Готовность укладывать по утрам"
        field="styling"
        value={value}
        onChange={onChange}
        options={[
          { value: 'none', label: 'Никакой' },
          { value: 'quick', label: 'Минута' },
          { value: 'ready', label: 'Хоть феном' },
        ]}
      />

      <div className="btn-row">
        <button className="btn" onClick={onNext}>
          Показать подбор
        </button>
      </div>
    </div>
  );
}
