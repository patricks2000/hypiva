// Lists English texts used with t("...") that are missing in a language file. Run: npm run check:i18n
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) && files.push(p); } };
walk('src');
const keys = new Set();
const re = /\bt\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(re)) {
  const raw = m[1];
  keys.add(raw[0] === '"' ? JSON.parse(raw) : raw.slice(1, -1).replace(/\\'/g, "'"));
}
let failed = false;
for (const lang of ['nl', 'de', 'fr', 'es', 'it', 'pt', 'pl', 'tr']) {
  const dict = readFileSync(`src/lib/i18n.${lang}.ts`, 'utf8');
  const missing = [...keys].filter((k) => !dict.includes(`'${k.replace(/'/g, "\\'")}':`));
  if (missing.length) { failed = true; console.log(`Missing ${lang} translations:\n` + missing.map((k) => '  ' + k).join('\n')); }
}
if (failed) process.exit(1);
console.log(`All ${keys.size} texts are translated into every language.`);
