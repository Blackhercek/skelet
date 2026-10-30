// Organ pack integrity: every piece is inside the binary, every piece belongs to a layer, every marker finds its pieces.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {ORGANS} from '../app/organs.ts';

const pack = JSON.parse(fs.readFileSync(new URL('../public/organs/organs.json', import.meta.url), 'utf8'));
const bin = fs.readFileSync(new URL('../public/organs/organs.bin', import.meta.url));
assert.equal(bin.length, pack.bytes, 'organs.bin size');
for (const p of pack.parts) {
  assert.ok(p.positions + p.vertexCount * 12 <= bin.length && p.normals + p.vertexCount * 6 <= bin.length && p.indices + p.indexCount * 4 <= bin.length, `${p.id}: out of range`);
  const indices = new Uint32Array(bin.buffer, bin.byteOffset + p.indices, p.indexCount);
  for (const i of indices) assert.ok(i < p.vertexCount, `${p.id}: bad index`);
}
for (const organ of ORGANS) {
  const parts = pack.parts.filter(p => p.organ === organ.id);
  assert.ok(parts.length > 0, `${organ.id}: no pieces`);
  const groupIds = new Set(organ.groups.map(g => g.id));
  const used = new Set();
  for (const p of parts) { const g = organ.groupOf(p.id); assert.ok(groupIds.has(g), `${p.id}: unknown layer ${g}`); used.add(g); }
  for (const g of groupIds) assert.ok(used.has(g), `${organ.id}: layer "${g}" has no pieces`);
  for (const h of organ.hotspots) {
    const hit = parts.filter(p => h.match.test(p.id));
    assert.ok(hit.length > 0, `${organ.id}: marker "${h.id}" matches nothing`);
    assert.ok(/[А-Яа-я]/.test(h.title) && /[А-Яа-я]/.test(h.text), `${organ.id}/${h.id}: text is not Russian`);
  }
  console.log(`${organ.id}: ${parts.length} pieces, ${organ.groups.length} layers, ${organ.hotspots.length} markers ok`);
}
