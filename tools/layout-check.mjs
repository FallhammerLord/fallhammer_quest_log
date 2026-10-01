/**
 * Renders the real templates and stylesheet in Chromium at a range of widths and reports text that
 * overflows its box. Writes screenshots to tools/out/. Usage: npm run layout
 *
 * Set CHROMIUM_PATH to use an installed Chromium instead of Playwright's download.
 */
import Handlebars from 'handlebars';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { listContext, sheetContext } from './fixtures.mjs';

const root = new URL('..', import.meta.url).pathname;
const out = `${root}tools/out`;
mkdirSync(out, { recursive: true });

const lang = JSON.parse(readFileSync(`${root}lang/en.json`, 'utf8'));
const t = (key) => key.replace(/^FHQL\./, '').split('.').reduce((o, p) => o?.[p], lang.FHQL) ?? key;
Handlebars.registerHelper('localize', (key) => t(key));
const tpl = (name) => Handlebars.compile(readFileSync(`${root}templates/${name}.hbs`, 'utf8'));
const listT = tpl('quest-log-list');
const sheetT = tpl('quest-sheet');
// Every stylesheet module.json loads, in its order. Foundry's parchment image isn't available offline.
const css = JSON.parse(readFileSync(`${root}module.json`, 'utf8')).styles
 .map((path) => readFileSync(`${root}${path}`, 'utf8')).join('\n')
 .replaceAll('url("../../../ui/parchment.jpg")', 'none');
const fa = `${root}node_modules/@fortawesome/fontawesome-free/css/all.min.css`;

// Pop-out sheet widths from its minimum up, and Quest Log widths from its minimum up.
const SHEET_WIDTHS = [340, 400, 480, 560, 700];
const LOG_WIDTHS = [420, 540, 700, 900, 1040];
// Each case runs in its theme; the wide-font cases stand in for a wide font a GM might upload.
const WIDE_FONT = '"DejaVu Sans Mono", "Liberation Mono", monospace';
const CASES = [
   { name: 'gm-read', gm: true, editing: false, theme: 'dark' },
   { name: 'gm-edit', gm: true, editing: true, theme: 'dark' },
   { name: 'player', gm: false, editing: false, theme: 'dark' },
   { name: 'gm-read-scifi', gm: true, editing: false, theme: 'scifi' },
   { name: 'gm-edit-gothic', gm: true, editing: true, theme: 'gothic' },
   { name: 'gm-read-ledger', gm: true, editing: false, theme: 'ledger' },
   { name: 'player-ledger', gm: false, editing: false, theme: 'ledger' },
   // Theme textures off: the class follows the theme name into the window's class list.
   { name: 'gm-read-gothic-smooth', gm: true, editing: false, theme: 'gothic fhql-no-texture' },
   { name: 'gm-read-widefont', gm: true, editing: false, theme: 'light', font: WIDE_FONT },
   { name: 'gm-edit-widefont', gm: true, editing: true, theme: 'light', font: WIDE_FONT }
];

const frame = (kind, width, theme, body, font) => `<section class="application fhql-app fhql-theme-${theme} ${kind === 'sheet' ? 'fhql-quest-sheet' : 'fhql-quest-log'}"
  style="width:${width}px;height:900px;display:flex;flex-direction:column;border:1px solid #000;margin:8px;${font ? `--fhql-font-body:${font};--fhql-font-heading:${font};` : ''}">
  <header style="background:#111;color:#eee;padding:4px 8px;font:13px sans-serif">${kind} ${width}px</header>
  <div class="window-content" style="flex:1;min-height:0">${body}</div></section>`;

const pages = [];
for (const c of CASES)
{
   for (const width of SHEET_WIDTHS) { pages.push({ id: `sheet-${c.name}-${width}`, html: frame('sheet', width, c.theme, sheetT({ ...sheetContext(t, c), popout: true }), c.font) }); }
   for (const width of LOG_WIDTHS)
   {
      const ctx = { ...listContext(t, c.gm), ...sheetContext(t, c) };
      pages.push({ id: `log-${c.name}-${width}`, html: frame('log', width, c.theme, listT(ctx) + sheetT(ctx), c.font) });
   }
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
const problems = [];

for (const p of pages)
{
   writeFileSync(`${out}/${p.id}.html`, `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="file://${fa}">
     <style>body{margin:0;background:#444;font-family:sans-serif}*{box-sizing:border-box}button,input,select{font:inherit}${css}</style></head><body>${p.html}</body></html>`);
   await page.goto(`file://${out}/${p.id}.html`);
   const found = await page.evaluate(() =>
   {
      const issues = [];
      const app = document.querySelector('.application');
      const edge = app.getBoundingClientRect().right;
      for (const el of app.querySelectorAll('.window-content *'))
      {
         const cs = getComputedStyle(el);
         if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[hidden], .sr-only, details:not([open]) > :not(summary)')) { continue; }
         const r = el.getBoundingClientRect();
         if (!r.width) { continue; }
         const label = `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${(el.textContent || el.value || '').trim().slice(0, 30)}"`;
         if (r.right > edge + 1) { issues.push(`past window edge by ${Math.round(r.right - edge)}px: ${label}`); continue; }
         const clipsOnPurpose = cs.textOverflow === 'ellipsis' || ['auto', 'scroll', 'hidden'].includes(cs.overflowX);
         if (!clipsOnPurpose && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && !['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName))
         {
            issues.push(`content wider than box by ${el.scrollWidth - el.clientWidth}px: ${label}`);
         }
      }
      // Foundry's own form and editor styles break inside a size container (found in testing), so no
      // text field or editor may sit inside one below the sheet level.
      for (const field of app.querySelectorAll('input, textarea, select, prose-mirror'))
      {
         for (let node = field.parentElement; node && !node.classList.contains('fhql-sheet') && node !== app; node = node.parentElement)
         {
            if (getComputedStyle(node).containerType !== 'normal')
            {
               issues.push(`text field inside a width container (${node.tagName.toLowerCase()}.${[...node.classList].join('.')})`);
               break;
            }
         }
      }
      return [...new Set(issues)];
   });
   await page.screenshot({ path: `${out}/${p.id}.png`, fullPage: true });
   for (const issue of found) { problems.push(`${p.id}: ${issue}`); }
}
await browser.close();

console.log(problems.length ? problems.join('\n') : 'No overflow found.');
console.log(`\n${pages.length} layouts checked. Screenshots in tools/out/.`);
process.exit(problems.length ? 1 : 0);
