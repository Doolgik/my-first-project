/**
 * Кладёт в public/mp то, что нужно разметке лица.
 *
 * Эти файлы весят ~25 МБ, поэтому в репозитории их нет: WASM копируется из
 * node_modules, а модель качается один раз и кэшируется. Скрипт идемпотентный —
 * висит на prebuild/predev и молча выходит, если всё уже на месте.
 */
import { createWriteStream } from 'node:fs';
import { access, cp, mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'public', 'mp');
const wasmSource = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const MODEL_MIN_BYTES = 3_000_000;

/** Варианты, которые реально грузит FilesetResolver: с SIMD и без. */
const WASM_FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];

const exists = (path) =>
  access(path).then(
    () => true,
    () => false,
  );

async function copyWasm() {
  const dest = join(target, 'wasm');
  await mkdir(dest, { recursive: true });

  if (!(await exists(wasmSource))) {
    throw new Error('Не найден @mediapipe/tasks-vision — сначала выполните npm install');
  }

  let copied = 0;
  for (const file of WASM_FILES) {
    const from = join(wasmSource, file);
    const to = join(dest, file);
    if (!(await exists(from))) continue;
    if (await exists(to)) continue;
    await cp(from, to);
    copied += 1;
  }
  return copied;
}

async function fetchModel() {
  const dest = join(target, 'face_landmarker.task');

  if (await exists(dest)) {
    const info = await stat(dest);
    // Обрезанная закачка с прошлого раза не должна выглядеть как готовый файл.
    if (info.size >= MODEL_MIN_BYTES) return false;
  }

  await mkdir(target, { recursive: true });
  const res = await fetch(MODEL_URL);
  if (!res.ok || !res.body) {
    throw new Error(`Не удалось скачать модель разметки: HTTP ${res.status}`);
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  return true;
}

try {
  const copied = await copyWasm();
  const downloaded = await fetchModel();
  if (copied || downloaded) {
    console.log(
      `[assets] wasm: ${copied ? `скопировано ${copied}` : 'на месте'} · модель: ${
        downloaded ? 'скачана' : 'на месте'
      }`,
    );
  }
} catch (err) {
  console.error(`[assets] ${err.message}`);
  process.exit(1);
}
