/**
 * Checks every text token against every surface token, in every theme, for WCAG AA contrast (4.5:1):
 * plain text, hover backgrounds, filled buttons (primary, danger), filled status tags, and theme-only
 * fills. Also reports panel and field edges below 3:1 (WCAG 1.4.11) as warnings.
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
/** Translucent tokens (hover): rgb(r g b / a). */
const parseRgba = (body) => Object.fromEntries(
   [...body.matchAll(/--fhql-([\w-]+):\s*rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)/g)].map(([, key, r, g, b, a]) => [key, [r, g, b, a].map(Number)]));
/** @returns {string} The hex color of a translucent color laid over a solid one. */
const over = ([r, g, b, a], hex) =>
{
   const base = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
   return `#${[r, g, b].map((c, i) => Math.round((c * a) + (base[i] * (1 - a))).toString(16).padStart(2, '0')).join('')}`;
};

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
const baseRgba = parseRgba(blocks[0][2]);
let warnings = 0;
const inks = ['ink', 'ink-muted', 'accent', ...Object.keys(base).filter((k) => k.startsWith('status-'))];
let failures = 0;

for (const [, name, body] of blocks)
{
   const tokens = { ...base, ...parse(body) };
   const rgba = { ...baseRgba, ...parseRgba(body) };
   const pairs = inks.flatMap((ink) => SURFACES.map((surface) =>
      ({ ink, surface, ratio: contrast(tokens[ink], tokens[surface]) })));
   pairs.push({ ink: 'accent-ink', surface: 'accent', ratio: contrast(tokens['accent-ink'], tokens.accent) });
   pairs.push({ ink: 'danger-ink', surface: 'status-failed', ratio: contrast(tokens['danger-ink'], tokens['status-failed']) });
   // Hovered rows and buttons: text on the hover tint over each surface.
   if (rgba.hover)
   {
      for (const surface of SURFACES) { pairs.push({ ink: 'ink', surface: `hover on ${surface}`, ratio: contrast(tokens.ink, over(rgba.hover, tokens[surface])) }); }
   }
   // Filled status tags (Gothic, Cabaret, Hope and Fear, Ledger): the surface color on each status.
   for (const status of Object.keys(tokens).filter((k) => k.startsWith('status-')))
   {
      pairs.push({ ink: 'surface', surface: `${status} fill`, ratio: contrast(tokens.surface, tokens[status]) });
   }
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
   // Edges of panels and fields (non-text contrast, 3:1): reported, not failed, since panels also
   // differ by fill and fields by their own background.
   for (const surface of ['surface', 'surface-raised'])
   {
      const ratio = contrast(tokens.rule, tokens[surface]);
      if (ratio < 3) { warnings += 1; console.log(`  note ${ratio.toFixed(2)} rule edge on ${surface} (below 3:1)`); }
   }
}

if (warnings) { console.log(`${warnings} edge notes (WCAG 1.4.11 asks 3:1 for edges that identify a control).`); }
process.exit(failures ? 1 : 0);
