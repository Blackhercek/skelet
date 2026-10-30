// Проверка опубликованного атласа в настоящих браузерах (Playwright): Chromium и WebKit (движок Safari и iPhone).
// Запуск:  node claude-task/verify-deployed.mjs https://логин.github.io/репозиторий/
// Переменная OUT_DIR задаёт папку для скриншотов и report.json (по умолчанию claude-task/out); ONLY — какие наборы запускать.
// ВНИМАНИЕ: скрипт написан без возможности его запустить — это рабочий черновик. Если он падает из-за самого скрипта, исправьте скрипт.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium, webkit, devices} from 'playwright';

const base = (process.argv[2] ?? process.env.SITE_URL ?? '').replace(/\/*$/, '/');
if (!/^https?:\/\//.test(base)) { console.error('Укажите адрес: node claude-task/verify-deployed.mjs https://логин.github.io/репозиторий/'); process.exit(2); }
const outDir = path.resolve(process.env.OUT_DIR ?? fileURLToPath(new URL('./out', import.meta.url)));
fs.mkdirSync(outDir, {recursive: true});

const report = [];
const mark = {ok: '✓', fail: '✗', skip: '–'};
const record = (suite, name, status, detail = '') => { report.push({suite, name, status, detail}); console.log(`${mark[status]} [${suite}] ${name}${detail ? ' — ' + detail : ''}`); };
const number = text => Number(String(text ?? '').replace(/\D/g, ''));
const SKIP = Symbol('skip');

// После упавшего шага интерфейс может остаться в «чужом» состоянии (открытый тест, карточка) и обрушить все следующие шаги.
// Поэтому runSuite задаёт recover — возврат на главный экран.
let recover = null;
const plain = text => String(text).replace(/\x1b\[[0-9;]*m/g, '');
async function step(suite, name, fn) {
  try { const result = await fn(); if (result && result[SKIP]) record(suite, name, 'skip', result[SKIP]); else record(suite, name, 'ok', typeof result === 'string' ? result : ''); }
  catch (error) {
    record(suite, name, 'fail', plain(error?.message ?? error).split('\n').filter(line => line.trim() && !/^Call log:/.test(line.trim())).slice(0, 5).map(line => line.trim()).join(' ⏎ ').slice(0, 600));
    try { await recover?.(); } catch { /* страница закрыта — дальше всё равно упадёт с понятной причиной */ }
  }
}
const skipped = reason => ({[SKIP]: reason});

const counter = page => page.locator('.brand-meta').innerText();
async function waitReady(page, timeout = 240000) {
  await page.waitForFunction(() => /\d/.test(document.querySelector('.brand-meta')?.textContent ?? '') && !document.querySelector('.loading, .start'), null, {timeout});
}
async function openBrowse(page) {
  const browse = page.locator('.side-panel.browse');
  if (await browse.count() && await browse.isVisible()) return;
  await page.locator('.canvas-tools .compact-only').click();
  await browse.waitFor({state: 'visible'});
}
/** The 3D canvas really draws something: the page looks different with the canvas hidden. */
async function canvasDraws(page, selector) {
  const withCanvas = await page.screenshot();
  const style = await page.addStyleTag({content: `${selector}{visibility:hidden!important}`});
  const without = await page.screenshot();
  await style.evaluate(node => node.remove());
  const difference = Math.abs(withCanvas.length - without.length);
  if (withCanvas.equals(without) || difference < 15000) throw new Error(`холст почти ничего не рисует (разница ${difference} байт)`);
  return `разница скриншотов ${Math.round(difference / 1024)} КБ`;
}

/** Скачать для работы без интернета → отключить сеть → перезагрузить. model=false: 3D недоступен, проверяем, что страница и скрипты открываются из кэша. */
async function offlineRoundTrip(page, context, {model, shot}) {
  const supported = await page.evaluate(() => isSecureContext && 'serviceWorker' in navigator && typeof caches !== 'undefined');
  if (!supported) return skipped('нет https/service worker в этом браузере');
  await openBrowse(page);   // на телефоне панель «Обзор» (а в ней кнопка настроек) скрыта, пока её не откроешь
  await page.locator('.panel-head .icon[aria-label^="Настройки"]').click();
  await page.locator('.about-dialog .primary', {hasText: 'Скачать'}).click();
  await page.locator('.about-dialog .primary', {hasText: 'Готово'}).waitFor({timeout: 420000});
  const controlled = await page.evaluate(async () => { await navigator.serviceWorker.ready; return !!(await navigator.serviceWorker.getRegistration()); });
  if (!controlled) throw new Error('service worker не зарегистрирован');
  await page.locator('.about-dialog .close').click();
  await context.setOffline(true);
  try {
    await page.reload({waitUntil: 'load', timeout: 120000});
    if (model) {
      await waitReady(page, 180000);
      if (number(await counter(page)) !== 2229) throw new Error('после перезагрузки без сети модель не открылась');
    } else {
      await page.locator('.brand h1').waitFor({timeout: 60000});
      if (!/Атлас/.test(await page.title())) throw new Error('без сети открылась не та страница');
    }
    await shot?.('без-сети');
    return model ? '' : 'страница, скрипты и данные открываются из кэша (3D в этом браузере недоступен)';
  } finally { await context.setOffline(false); }
}

