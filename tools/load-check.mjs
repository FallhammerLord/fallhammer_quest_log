/**
 * Loads the whole module graph in Node with Foundry mocked, to catch a missing or misnamed import.
 * One bad import stops the entire module in Foundry, and ESLint doesn't check that imports exist.
 * Usage: npm run load
 */
const cls = class {};
const any = new Proxy(function () {}, {
   get: (target, key) => (key === Symbol.toPrimitive ? () => '' : any),
   apply: () => any,
   construct: () => any
});

globalThis.foundry = {
   applications: {
      api: { ApplicationV2: cls, HandlebarsApplicationMixin: (Base) => class extends Base {}, DialogV2: cls },
      sheets: { journal: { JournalEntryPageHandlebarsSheet: class { static EDIT_PARTS = { header: {}, footer: {} }; } } },
      apps: { DocumentSheetConfig: cls, DocumentOwnershipConfig: cls },
      ux: { TextEditor: cls }
   },
   abstract: { TypeDataModel: cls },
   data: { fields: any },
   utils: any
};
globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 }, SORT_INTEGER_DENSITY: 100000 };
globalThis.Hooks = { on() {}, once() {} };
globalThis.game = any;
globalThis.CONFIG = any;
globalThis.ui = any;

try
{
   await import(new URL('../src/main.js', import.meta.url));
   console.log('Module graph loads.');
}
catch (err)
{
   console.error(`Module failed to load: ${err.message}`);
   process.exit(1);
}

// The style files src/theme.js loads as a fallback must match module.json, in order, and every bundled font must
// exist with its licence beside it.
const { readFileSync, existsSync } = await import('node:fs');
const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('module.json', root), 'utf8'));
const themeSource = readFileSync(new URL('src/theme.js', root), 'utf8');
const listed = manifest.styles.map((s) => s.slice(7, -4));
const inCode = (themeSource.match(/STYLE_FILES = \[([^\]]*)\]/)?.[1] ?? '').match(/'([^']+)'/g)?.map((s) => s.slice(1, -1)) ?? [];
const problems = [];
if (listed.join() !== inCode.join()) { problems.push(`STYLE_FILES (${inCode}) differs from module.json styles, in order (${listed})`); }
for (const path of manifest.styles) { if (!existsSync(new URL(path, root))) { problems.push(`missing style file ${path}`); } }
for (const [, path] of themeSource.matchAll(/\$\{MODULE_PATH\}\/(styles\/fonts\/[^`]+\.woff2)/g))
{
   if (!existsSync(new URL(path, root))) { problems.push(`missing font file ${path}`); }
   const licence = path.replace(/[^/]+$/, 'OFL.txt');
   if (!existsSync(new URL(licence, root))) { problems.push(`missing licence ${licence}`); }
}
// Every partial file is in PARTIALS (or Foundry never loads it), and every partial a template uses exists.
const { readdirSync } = await import('node:fs');
const { PARTIALS } = await import('../src/constants.js');
const partialFiles = readdirSync(new URL('templates/partials/', root)).map((f) => `modules/fhql/templates/partials/${f}`).sort();
if ([...PARTIALS].sort().join() !== partialFiles.join()) { problems.push(`PARTIALS (${PARTIALS}) differs from templates/partials/ (${partialFiles})`); }
for (const file of readdirSync(new URL('templates/', root)).filter((f) => f.endsWith('.hbs')))
{
   for (const [, name] of readFileSync(new URL(`templates/${file}`, root), 'utf8').matchAll(/\{\{>\s*"([^"]+)"/g))
   {
      if (!PARTIALS.includes(name)) { problems.push(`${file} uses partial ${name}, which isn't in PARTIALS`); }
   }
}
const { TEMPLATES } = await import('../src/constants.js');
for (const path of Object.values(TEMPLATES))
{
   if (!existsSync(new URL(path.replace('modules/fhql/', ''), root))) { problems.push(`missing template ${path}`); }
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('Style files, bundled fonts and template partials are consistent.');
