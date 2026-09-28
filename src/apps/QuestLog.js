import { HandlebarsApp, textEditor } from '../compat.js';
import { MODULE_PATH, STATUSES } from '../constants.js';
import { applyTheme, trackApp, untrackApp } from '../theme.js';
import {
   addObjective, createQuest, createSampleQuests, cycleObjective, deleteObjective, deleteQuest, getQuestEntry,
   questAccess, questPage, renameQuest, setStatus, updateQuest, visibleQuests
} from '../data/quests.js';

/** Update option marking an edit made from this window, so it re-renders only the list and keeps focus. */
const QUIET = { fhqlQuiet: true };

const OBJECTIVE_ICONS = { open: 'fa-regular fa-square', done: 'fa-solid fa-square-check', failed: 'fa-solid fa-square-xmark' };

/** The Quest Log window: quest list plus detail pane. Singleton. */
export class QuestLog extends HandlebarsApp
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
      position: { width: 780, height: 560 },
      actions: {
         selectQuest: QuestLog.#onSelectQuest,
         createQuest: QuestLog.#onCreateQuest,
         createSamples: QuestLog.#onCreateSamples,
         deleteQuest: QuestLog.#onDeleteQuest,
         addObjective: QuestLog.#onAddObjective,
         cycleObjective: QuestLog.#onCycleObjective,
         deleteObjective: QuestLog.#onDeleteObjective
      }
   };

   static PARTS = {
      list: { template: `${MODULE_PATH}/templates/quest-log-list.hbs`, scrollable: [''] },
      detail: { template: `${MODULE_PATH}/templates/quest-log-detail.hbs`, scrollable: [''] }
   };

   /** ID of the selected quest's JournalEntry. */
   #selectedId = null;

   /**
    * Selects a quest. Used by the API to open the log on a given quest.
    *
    * @param {string} id - JournalEntry ID.
    */
   select(id) { this.#selectedId = id; }

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

      const quests = entries.map((entry) =>
      {
         const { status, inProgress } = questPage(entry).system;
         return {
            id: entry.id,
            name: entry.name,
            status,
            inProgress,
            statusIcon: STATUSES[status].icon,
            statusLabel: game.i18n.localize(`FHQL.Status.${status}`),
            selected: entry.id === this.#selectedId
         };
      });

      return {
         ...context,
         gm: game.user.isGM,
         quests,
         selected: await this.#prepareSelected()
      };
   }

   /** @returns {Promise<object|null>} Render data for the selected quest. */
   async #prepareSelected()
   {
      const entry = getQuestEntry(this.#selectedId);
      if (!entry) { return null; }

      const page = questPage(entry);
      const system = page.system;
      const access = questAccess(entry);

      const objectives = access.full ? system.objectiveList
       .filter((objective) => access.gm || !objective.hidden)
       .map((objective) => ({
          ...objective,
          icon: OBJECTIVE_ICONS[objective.state],
          stateLabel: game.i18n.localize(`FHQL.Objective.${objective.state}`)
       })) : [];

      return {
         id: entry.id,
         name: entry.name,
         ...access,
         status: system.status,
         statusIcon: STATUSES[system.status].icon,
         statusLabel: game.i18n.localize(`FHQL.Status.${system.status}`),
         statusOptions: Object.keys(STATUSES).map((key) => ({
            value: key, label: game.i18n.localize(`FHQL.Status.${key}`), selected: key === system.status
         })),
         inProgress: system.inProgress,
         giverName: system.giver.name,
         description: system.description,
         descriptionHTML: access.full ? await textEditor().enrichHTML(system.description, {
            secrets: access.editable, relativeTo: page
         }) : '',
         playerNotes: system.playerNotes,
         objectives,
         doneCount: objectives.filter((objective) => objective.state === 'done').length
      };
   }

   /** @override */
   _onFirstRender(context, options)
   {
      super._onFirstRender(context, options);
      this.element.addEventListener('change', (event) => this.#onFieldChange(event));
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

   /**
    * Saves an edited field. Each input carries `data-field`; objective inputs also carry `data-objective-id`.
    *
    * @param {Event} event - The change event.
    */
   async #onFieldChange(event)
   {
      const input = event.target;
      const field = input.dataset?.field;
      const entry = getQuestEntry(this.#selectedId);
      if (!field || !entry) { return; }

      const value = input.type === 'checkbox' ? input.checked : input.value;
      const objectiveId = input.closest('[data-objective-id]')?.dataset.objectiveId;

      switch (field)
      {
         case 'name': return renameQuest(entry, value, QUIET);
         case 'status': return setStatus(entry, value);
         case 'inProgress': return updateQuest(entry, { 'system.inProgress': value });
         case 'objective.name': return updateQuest(entry, { [`system.objectives.${objectiveId}.name`]: value }, QUIET);
         case 'objective.hidden': return updateQuest(entry, { [`system.objectives.${objectiveId}.hidden`]: value });
         default: return updateQuest(entry, { [`system.${field}`]: value }, QUIET);
      }
   }

   /** @this {QuestLog} */
   static #onSelectQuest(event, target)
   {
      this.#selectedId = target.dataset.questId;
      this.render();
   }

   /** @this {QuestLog} */
   static async #onCreateQuest()
   {
      const entry = await createQuest();
      this.#selectedId = entry.id;
      this.render();
   }

   /** @this {QuestLog} */
   static async #onCreateSamples()
   {
      await createSampleQuests();
      this.render();
   }

   /** @this {QuestLog} */
   static async #onDeleteQuest()
   {
      const entry = getQuestEntry(this.#selectedId);
      if (entry && await deleteQuest(entry)) { this.#selectedId = null; }
   }

   /** @this {QuestLog} */
   static async #onAddObjective()
   {
      const entry = getQuestEntry(this.#selectedId);
      if (entry) { await addObjective(entry); }
   }

   /** @this {QuestLog} */
   static async #onCycleObjective(event, target)
   {
      const entry = getQuestEntry(this.#selectedId);
      const id = target.closest('[data-objective-id]')?.dataset.objectiveId;
      if (entry && id) { await cycleObjective(entry, id); }
   }

   /** @this {QuestLog} */
   static async #onDeleteObjective(event, target)
   {
      const entry = getQuestEntry(this.#selectedId);
      const id = target.closest('[data-objective-id]')?.dataset.objectiveId;
      if (entry && id) { await deleteObjective(entry, id); }
   }
}
