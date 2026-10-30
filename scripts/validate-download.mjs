// The data loader must work with and without the browser's own gzip support.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {decodeModelResponse} from '../app/model-download.ts';

const base = new URL('../public/models/', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('atlas-lite.json', base), 'utf8'));
const chunk = manifest.chunks[0], gz = fs.readFileSync(new URL(chunk.gzip.split('/').pop(), base)), raw = fs.readFileSync(new URL(chunk.url.split('/').pop(), base));
for (const native of [true, false]) {
  const saved = globalThis.DecompressionStream;
  if (!native) globalThis.DecompressionStream = undefined;
  const fromGzip = await decodeModelResponse(new Response(gz), chunk.bytes, true);
  const fromPlain = await decodeModelResponse(new Response(raw), chunk.bytes, true); // hosts that already unpacked the file
  globalThis.DecompressionStream = saved;
  assert.equal(Buffer.compare(Buffer.from(fromGzip), raw), 0, `gzip payload (native=${native})`);
  assert.equal(Buffer.compare(Buffer.from(fromPlain), raw), 0, `plain payload (native=${native})`);
}
await assert.rejects(decodeModelResponse(new Response(raw.subarray(0, 100)), chunk.bytes, true), /не полностью/);
console.log('download decoding ok (native and JavaScript gzip, plain payloads, truncated files)');
