// The quiz must always be able to build a round with distinct, answerable options.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {assignRegions} from '../app/regions.ts';
import {localizeAtlas} from '../app/localize.ts';
import {SCOPES, buildPool, makeOptions, makeRound, shuffle, ROUND_LENGTH} from '../app/quiz-logic.ts';

const dict = JSON.parse(fs.readFileSync(new URL('../public/models/names-ru.json', import.meta.url), 'utf8'));
for (const file of ['atlas.json', 'atlas-female.json']) {
  const atlas = localizeAtlas(assignRegions(JSON.parse(fs.readFileSync(new URL(`../public/models/${file}`, import.meta.url), 'utf8'))), dict);
  const report = [];
  for (const scope of Object.keys(SCOPES)) for (const mode of ['identify', 'locate']) for (const level of ['main', 'all']) {
    const pool = buildPool(atlas, scope, mode, level), distractors = buildPool(atlas, scope, mode, 'all');
    report.push(`${scope}/${mode}/${level}:${pool.length}`);
    if (pool.length < 4) continue;
    for (const target of makeRound(pool, ROUND_LENGTH)) {
      const options = makeOptions(target, distractors);
      assert.ok(options.some(o => o.id === target.id), `${file} ${scope}: the answer is missing`);
      assert.equal(new Set(options.map(o => o.name)).size, options.length, `${file} ${scope}: duplicate option names`);
      assert.ok(options.length >= Math.min(4, distractors.length), `${file} ${scope}: too few options`);
      assert.ok(target.name && /[А-Яа-я]/.test(target.name), 'target name must be Russian');
    }
  }
  console.log(`${file}\n  ${report.join('  ')}`);
}
const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8]); assert.deepEqual([...a].sort(), [1, 2, 3, 4, 5, 6, 7, 8]);
console.log('quiz logic ok');
