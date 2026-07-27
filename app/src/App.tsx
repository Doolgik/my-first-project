import { useEffect, useState } from 'react';
import Intro from './screens/Intro';
import Scan, { type ScanResult } from './screens/Scan';
import Profile from './screens/Profile';
import Result from './screens/Result';
import Booking from './screens/Booking';
import { DEFAULT_BARBER_INPUT, type BarberInput } from './lib/faceMetrics';
import { buildDemoScan, isDemoMode } from './lib/demoScan';

type Step = 'intro' | 'scan' | 'profile' | 'result' | 'booking';

const TITLES: Record<Step, string> = {
  intro: 'Barber Lab',
  scan: 'Скан',
  profile: 'Отметки мастера',
  result: 'Подбор',
  booking: 'Запись',
};

/**
 * Приложение рассчитано только на телефон: им пользуются стоя, над клиентом в
 * кресле. На широком экране показываем заглушку вместо того, чтобы растягивать
 * интерфейс, под который он не проектировался.
 */
function useIsPhone() {
  const [isPhone, setIsPhone] = useState(true);

  useEffect(() => {
    const check = () => {
      const narrow = window.innerWidth <= 620;
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      setIsPhone(narrow || coarse);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isPhone;
}

export default function App() {
  const isPhone = useIsPhone();
  // Демо-режим показывает подбор без камеры и живого клиента: для встречи с
  // барбершопом, отладки и устройств без камеры.
  const [demo] = useState(isDemoMode);
  const [step, setStep] = useState<Step>(demo ? 'result' : 'intro');
  const [scan, setScan] = useState<ScanResult | null>(demo ? buildDemoScan : null);
  const [input, setInput] = useState<BarberInput>(DEFAULT_BARBER_INPUT);
  const [styleId, setStyleId] = useState<string>('');

  if (!isPhone && !demo) {
    return (
      <div className="gate">
        <div className="gate__inner">
          <div className="gate__icon">📱</div>
          <h1>Откройте на телефоне</h1>
          <p className="lead">
            Это инструмент барбера: им пользуются в кресле, держа телефон в руке. Десктопной
            версии нет намеренно — камера, ракурсы и вся вёрстка рассчитаны на телефон.
          </p>
          <p className="tiny muted">Откройте этот же адрес на смартфоне.</p>
        </div>
      </div>
    );
  }

  const back: Partial<Record<Step, Step>> = {
    scan: 'intro',
    profile: 'scan',
    result: 'profile',
    booking: 'result',
  };

  // На экране скана свой счётчик ракурсов — второй счётчик в шапке только путал бы.
  const stepIndex: Partial<Record<Step, string>> = {
    profile: '2 / 3',
    result: '3 / 3',
  };

  return (
    <div className="app">
      {step !== 'intro' && (
        <div className="topbar">
          <button
            className="topbar__back"
            onClick={() => setStep(back[step] ?? 'intro')}
            aria-label="Назад"
          >
            ‹
          </button>
          <div className="topbar__title">{TITLES[step]}</div>
          {stepIndex[step] && <div className="topbar__step">{stepIndex[step]}</div>}
        </div>
      )}

      {step === 'intro' && <Intro onStart={() => setStep('scan')} />}

      {step === 'scan' && (
        <Scan
          onDone={(result) => {
            setScan(result);
            setStep('profile');
          }}
        />
      )}

      {step === 'profile' && (
        <Profile value={input} onChange={setInput} onNext={() => setStep('result')} />
      )}

      {step === 'result' && scan && (
        <Result
          scan={scan}
          input={input}
          demo={demo}
          onRescan={() => {
            if (demo) {
              setScan(buildDemoScan());
              return;
            }
            setScan(null);
            setStep('scan');
          }}
          onBook={(id) => {
            setStyleId(id);
            setStep('booking');
          }}
        />
      )}

      {step === 'booking' && <Booking styleId={styleId} onBack={() => setStep('result')} />}
    </div>
  );
}
