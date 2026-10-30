// Packs the heart, lungs and brain of the Human Reference Atlas female assembly into one small file.
// Input:  public/models/atlas-female.json + female-*.bin (already simplified and quantized)
// Output: public/organs/organs.json + organs.bin (+ organs.bin.gz)
import fs from 'node:fs';
import {gzipSync} from 'node:zlib';

const root = new URL('../public/', import.meta.url);
const atlas = JSON.parse(fs.readFileSync(new URL('models/atlas-female.json', root), 'utf8'));
const chunks = atlas.chunks.map(c => fs.readFileSync(new URL(c.url.replace(/^\//, ''), root)));

// Heart: chambers, valves, coronary arteries and the great vessels that attach to it.
// The long abdominal parts of the aorta and vena cava are left out on purpose.
const HEART_VEINS = new Set([
  'VH_F_pulmonary_vein_L_sup', 'VH_F_pulmonary_vein_L_inf', 'VH_F_pulmonary_vein_R_sup', 'VH_F_pulmonary_vein_R_inf',
  'VH_F_coronary_sinus', 'VH_F_great_cardiac_vein', 'VH_F_oblique_vein_of_left_atrium', 'VH_F_posterior_vein_of_left_ventricle',
  'VH_F_superior_vena_cava', 'VH_F_inferior_vena_cava_a',
]);
const HEART_EXCLUDED = new Set(['VH_F_descending_aorta_b']);
const organOf = p => {
  if (p.id.startsWith('Allen_')) return 'brain';
  if (p.system === 'respiratory' && p.id.startsWith('VH_F_')) return 'lungs';
  if (p.id.startsWith('VH_F_') && ((p.system === 'cardiac' && !HEART_EXCLUDED.has(p.id)) || HEART_VEINS.has(p.id))) return 'heart';
  return null;
};

const align4 = n => (n + 3) & ~3;
const pieces = [];
const parts = [];
let cursor = 0;
for (const p of atlas.parts) {
  const organ = organOf(p);
  if (!organ) continue;
  const source = chunks[p.chunk];
  const positions = Buffer.from(source.buffer, source.byteOffset + p.positions, p.vertexCount * 12);
  const normals = Buffer.from(source.buffer, source.byteOffset + p.normals, p.vertexCount * 6);
  const indices = Buffer.from(source.buffer, source.byteOffset + p.indices, p.indexCount * 4);
  const entry = {
    id: p.id, name: p.name, organ, vertexCount: p.vertexCount, indexCount: p.indexCount, bounds: p.bounds,
    positions: cursor, normals: 0, indices: 0,
  };
  pieces.push(positions); cursor += align4(positions.length);
  entry.normals = cursor; pieces.push(normals); cursor += align4(normals.length);
  entry.indices = cursor; pieces.push(indices); cursor += align4(indices.length);
  parts.push(entry);
}

const out = Buffer.alloc(cursor);
let at = 0;
for (const piece of pieces) { piece.copy(out, at); at += align4(piece.length); }

const counts = {};
for (const p of parts) counts[p.organ] = (counts[p.organ] ?? 0) + 1;
const gz = gzipSync(out, {level: 9});
fs.mkdirSync(new URL('organs/', root), {recursive: true});
fs.writeFileSync(new URL('organs/organs.bin', root), out);
fs.writeFileSync(new URL('organs/organs.bin.gz', root), gz);
fs.writeFileSync(new URL('organs/organs.json', root), JSON.stringify({
  version: 'HRA united-female v1.5 · heart, lungs, brain',
  bytes: out.length, gzip: '/organs/organs.bin.gz', gzipBytes: gz.length, url: '/organs/organs.bin', parts,
}));
console.log('organs', counts, `${(out.length / 1e6).toFixed(1)} MB raw, ${(gz.length / 1e6).toFixed(1)} MB gzip`);
