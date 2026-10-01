/**
 * Checks every text token against every surface token, in every theme, for WCAG AA contrast (4.5:1).
 * Reads every stylesheet module.json loads (base first). Exits non-zero on any failure. Usage: npm run contrast
 */
import { readFileSync } from 'node:fs';

const MIN = 4.5;
const SURFACES = ['surface', 'surface-raised', 'surface-sunken'];

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const css = JSON.parse(read('module.json')).styles.map(read).join('\n');
const blocks = [...css.matchAll(/\/\* -+ Tokens: ([^*]+?) -+ \*\/\n[^{]*\{([^}]*)\}/g)];

const parse = (body) => Object.fromEntries(
   [...body.matchAll(/--fhql-([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map(([, key, hex]) => [key, hex]));

const channel = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = (hex) =>
{
   const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
   return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
};
const contrast = (a, b) =>
{
   const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
   return (hi + 0.05) / (lo + 0.05);
};

const base = parse(blocks[0][2]);
const inks = ['ink', 'ink-muted', 'accent', ...Object.keys(base).filter((k) => k.startsWith('status-'))];
let failures = 0;

for (const [, name, body] of blocks)
{
   const tokens = { ...base, ...parse(body) };
   const pairs = inks.flatMap((ink) => SURFACES.map((surface) =>
      ({ ink, surface, ratio: contrast(tokens[ink], tokens[surface]) })));
   pairs.push({ ink: 'accent-ink', surface: 'accent', ratio: contrast(tokens['accent-ink'], tokens.accent) });
   // Theme-only fills: banner bars and meters (Ledger).
   for (const [ink, fill] of [['banner-ink', 'banner'], ['meter-ink', 'meter']])
   {
      if (tokens[ink] && tokens[fill]) { pairs.push({ ink, surface: fill, ratio: contrast(tokens[ink], tokens[fill]) }); }
   }

   const bad = pairs.filter((p) => p.ratio < MIN);
   const worst = pairs.reduce((a, b) => (a.ratio < b.ratio ? a : b));
   failures += bad.length;

   console.log(`${name.trim()}: worst ${worst.ratio.toFixed(2)} (${worst.ink} on ${worst.surface})`);
   for (const p of bad) { console.log(`  FAIL ${p.ratio.toFixed(2)} ${p.ink} on ${p.surface}`); }
}

process.exit(failures ? 1 : 0);
