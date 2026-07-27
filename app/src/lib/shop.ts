/**
 * Настройки барбершопа: мастера, услуги, цены, расписание.
 *
 * Это то, что в реальном продукте будет приходить с бэкенда и настраиваться под
 * каждый шоп. Пока лежит здесь, чтобы экран записи работал на живых данных, а не
 * на пустых заглушках.
 */

export interface Master {
  id: string;
  name: string;
  /** Стаж в годах. */
  experience: number;
  /** id стрижек из каталога, на которых мастер специализируется. */
  specialties: string[];
  rating: number;
  /** Цена базовой стрижки, ₽. */
  price: number;
  /** Инициалы для аватара. */
  initials: string;
}

export interface Slot {
  masterId: string;
  /** ISO-дата и время начала. */
  start: string;
}

export interface ShopConfig {
  name: string;
  address: string;
  phone: string;
  masters: Master[];
  services: { id: string; name: string; price: number; minutes: number }[];
}

export const SHOP: ShopConfig = {
  name: 'Barber Lab',
  address: 'ул. Рубинштейна, 12',
  phone: '+7 812 000-00-00',
  masters: [
    {
      id: 'm1',
      name: 'Артём Волков',
      initials: 'АВ',
      experience: 9,
      specialties: ['pompadour', 'quiff', 'slickBack', 'sidePart'],
      rating: 4.9,
      price: 2600,
    },
    {
      id: 'm2',
      name: 'Илья Северов',
      initials: 'ИС',
      experience: 6,
      specialties: ['texturedCrop', 'frenchCrop', 'caesar', 'curtains'],
      rating: 4.8,
      price: 2200,
    },
    {
      id: 'm3',
      name: 'Марк Гиль',
      initials: 'МГ',
      experience: 4,
      specialties: ['buzzFade', 'buzz', 'undercut', 'crew'],
      rating: 4.7,
      price: 1800,
    },
    {
      id: 'm4',
      name: 'Даня Ким',
      initials: 'ДК',
      experience: 7,
      specialties: ['curlyTop', 'texturedCrop', 'ivyLeague'],
      rating: 4.9,
      price: 2400,
    },
  ],
  services: [
    { id: 's1', name: 'Мужская стрижка', price: 2200, minutes: 60 },
    { id: 's2', name: 'Стрижка + борода', price: 3200, minutes: 90 },
    { id: 's3', name: 'Камуфляж седины', price: 1400, minutes: 40 },
  ],
};

/**
 * Ближайшие свободные слоты.
 *
 * Расписание детерминированно выводится из даты, чтобы демонстрация выглядела
 * одинаково у всех и не зависела от случайных чисел. В проде здесь будет запрос
 * к CRM барбершопа.
 */
export function upcomingSlots(from = new Date(), days = 3): Slot[] {
  const slots: Slot[] = [];
  const hours = [10, 11, 13, 14, 16, 17, 18, 19];

  for (let d = 0; d < days; d++) {
    const day = new Date(from);
    day.setDate(day.getDate() + d);

    SHOP.masters.forEach((master, mi) => {
      hours.forEach((hour, hi) => {
        // Детерминированная маска занятости. Множитель мастера (5) взаимно прост
        // с модулем (4), иначе сдвиг по мастерам вырождается в ноль и у всех
        // оказывается одно и то же расписание.
        const busy = (hi + mi * 5 + d * 3) % 4 !== 0;
        if (busy) return;
        const start = new Date(day);
        start.setHours(hour, 0, 0, 0);
        if (start.getTime() <= from.getTime()) return;
        slots.push({ masterId: master.id, start: start.toISOString() });
      });
    });
  }

  return slots.sort((a, b) => a.start.localeCompare(b.start));
}

/** Мастера, отсортированные по тому, насколько они профильны для стрижки. */
export function mastersFor(styleId: string): Master[] {
  return [...SHOP.masters].sort((a, b) => {
    const aFit = a.specialties.includes(styleId) ? 1 : 0;
    const bFit = b.specialties.includes(styleId) ? 1 : 0;
    if (aFit !== bFit) return bFit - aFit;
    return b.rating - a.rating;
  });
}

export const formatSlot = (iso: string): string => {
  const date = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  if (sameDay(date, today)) return `сегодня ${time}`;
  if (sameDay(date, tomorrow)) return `завтра ${time}`;
  return `${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} ${time}`;
};
