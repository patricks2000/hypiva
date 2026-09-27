// Lists English texts used with t("...") that have no translation yet. Run: npm run check:i18n
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
const nl = readFileSync('src/lib/i18n.nl.ts', 'utf8');
const missing = [...keys].filter((k) => !nl.includes(`'${k.replace(/'/g, "\\'")}':`));
if (missing.length) { console.log('Missing Dutch translations:\n' + missing.map((k) => '  ' + k).join('\n')); process.exit(1); }
console.log(`All ${keys.size} texts have a Dutch translation.`);
