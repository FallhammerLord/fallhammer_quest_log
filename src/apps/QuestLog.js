import { HandlebarsApp } from '../compat.js';
import { MODULE_PATH, STATUSES } from '../constants.js';
import { applyTheme, trackApp, untrackApp } from '../theme.js';
import { createQuest, createSampleQuests, questPage, visibleQuests } from '../data/quests.js';
import { QuestSheetMixin } from './QuestSheetMixin.js';

/** The Quest Log window: quest list plus a quest sheet in the detail pane. Singleton. */
export class QuestLog extends QuestSheetMixin(HandlebarsApp)
{
   /** @type {QuestLog} */
   static #instance;

   /** @returns {QuestLog} The shared Quest Log window. */
   static get instance() { return QuestLog.#instance ??= new QuestLog(); }

   static DEFAULT_OPTIONS = {
      id: 'fhql-quest-log',
      classes: ['fhql-app', 'fhql-quest-log'],
      window: {
         title: 'FHQL.QuestLog.Title',
         icon: 'fa-solid fa-scroll',
         resizable: true
      },
      position: { width: 820, height: 620 },
      actions: {
         selectQuest: QuestLog.#onSelectQuest,
         createQuest: QuestLog.#onCreateQuest,
         createSamples: QuestLog.#onCreateSamples
      }
   };

   static PARTS = {
      list: { template: `${MODULE_PATH}/templates/quest-log-list.hbs`, scrollable: [''] },
      detail: { template: `${MODULE_PATH}/templates/quest-sheet.hbs`, scrollable: [''] }
   };

   /** ID of the selected quest's JournalEntry. */
   #selectedId = null;

   /** @override */
   get questId() { return this.#selectedId; }

   /**
    * Selects a quest. Used by the API to open the log on a given quest.
    *
    * @param {string} id - JournalEntry ID.
    */
   select(id)
   {
      if (id !== this.#selectedId) { this._editing = false; }
      this.#selectedId = id;
   }

   /** @override */
   showQuest(id)
   {
      this.select(id);
      this.render();
   }

   /**
    * Re-renders after a quest document changes anywhere.
    *
    * @param {object} options - The document operation options.
    * @param {string} userId - The user who made the change.
    */
   onQuestChanged(options, userId)
   {
      if (!this.rendered) { return; }
      const quiet = userId === game.user.id && options?.fhqlQuiet;
      this.render(quiet ? { parts: ['list'] } : {});
   }

   /** @override */
   async _prepareContext(options)
   {
      const context = await super._prepareContext(options);
      const entries = visibleQuests();

      if (!entries.some((entry) => entry.id === this.#selectedId)) { this.#selectedId = entries[0]?.id ?? null; }

      return {
         ...context,
         gm: game.user.isGM,
         quests: this.#questTree(entries),
         sheet: await this._prepareSheet(this.questEntry)
      };
   }

   /**
    * Orders quests as a tree: each quest followed by its subquests, indented. A quest whose parent the
    * user can't see is shown at the top level.
    *
    * @param {JournalEntry[]} entries - Visible quests, already sorted.
    * @returns {object[]} Rows for the list.
    */
   #questTree(entries)
   {
      const ids = new Set(entries.map((e) => e.id));
      const childrenOf = new Map();
      const roots = [];
      for (const entry of entries)
      {
         const parent = questPage(entry).system.parent;
         if (parent && ids.has(parent)) { childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), entry]); }
         else { roots.push(entry); }
      }

      const rows = [];
      const seen = new Set();
      const add = (entry, depth) =>
      {
         if (seen.has(entry.id)) { return; }
         seen.add(entry.id);
         const { status, inProgress } = questPage(entry).system;
         rows.push({
            id: entry.id,
            name: entry.name,
            status,
            inProgress,
            depth: Math.min(depth, 4),
            statusIcon: STATUSES[status].icon,
            statusLabel: game.i18n.localize(`FHQL.Status.${status}`),
            selected: entry.id === this.#selectedId
         });
         for (const child of childrenOf.get(entry.id) ?? []) { add(child, depth + 1); }
      };
      for (const root of roots) { add(root, 0); }
      return rows;
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
   }

   /** @this {QuestLog} */
   static #onSelectQuest(event, target)
   {
      this.showQuest(target.dataset.questId);
   }

   /** @this {QuestLog} */
   static async #onCreateQuest()
   {
      const entry = await createQuest();
      this.select(entry.id);
      this._editing = true;
      this.render();
   }

   /** @this {QuestLog} */
   static async #onCreateSamples()
   {
      await createSampleQuests();
      this.render();
   }
}
