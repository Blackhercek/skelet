// Runs public/sw.js against an in-memory Cache Storage to check the offline logic without a browser.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8').replace('__BUILD__', 'test-build');
const origin = 'https://atlas.example';

// A tiny Cache Storage: keyed by URL, stores cloned responses.
const stores = new Map();
const makeCache = map => ({
  match: async req => { const hit = map.get(typeof req === 'string' ? req : req.url); return hit ? hit.clone() : undefined; },
  put: async (req, res) => { map.set(typeof req === 'string' ? req : req.url, res.clone()); },
  keys: async () => [...map.keys()].map(url => ({url})),
});
const caches = {
  open: async name => { if (!stores.has(name)) stores.set(name, new Map()); return makeCache(stores.get(name)); },
  keys: async () => [...stores.keys()],
  delete: async name => stores.delete(name),
};

let online = true; const networkLog = [];
const fakeFetch = async req => { const url = typeof req === 'string' ? req : req.url; networkLog.push(url); if (!online) throw new TypeError('offline'); return new Response(`network:${url}`, {status: 200}); };
const listeners = {};
const self = {
  location: {origin}, registration: {scope: `${origin}/`}, clients: {claim: async () => {}}, skipWaiting: () => {},
  addEventListener: (type, fn) => { listeners[type] = fn; },
};
vm.runInNewContext(source, {self, caches, fetch: fakeFetch, Response, URL, Promise, setTimeout, clearTimeout, console});

const dispatch = async (type, init = {}) => {
  let pending = null;
  const event = {...init, waitUntil: p => { pending = p; }, respondWith: p => { pending = p; }};
  listeners[type](event);
  return pending ? await pending : undefined;
};
const request = (url, mode = 'cors', method = 'GET') => ({url: `${origin}${url}`, mode, method});

await dispatch('install'); await dispatch('activate');

// 1. Data files: first from the network, then from the device even when offline.
const first = await dispatch('fetch', {request: request('/models/body-0.bin.gz')});
assert.equal(await first.text(), `network:${origin}/models/body-0.bin.gz`);
online = false;
const again = await dispatch('fetch', {request: request('/models/body-0.bin.gz')});
assert.equal(await again.text(), `network:${origin}/models/body-0.bin.gz`, 'data must come from the cache offline');

// 2. Pages: fresh when online, the saved page when offline.
online = true;
const page = await dispatch('fetch', {request: request('/', 'navigate')});
assert.ok((await page.text()).startsWith('network:'));
online = false;
const saved = await dispatch('fetch', {request: request('/', 'navigate')});
assert.ok((await saved.text()).startsWith('network:'), 'the page must be served from the cache offline');
const unknown = await dispatch('fetch', {request: request('/never-seen.js')});
assert.equal(unknown.status, 503, 'unknown files offline give a clean error, not an exception');

// 3. Requests the worker must not touch.
networkLog.length = 0;
assert.equal(await dispatch('fetch', {request: request('/api', 'cors', 'POST')}), undefined);
assert.equal(await dispatch('fetch', {request: {url: 'https://other.example/x.js', mode: 'cors', method: 'GET'}}), undefined);

// 4. Old interface caches are removed when a new build activates, data caches stay.
stores.set('atlas-shell-old-build', new Map()); stores.set('atlas-data-v1', stores.get('atlas-data-v1') ?? new Map());
await dispatch('activate');
assert.ok(!stores.has('atlas-shell-old-build') && stores.has('atlas-data-v1'));
// 5. First start offline: nothing was ever opened under the worker's control, the page asks it to save the interface while online.
stores.clear(); online = true; networkLog.length = 0;
const replies = []; const port = {postMessage: message => replies.push(message)};
const shellUrls = [`${origin}/`, `${origin}/index.html`, `${origin}/assets/app.js`, `${origin}/assets/app.css`, 'https://other.example/ignored.js'];
assert.equal(await dispatch('message', {data: {type: 'something-else', urls: shellUrls}, ports: [port]}), undefined);
assert.equal(await dispatch('message', {data: {type: 'cache-shell'}, ports: [port]}), undefined);
assert.equal(replies.length, 0, 'unrelated messages get no reply');
await dispatch('message', {data: {type: 'cache-shell', urls: shellUrls}, ports: [port]});
assert.ok(replies.length === 1 && replies[0].ok === true, 'the page is told the interface is saved');
assert.ok(!networkLog.some(url => url.startsWith('https://other.example')), 'other origins are never fetched');
online = false;
const firstOffline = await dispatch('fetch', {request: request('/', 'navigate')});
assert.equal(firstOffline.status, 200, 'the saved page opens on the very first offline start');
assert.equal(await (await dispatch('fetch', {request: request('/assets/app.js')})).text(), `network:${origin}/assets/app.js`, 'scripts come from the cache too');
assert.equal((await dispatch('fetch', {request: request('/assets/other.js')})).status, 503);
online = true; replies.length = 0;
await dispatch('message', {data: {type: 'cache-shell', urls: [`${origin}/ok.js`, 'not a url']}, ports: [port]});
assert.equal(replies[0]?.ok, false, 'a bad address is reported as a failure, not a silent success');
console.log('service worker logic ok');
