import { HandlebarsApp } from '../compat.js';
import { MODULE_PATH, STATUSES } from '../constants.js';
import { applyTheme, trackApp, untrackApp } from '../theme.js';
import { importFqlQuests, scanFqlQuests } from '../import/fql.js';

const STATUS_MAP = { inactive: 'hidden', available: 'available', active: 'active', completed: 'completed', failed: 'failed' };

/** Preview-then-import window for Forien's Quest Log data. GM only. See docs/SCOPE.md section 8. */
export class FqlImportApp extends HandlebarsApp
{
   static DEFAULT_OPTIONS = {
      id: 'fhql-fql-import',
      classes: ['fhql-app', 'fhql-import'],
      window: { title: 'FHQL.Import.Title', icon: 'fa-solid fa-file-import', resizable: true },
      position: { width: 620, height: 600 },
      actions: {
         runImport: FqlImportApp.#onRunImport,
         closeImport: FqlImportApp.#onClose
      }
   };

   static PARTS = {
      body: { template: `${MODULE_PATH}/templates/fql-import.hbs`, scrollable: ['.fhql-import-list'] }
   };

   /** Result of the last run, shown instead of the preview. */
   #report = null;

   /** Whether an import is running. */
   #running = false;

   /** @override */
   async _prepareContext(options)
   {
      const context = await super._prepareContext(options);
      if (this.#report) { return { ...context, report: this.#report }; }

      const quests = scanFqlQuests().map(({ entry, fql, imported }) =>
      {
         const status = STATUS_MAP[fql.status] ?? 'hidden';
         return {
            id: entry.id,
            name: entry.name,
            status,
            icon: STATUSES[status].icon,
            label: game.i18n.localize(`FHQL.Status.${status}`),
            objectives: (fql.tasks ?? []).length,
            rewards: (fql.rewards ?? []).length,
            subquest: !!fql.parent,
            imported
         };
      });

      return {
         ...context,
         running: this.#running,
         quests,
         newCount: quests.filter((q) => !q.imported).length,
         importedCount: quests.filter((q) => q.imported).length
      };
   }

   /** @override */
   _onRender(context, options)
   {
      super._onRender(context, options);
      applyTheme(this.element);
      trackApp(this);
   }

   /** @override */
   _onClose(options)
   {
      super._onClose(options);
      untrackApp(this);
      this.#report = null;
   }

   /** @this {FqlImportApp} */
   static async #onRunImport()
   {
      if (this.#running) { return; }
      const form = this.element.querySelector('.fhql-import-form');
      const overwrite = [...form.querySelectorAll('input[name="overwrite"]:checked')].map((input) => input.value);
      const moveToFolder = form.querySelector('input[name="moveToFolder"]')?.checked ?? true;

      this.#running = true;
      await this.render();
      try { this.#report = await importFqlQuests({ overwrite, moveToFolder }); }
      finally { this.#running = false; }
      await this.render();
   }

   /** @this {FqlImportApp} */
   static #onClose()
   {
      this.close();
   }
}