async function runSuite(suite, type, contextOptions, {full}) {
  let browser;
  try {
    browser = await type.launch(type === chromium ? {args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']} : {});
  } catch (error) { record(suite, 'запуск браузера', 'fail', String(error.message).split('\n')[0]); return; }
  const context = await browser.newContext({...contextOptions, locale: 'ru-RU', serviceWorkers: 'allow'});
  // Без видеокарты WebGL работает программно (≈1 кадр/с): проверки «элемент стабилен» ждут несколько кадров, 30 с по умолчанию мало.
  context.setDefaultTimeout(120000);
  const page = await context.newPage();
  recover = async () => { await page.goto(base, {waitUntil: 'load', timeout: 120000}); await waitReady(page, 180000); };
  const problems = [];
  page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  page.on('requestfailed', r => problems.push(`запрос не удался: ${r.url()} ${r.failure()?.errorText ?? ''}`));
  page.on('response', r => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
  const shot = name => page.screenshot({path: path.join(outDir, `${suite}-${name}.png`)}).catch(() => {});
  const phone = !!contextOptions.isMobile;

  await step(suite, 'страница открывается', async () => { await page.goto(base, {waitUntil: 'load', timeout: 120000}); return page.title(); });
  const webgl = await page.evaluate(() => { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }).catch(() => false);
  if (!webgl) {
    record(suite, '3D (WebGL) в этом headless-браузере', 'skip', 'WebGL недоступен — 3D-проверки пропущены; проверьте вручную на реальном устройстве');
    await step(suite, 'работа без интернета без 3D (скачать → отключить сеть → перезагрузить)', () => offlineRoundTrip(page, context, {model: false, shot}));
    await shot('без-webgl'); await browser.close(); return;
  }

  await step(suite, 'модель загрузилась, счётчик структур', async () => { await waitReady(page); const n = number(await counter(page)); if (n !== 2229) throw new Error(`ожидалось 2229, получено ${n}`); return `${n}`; });
  await shot('главный-экран');
  await step(suite, '3D-холст рисует тело', () => canvasDraws(page, '.scene canvas'));
  if (phone) await step(suite, 'нет горизонтальной прокрутки, нижняя панель на экране', async () => {
    const m = await page.evaluate(() => { const d = document.querySelector('.dock')?.getBoundingClientRect(); return {scroll: document.documentElement.scrollWidth, width: innerWidth, dock: d && {left: d.left, right: d.right, bottom: d.bottom}, height: innerHeight}; });
    if (m.scroll > m.width + 1) throw new Error(`страница шире экрана: ${m.scroll} > ${m.width}`);
    if (!m.dock || m.dock.left < -1 || m.dock.right > m.width + 1 || m.dock.bottom > m.height + 1) throw new Error('нижняя панель выходит за экран');
  });

  await step(suite, 'заставка загрузки: «Загрузка», «Сделано для Женьки», процент, меню закрыто', async () => {
    // Отдельный контекст без service worker: только так Playwright может замедлить файлы моделей и дать увидеть заставку.
    const slowContext = await browser.newContext({...contextOptions, locale: 'ru-RU', serviceWorkers: 'block'});
    try {
      const slow = await slowContext.newPage();
      await slow.route(/\.bin\.gz$/, async route => { await new Promise(resolve => setTimeout(resolve, 4000)); await route.continue(); });
      await slow.goto(base, {waitUntil: 'domcontentloaded', timeout: 120000});
      await slow.locator('.start').waitFor({state: 'visible', timeout: 60000});
      const text = await slow.locator('.start').innerText();
      if (!/Загрузка/.test(text) || !/Сделано для Женьки/.test(text) || !/\d+\s*%/.test(text)) throw new Error(`на заставке нет нужного текста: «${text.replace(/\s+/g, ' ')}»`);
      await slow.waitForFunction(() => !!document.querySelector('main.studio'), null, {timeout: 60000});
      const covered = await slow.evaluate(() => [[.5, .5], [.1, .1], [.9, .2], [.5, .9]].every(([x, y]) => document.elementFromPoint(innerWidth * x, innerHeight * y)?.closest('.start')) && !!document.querySelector('main.studio')?.inert);
      if (!covered) throw new Error('под заставкой виден или доступен интерфейс');
      await slow.screenshot({path: path.join(outDir, `${suite}-заставка.png`)}).catch(() => {});
      await slow.locator('.start').waitFor({state: 'detached', timeout: 300000});
      if (number(await counter(slow)) !== 2229) throw new Error('после заставки счётчик структур не 2229');
    } finally { await slowContext.close(); await page.bringToFront(); }   // WebKit иначе считает первую страницу фоновой и почти не отдаёт кадры
  });
  await step(suite, 'поиск по-русски и карточка структуры', async () => {
    await openBrowse(page);
    await page.locator('.search input').fill('передняя зубчатая');
    await page.locator('.results button').first().click();
    await page.locator('.detail').waitFor({state: 'visible', timeout: 20000});
    const text = await page.locator('.detail').innerText();
    if (!/Описание/i.test(text) || !/зубчатая/i.test(text)) throw new Error('в карточке нет ожидаемого текста');
    await page.waitForTimeout(1500); await shot('карточка');
    await page.locator('.detail .ghost', {hasText: 'Вернуться ко всему телу'}).click();
  });

  await step(suite, 'режим «Проверь себя»', async () => {
    await openBrowse(page);
    await page.locator('.quiz-card').click();
    await page.locator('.quiz-body .primary', {hasText: 'Начать'}).click();
    await page.locator('.quiz-options button').first().waitFor({timeout: 20000});
    if (await page.locator('.quiz-options button').count() !== 4) throw new Error('должно быть 4 варианта ответа');
    await page.locator('.quiz-options button').first().click();
    await page.locator('.quiz-feedback').waitFor();
    await shot('тест');
    await page.locator('.quiz-feedback .primary').click();
    await page.locator('.quiz-progress', {hasText: 'Вопрос 2'}).waitFor();
    await page.locator('.quiz .back-link').click();
  });

  for (const [id, title] of [['heart', 'Сердце'], ['lungs', 'Лёгкие'], ['brain', 'Головной мозг']]) {
    await step(suite, `орган в 3D: ${title}`, async () => {
      if (!await page.locator('.organ-view').count()) { await openBrowse(page); await page.locator(`.organ-cards button[data-organ="${id}"]`).click(); }
      else await page.locator('.organ-switch button', {hasText: title}).click();
      await page.locator('.organ-title h2', {hasText: title}).waitFor({timeout: 120000});
      await page.waitForFunction(() => document.querySelectorAll('.hotspot').length >= 5, null, {timeout: 120000});
      await page.waitForTimeout(1200);
      await canvasDraws(page, '.organ-canvas canvas');
      await shot(`орган-${id}`);
      const marker = page.locator('.hotspot[data-state=front]').first();
      if (await marker.count()) { await marker.click(); await page.locator('.hotspot-card').waitFor({timeout: 10000}); }
    });
  }
  await page.keyboard.press('Escape');

  if (full) {
    await step(suite, 'срез тела', async () => {
      await page.locator('.tool[aria-label="Срез тела"]').click();
      await page.locator('.section-panel .seg button', {hasText: 'Сагиттальный'}).click();
      if (await page.locator('#section-position').isDisabled()) throw new Error('ползунок среза не включился');
      await page.waitForTimeout(800); await shot('срез');
      await page.locator('.section-panel .ghost', {hasText: 'Убрать срез'}).click();
      await page.locator('.section-panel .icon').click();
    });
  }

  await step(suite, 'работа без интернета (скачать → отключить сеть → перезагрузить)', () => offlineRoundTrip(page, context, {model: true, shot}));

  await step(suite, 'нет ошибок в консоли и неудачных запросов', async () => {
    const unique = [...new Set(problems)];
    if (unique.length) throw new Error(`${unique.length}: ${unique.slice(0, 5).join(' | ')}`);
  });
  await browser.close();
}

// ONLY=телефон,iphone — запустить только наборы, чьё имя содержит одну из подстрок (по умолчанию все).
const only = (process.env.ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);
const wanted = name => !only.length || only.some(s => name.includes(s));
const iphone = (({defaultBrowserType, ...options}) => options)(devices['iPhone 13']);
const pixel = (({defaultBrowserType, ...options}) => options)(devices['Pixel 7']);
if (wanted('компьютер-chromium')) await runSuite('компьютер-chromium', chromium, {viewport: {width: 1280, height: 800}}, {full: true});
if (wanted('телефон-chromium')) await runSuite('телефон-chromium', chromium, pixel, {full: false});
if (wanted('iphone-webkit')) await runSuite('iphone-webkit', webkit, iphone, {full: false});

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({url: base, date: new Date().toISOString(), results: report}, null, 2));
const failed = report.filter(r => r.status === 'fail').length, skippedCount = report.filter(r => r.status === 'skip').length;
console.log(`\nИтого: ${report.filter(r => r.status === 'ok').length} успешно, ${failed} с ошибкой, ${skippedCount} пропущено. Отчёт и скриншоты: ${outDir}`);
process.exit(failed ? 1 : 0);
