/**
 * Дымовой прогон в настоящем браузере: проходит весь маршрут и складывает
 * скриншоты в ./screenshots.
 *
 * Требует поднятого `npm run preview`. Камера подменяется синтетическим потоком
 * Chromium — лица в нём нет, поэтому экран скана проверяется до момента захвата,
 * а подбор и запись прогоняются через демо-режим (`?demo`).
 *
 *   npm run build && npm run preview &   # в одном терминале
 *   npm run smoke                        # в другом
 */
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const BASE = process.env.SMOKE_URL ?? 'http://127.0.0.1:4173/';
const OUT = fileURLToPath(new URL('../screenshots/', import.meta.url));
await mkdir(OUT, { recursive: true });

// В окружениях с предустановленным Chromium берём его, иначе — браузер Playwright.
const launchOptions = {
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
};
if (process.env.CHROMIUM_PATH) launchOptions.executablePath = process.env.CHROMIUM_PATH;

const browser = await chromium.launch(launchOptions);
const ctx = await browser.newContext({ ...devices['iPhone 13'], permissions: ['camera'] });
const page = await ctx.newPage();

const errors = [];
const failures = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('requestfailed', (r) => failures.push(`${r.url()} :: ${r.failure()?.errorText}`));
page.on('response', (r) => {
  if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
});

const shot = (name) => page.screenshot({ path: `${OUT}${name}.png`, fullPage: true });

// 1. Заставка
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('h1');
await shot('1-intro');

// 2. Скан: камера поднялась и модель разметки загрузилась
await page.click('button.btn');
await page.waitForSelector('.camera__badge', { timeout: 60000 });
await shot('2-scan');

const assets = await page.evaluate(() =>
  performance
    .getEntriesByType('resource')
    .filter((e) => e.name.includes('/mp/'))
    .map((e) => e.name.split('/mp/')[1]),
);
if (!assets.some((a) => a.includes('face_landmarker'))) {
  failures.push('модель разметки не загрузилась');
}
console.log('ассеты разметки:', assets.join(', ') || '(нет)');

// 3. Подбор на демо-данных
await page.goto(`${BASE}?demo`, { waitUntil: 'networkidle' });
await page.waitForSelector('.collage', { timeout: 20000 });
await shot('3-result');

console.log('форма лица:', await page.textContent('.shape__name'));
const picks = await page.$$eval('.style__name', (els) => els.map((e) => e.textContent));
console.log('подбор:', picks.join(' → '));

// 4. Смена стрижки должна пересчитывать контур на коллаже
const before = await page.getAttribute('.collage svg path', 'd');
await page.click('.styles .style:nth-child(4)');
await page.waitForTimeout(150);
const after = await page.getAttribute('.collage svg path', 'd');
if (before === after) failures.push('контур причёски не изменился при смене стрижки');
console.log('переключено на:', await page.textContent('.styles + .card h2'));
await shot('4-result-alt');

// 5. Мастера и запись
await page.click('button.btn:not(.btn--ghost)');
await page.waitForSelector('.master', { timeout: 10000 });
await shot('5-booking');

await page.click('.slot');
await page.click('button.btn:not(.btn--ghost)');
await page.waitForSelector('.center-state', { timeout: 5000 });
await shot('6-confirmed');

// 6. Десктоп получает заглушку
const desk = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const deskPage = await desk.newPage();
await deskPage.goto(BASE, { waitUntil: 'networkidle' });
await deskPage.waitForSelector('.gate');
await deskPage.screenshot({ path: `${OUT}7-desktop-gate.png` });

await browser.close();

console.log('\nскриншоты:', OUT);
console.log('ошибки страницы:', errors.length ? errors : 'нет');
console.log('сбойные запросы:', failures.length ? failures : 'нет');
process.exit(errors.length || failures.length ? 1 : 0);
