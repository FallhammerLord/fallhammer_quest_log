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

// The theme files src/theme.js loads as a fallback must match module.json, and every bundled font must
// exist with its licence beside it.
const { readFileSync, existsSync } = await import('node:fs');
const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('module.json', root), 'utf8'));
const themeSource = readFileSync(new URL('src/theme.js', root), 'utf8');
const listed = manifest.styles.filter((s) => s.startsWith('styles/themes/')).map((s) => s.slice(14, -4)).sort();
const inCode = (themeSource.match(/THEME_FILES = \[([^\]]*)\]/)?.[1] ?? '').match(/'([^']+)'/g)?.map((s) => s.slice(1, -1)).sort() ?? [];
const problems = [];
if (listed.join() !== inCode.join()) { problems.push(`THEME_FILES (${inCode}) differs from module.json themes (${listed})`); }
for (const [, path] of themeSource.matchAll(/\$\{MODULE_PATH\}\/(styles\/fonts\/[^`]+\.woff2)/g))
{
   if (!existsSync(new URL(path, root))) { problems.push(`missing font file ${path}`); }
   const licence = path.replace(/[^/]+$/, 'OFL.txt');
   if (!existsSync(new URL(licence, root))) { problems.push(`missing licence ${licence}`); }
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('Theme files and bundled fonts are consistent.');
