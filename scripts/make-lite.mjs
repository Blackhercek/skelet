// Builds the "lite" models used on phones: the same meshes simplified a second time (about 30 % of the triangles).
// Input:  public/models/atlas.json, atlas-female.json (+ their .bin chunks)
// Output: public/models/atlas-lite.json, atlas-female-lite.json (+ body-lite-N.bin / female-lite-N.bin)
import fs from 'node:fs';
import {MeshoptSimplifier} from 'meshoptimizer';

await MeshoptSimplifier.ready;
const dir = new URL('../public/models/', import.meta.url);
const KEEP = 0.3, MIN_TRIANGLES = 90, MAX_ERROR = 0.012, CHUNK_BYTES = 3_000_000;

for (const [name, prefix] of [['atlas.json', 'body-lite'], ['atlas-female.json', 'female-lite']]) {
  const manifest = JSON.parse(fs.readFileSync(new URL(name, dir), 'utf8'));
  const source = manifest.chunks.map(c => fs.readFileSync(new URL(c.url.split('/').pop(), dir)));
  const chunks = [];
  let segments = [], bytes = 0, triangles = 0, worst = 0;
  const flush = () => {
    if (!bytes) return;
    const url = `/models/${prefix}-${chunks.length}.bin`;
    fs.writeFileSync(new URL(url.split('/').pop(), dir), Buffer.concat(segments));
    chunks.push({url, bytes}); segments = []; bytes = 0;
  };
  const append = (array, align) => {
    const padding = (align - bytes % align) % align;
    if (padding) { segments.push(Buffer.alloc(padding)); bytes += padding; }
    const offset = bytes, buffer = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
    segments.push(buffer); bytes += buffer.length;
    return offset;
  };
  for (const p of manifest.parts) {
    const b = source[p.chunk];
    const pos = new Float32Array(b.buffer.slice(b.byteOffset + p.positions, b.byteOffset + p.positions + p.vertexCount * 12));
    const normal = new Int16Array(b.buffer.slice(b.byteOffset + p.normals, b.byteOffset + p.normals + p.vertexCount * 6));
    const indices = new Uint32Array(b.buffer.slice(b.byteOffset + p.indices, b.byteOffset + p.indices + p.indexCount * 4));
    const triCount = indices.length / 3;
    let outIndices = indices, outPos = pos, outNormal = normal, count = p.vertexCount;
    if (triCount > MIN_TRIANGLES * 1.5) {
      const target = Math.max(MIN_TRIANGLES, Math.floor(triCount * KEEP)) * 3;
      const [simplified, error] = MeshoptSimplifier.simplify(indices, pos, 3, Math.min(indices.length, target), MAX_ERROR);
      worst = Math.max(worst, error);
      const [remap, used] = MeshoptSimplifier.compactMesh(simplified);
      outPos = new Float32Array(used * 3); outNormal = new Int16Array(used * 3);
      for (let old = 0; old < remap.length; old++) {
        const n = remap[old]; if (n === 0xffffffff) continue;
        outPos.set(pos.subarray(old * 3, old * 3 + 3), n * 3); outNormal.set(normal.subarray(old * 3, old * 3 + 3), n * 3);
      }
      outIndices = simplified; count = used;
    }
    if (bytes > CHUNK_BYTES) flush();
    p.chunk = chunks.length;
    p.positions = append(outPos, 4); p.normals = append(outNormal, 4); p.indices = append(outIndices, 4);
    p.vertexCount = count; p.indexCount = outIndices.length; triangles += outIndices.length / 3;
  }
  flush();
  manifest.sourceTriangles = manifest.triangles; manifest.triangles = triangles; manifest.chunks = chunks;
  manifest.lite = {method: 'meshoptimizer quadric simplification (second pass)', keep: KEEP, maximumRelativeError: MAX_ERROR};
  const out = name.replace('.json', '-lite.json');
  fs.writeFileSync(new URL(out, dir), JSON.stringify(manifest));
  console.log(`${out}: ${manifest.parts.length} parts, ${Math.round(triangles).toLocaleString()} triangles (was ${manifest.sourceTriangles.toLocaleString()}), ${chunks.length} chunks, ${(chunks.reduce((n, c) => n + c.bytes, 0) / 1e6).toFixed(1)} MB, worst error ${worst.toFixed(4)}`);
}
