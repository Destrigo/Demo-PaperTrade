// Fails if en/fr/nl locale files don't have exactly the same keys.
import { readFileSync } from 'node:fs';

const langs = ['en', 'fr', 'nl'];
const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
const keys = Object.fromEntries(
  langs.map((l) => [l, new Set(flatten(JSON.parse(readFileSync(new URL(`../src/i18n/locales/${l}.json`, import.meta.url)))))]),
);
let ok = true;
for (const a of langs) {
  for (const b of langs) {
    if (a === b) continue;
    const missing = [...keys[a]].filter((k) => !keys[b].has(k));
    if (missing.length) {
      ok = false;
      console.error(`${b}.json is missing ${missing.length} key(s) from ${a}.json:\n  ${missing.join('\n  ')}`);
    }
  }
}
console.log(ok ? `Locales in sync (${keys.en.size} keys each).` : 'Locales out of sync.');
process.exit(ok ? 0 : 1);
