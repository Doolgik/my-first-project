/**
 * Слой фотореалистичной генерации.
 *
 * Сейчас ключа генерации нет, поэтому приложение показывает силуэт по разметке
 * головы (silhouette.ts) и честно об этом говорит. Весь остальной продукт —
 * замеры, подбор, обоснование, коллаж — работает по-настоящему и от этого слоя
 * не зависит.
 *
 * Когда ключ появится, меняется только реализация requestGeneration: интерфейс
 * ниже уже описывает то, что нужно экрану результата.
 */

export interface GenerationRequest {
  /** Кадр анфас в data URL. */
  frame: string;
  styleId: string;
  styleName: string;
  /** Технические параметры стрижки — идут в промпт как описание результата. */
  spec: { top: string; sides: string; back: string };
}

export type GenerationResult =
  | { status: 'ready'; image: string }
  | { status: 'unavailable'; reason: string };

/** Есть ли настроенный бэкенд генерации. */
export function isGenerationConfigured(): boolean {
  return Boolean(import.meta.env.VITE_GENERATION_ENDPOINT);
}

/**
 * Запрос на генерацию.
 *
 * Ключ модели намеренно не живёт в браузере: фронт ходит на свой эндпоинт,
 * а тот уже к провайдеру. Иначе ключ утечёт из бандла в первый же день.
 */
export async function requestGeneration(
  req: GenerationRequest,
  signal?: AbortSignal,
): Promise<GenerationResult> {
  const endpoint = import.meta.env.VITE_GENERATION_ENDPOINT;
  if (!endpoint) {
    return {
      status: 'unavailable',
      reason: 'Фотореалистичная примерка не подключена — показан силуэт по разметке головы.',
    };
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal,
    });
    if (!res.ok) {
      return { status: 'unavailable', reason: `Сервис генерации ответил ${res.status}.` };
    }
    const data = (await res.json()) as { image?: string };
    if (!data.image) {
      return { status: 'unavailable', reason: 'Сервис генерации вернул пустой ответ.' };
    }
    return { status: 'ready', image: data.image };
  } catch (err) {
    if (signal?.aborted) throw err;
    return { status: 'unavailable', reason: 'Не удалось связаться с сервисом генерации.' };
  }
}
