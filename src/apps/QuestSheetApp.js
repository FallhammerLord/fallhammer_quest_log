import { HandlebarsApp } from '../compat.js';
import { MODULE_PATH } from '../constants.js';
import { applyTheme, trackApp, untrackApp } from '../theme.js';
import { clampToMinSize } from './minSize.js';
import { getQuestEntry } from '../data/quests.js';
import { QuestSheetMixin } from './QuestSheetMixin.js';
import { QuestLog } from './QuestLog.js';

/** A quest sheet in its own window, for a second monitor or side-by-side reading. One per quest. */
export class QuestSheetApp extends QuestSheetMixin(HandlebarsApp)
{
   /** @type {Map<string, QuestSheetApp>} Open windows by quest ID. */
   static #windows = new Map();

   /**
    * Opens (or focuses) the window for a quest.
    *
    * @param {string} questId - JournalEntry ID.
    * @returns {QuestSheetApp|undefined} The window.
    */
   static open(questId)
   {
      if (!getQuestEntry(questId)) { return undefined; }
      let app = QuestSheetApp.#windows.get(questId);
      if (!app)
      {
         app = new QuestSheetApp({ id: `fhql-quest-${questId}`, questId });
         QuestSheetApp.#windows.set(questId, app);
      }
      if (app.rendered) { app.bringToFront(); }
      else { app.render({ force: true }); }
      return app;
   }

   /** Closes every open quest window (the Beacon toggle closes them with the log). */
   static closeAll()
   {
      return Promise.all([...QuestSheetApp.#windows.values()].filter((app) => app.rendered).map((app) => app.close()));
   }

   /**
    * Re-renders open quest windows after a quest changes; closes windows whose quest is gone or hidden.
    *
    * @param {object} options - The document operation options.
    * @param {string} userId - The user who made the change.
    */
   static refreshAll(options, userId)
   {
      for (const app of QuestSheetApp.#windows.values())
      {
         if (!app.rendered) { continue; }
         if (!app.questEntry || (!game.user.isGM && !app.questEntry.testUserPermission(game.user, 'LIMITED')))
         {
            app.close();
            continue;
         }
         const quiet = userId === game.user.id && options?.fhqlQuiet;
         if (!quiet && !app._hasUnsavedEditor()) { app.render(); }
      }
   }

   static DEFAULT_OPTIONS = {
      classes: ['fhql-app', 'fhql-quest-sheet'],
      window: {
         icon: 'fa-solid fa-scroll',
         resizable: true
      },
      position: { width: 760, height: 640 }
   };

   static PARTS = {
      sheet: { template: `${MODULE_PATH}/templates/quest-sheet.hbs`, scrollable: [''] }
   };

   /** @override */
   get questId() { return this.options.questId; }

   /** @override */
   get title() { return this.questEntry?.name ?? game.i18n.localize('FHQL.QuestLog.Title'); }

   /** Navigating from a pop-out opens the target quest in the Quest Log. */
   showQuest(id, { edit = false } = {})
   {
      const api = game.modules.get('fhql').api;
      if (!edit) { api.openQuestLog(id); return; }
      const log = QuestLog.instance;
      log.select(id);
      log._editing = true;
      api.openQuestLog();
      if (log.rendered) { log.render(); }
   }

   /** @override */
   async _prepareContext(options)
   {
      const context = await super._prepareContext(options);
      return { ...context, popout: true, sheet: await this._prepareSheet(this.questEntry) };
   }

   /** Smallest readable size; the layout reflows down to this. */
   static MIN_SIZE = { width: 340, height: 320 };

   /** @override */
   _updatePosition(position)
   {
      return super._updatePosition(clampToMinSize(position, QuestSheetApp.MIN_SIZE));
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
      QuestSheetApp.#windows.delete(this.questId);
   }
}
