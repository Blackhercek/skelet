// Every structure name of the atlas and the organ pack must have a Russian name without stray Latin letters.
import fs from 'node:fs';

const read = path => JSON.parse(fs.readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8'));
const dict = read('models/names-ru.json');
const key = name => name.replace(/\s+/g, ' ').trim().toLowerCase();

const names = new Set();
for (const file of ['models/atlas.json']) {
  const atlas = read(file);
  atlas.parts.forEach(p => names.add(key(p.name)));
  atlas.concepts.forEach(c => names.add(key(c.name)));
}
read('organs/organs.json').parts.forEach(p => names.add(key(p.name)));

const problems = [];
for (const name of names) {
  const ru = dict[name];
  if (!ru || !ru.trim()) { problems.push(`missing: ${name}`); continue; }
  if (!/[А-Яа-яЁё]/.test(ru)) problems.push(`no Cyrillic: ${name} → ${ru}`);
  if (/[A-Za-z]/.test(ru.replace(/\b[CTLS]\d{1,2}\b/g, ''))) problems.push(`Latin letters: ${name} → ${ru}`);
  if (ru !== ru.trim() || /\s{2,}/.test(ru) || /[.;:]$/.test(ru)) problems.push(`format: ${name} → ${ru}`);
}
console.log(`${names.size} names checked, ${Object.keys(dict).length} in the dictionary`);
if (problems.length) { console.log(problems.slice(0, 40).join('\n')); throw new Error(`${problems.length} problems`); }
console.log('names ok');

// Latin names (optional): only Latin script, no stray words. Keys of the removed female model stay in the dictionary on purpose (see CLAUDE.md), so unknown keys are only counted.
const latin = read('models/names-la.json');
const bad = []; let unused = 0;
for (const [name, la] of Object.entries(latin)) {
  if (!names.has(name)) unused++;
  if (!/^[A-Za-z .,\-()/IVXivx0-9']+$/.test(la) || /[А-Яа-яЁё]/.test(la)) bad.push(`not Latin: ${name} → ${la}`);
  if (la !== la.trim() || /\s{2,}/.test(la)) bad.push(`format: ${name} → ${la}`);
}
if (bad.length) { console.log(bad.slice(0, 20).join('\n')); throw new Error(`${bad.length} Latin name problems`); }
console.log(`latin ok: ${Object.keys(latin).length} names (${unused} belong to the removed female model)`);
