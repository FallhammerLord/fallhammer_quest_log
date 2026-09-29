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
