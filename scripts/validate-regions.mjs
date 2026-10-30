// Prints how many pieces land in each body region and checks well-known landmarks.
// Requires Node 22.18+ (native TypeScript).
import fs from 'node:fs';
import {assignRegions, REGIONS} from '../app/regions.ts';
import {localizeAtlas} from '../app/localize.ts';

const dict = JSON.parse(fs.readFileSync(new URL('../public/models/names-ru.json', import.meta.url), 'utf8'));

// Every piece whose name matches the pattern must be in the region (at least 90% of them, to allow for odd source meshes).
const EXPECT = {
  'atlas.json': [
    [/^(left|right) (humerus|radius|ulna|capitate|scapula|clavicle|hamate)$/i, 'upper-limb'],
    [/^(left|right) (femur|tibia|patella|sartorius|rectus femoris|tensor fasciae latae|gluteus maximus)$/i, 'lower-limb'],
    [/(kidney|liver|stomach|spleen|pancrea|duoden|jejun|ileum)/i, 'abdomen'],
    [/^(urinary bladder|prostate|left testis|right testis)$/i, 'pelvis'],
    [/^(cerebellum|mandible|pons|midbrain|(left|right) eyeball|(left|right) .*gyrus)$/i, 'head'],
    [/(coronary|wall of ventricle|cavity of (left|right) ventricle|atrium|pulmonary valve|mitral|tricuspid|segmental bronchial tree|trachea|sternum|\brib\b|serratus anterior)/i, 'thorax'],
  ],
  'atlas-female.json': [
    [/(trachea|heart|cardiac atrium|bronchopulmonary|\brib)/i, 'thorax'],
    [/(kidney|liver|pancreas|stomach|spleen)/i, 'abdomen'],
    [/(urinary bladder|uterus|vagina|ovary)/i, 'pelvis'],
  ],
};
let failures = 0;
for (const file of ['atlas.json', 'atlas-female.json']) {
  const atlas = assignRegions(JSON.parse(fs.readFileSync(new URL(`../public/models/${file}`, import.meta.url), 'utf8')));
  // Switching sex re-uses the cached atlas: regions must not change after the names became Russian.
  const snapshot = atlas.parts.map(p => p.region).join();
  assignRegions(localizeAtlas(atlas, dict));
  if (atlas.parts.map(p => p.region).join() !== snapshot) { failures++; console.log(`  ✗ ${file}: regions changed after localization`); }
  const by = {};
  for (const p of atlas.parts) (by[p.region ?? 'none'] ??= []).push(p);
  console.log(`\n${file}: ${atlas.parts.length} pieces`);
  for (const id of [...REGIONS.map(r => r.id), 'none']) {
    const list = by[id] ?? [];
    const sample = list.filter((_, i) => i % Math.max(1, Math.floor(list.length / 7)) === 0).slice(0, 7).map(p => p.name).join(' | ');
    console.log(`${id.padEnd(11)} ${String(list.length).padStart(4)}  ${sample}`);
  }
  for (const [pattern, region] of EXPECT[file]) {
    const found = atlas.parts.filter(p => pattern.test(p.nameEn ?? p.name));
    if (!found.length) { failures++; console.log(`  ✗ nothing matches ${pattern}`); continue; }
    const wrong = found.filter(p => p.region !== region);
    const ok = 1 - wrong.length / found.length;
    console.log(`  ${ok >= 0.9 ? '✓' : '✗'} ${pattern} → ${region}: ${found.length - wrong.length}/${found.length}${wrong.length ? '  e.g. ' + wrong.slice(0, 3).map(p => `${p.nameEn ?? p.name} (${p.region})`).join(', ') : ''}`);
    if (ok < 0.9) failures++;
  }
}
if (failures) throw new Error(`${failures} region expectations failed`);
console.log('\nregion expectations ok');
