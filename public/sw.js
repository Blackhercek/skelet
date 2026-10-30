/* Атлас тела человека: service worker. Нужен для работы без интернета и быстрого повторного запуска. */
const BUILD = '__BUILD__';
const SHELL = `atlas-shell-${BUILD}`; // интерфейс: обновляется с каждой сборкой
const DATA = 'atlas-data-v1'; // 3D-данные: большие файлы, живут между версиями

const isData = url => /\/(models|organs)\//.test(url.pathname);
const offline = () => new Response('Нет подключения к интернету.', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}});

self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('atlas-shell-') && key !== SHELL) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') event.respondWith(pageFirstOnline(request));
  else event.respondWith(cacheFirst(request, isData(url) ? DATA : SHELL));
});

/** Страница: берём свежую из сети, а без сети (или при слабом сигнале) — сохранённую. */
async function pageFirstOnline(request) {
  const cache = await caches.open(SHELL);
  const scope = self.registration.scope;
  const saved = async () => (await cache.match(request, {ignoreSearch: true})) ?? (await cache.match(scope)) ?? (await cache.match(new URL('index.html', scope).href));
  const network = fetch(request).then(response => { if (response && response.ok) cache.put(request, response.clone()); return response; });
  const known = await saved();
  if (!known) return network.catch(offline);
  const timeout = new Promise(resolve => setTimeout(() => resolve(known), 3500));
  return Promise.race([network, timeout]).catch(() => known);
}

/** Файлы приложения и 3D-данные: один раз скачали — дальше берём с устройства. */
async function cacheFirst(request, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const response = await fetch(request);
    if (response && response.status === 200) cache.put(request, response.clone());
    return response;
  } catch {
    return offline();
  }
}
