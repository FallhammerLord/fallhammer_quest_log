import { HandlebarsApp } from '../compat.js';
import { MODULE_PATH, STATUSES } from '../constants.js';
import { applyTheme, trackApp, untrackApp } from '../theme.js';

/**
 * Stand-in quests so the layout and themes can be checked before the data model exists (milestone 2).
 * Covers every status, a long name, and hidden-objective styling.
 */
const PREVIEW_QUESTS = [
   {
      id: 'p1', name: 'The Ember Road', status: 'active', giver: 'Warden Hask',
      description: 'Escort the salt caravan through the burned pass before the rains close it.',
      objectives: [
         { name: 'Meet the caravan at Cinderford', done: true },
         { name: 'Clear the rockfall at the switchbacks', done: false },
         { name: 'Deliver the salt to Highmere', done: false }
      ]
   },
   {
      id: 'p2', name: 'A Very Long Quest Name That Should Truncate Cleanly In Narrow Layouts', status: 'available',
      giver: 'Notice board', description: 'Checks truncation and wrapping.', objectives: []
   },
   {
      id: 'p3', name: 'Signal From the Deep Array', status: 'completed', giver: 'Station AI',
      description: 'Trace the repeating signal to its source.',
      objectives: [{ name: 'Triangulate the signal', done: true }, { name: 'Report to command', done: true }]
   },
   {
      id: 'p4', name: 'Hold the Bridge', status: 'failed', giver: 'Captain Oro',
      description: 'The bridge fell. The pass is closed until spring.',
      objectives: [{ name: 'Keep the bridge standing until dawn', done: false, failed: true }]
   },
   {
      id: 'p5', name: 'Whispers in the Archive', status: 'hidden', giver: 'Unknown',
      description: 'Not yet revealed to players.', objectives: []
   }
];

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
      position: { width: 760, height: 540 },
      actions: {
         selectQuest: QuestLog.#onSelectQuest
      }
   };

   static PARTS = {
      list: { template: `${MODULE_PATH}/templates/quest-log-list.hbs`, scrollable: [''] },
      detail: { template: `${MODULE_PATH}/templates/quest-log-detail.hbs`, scrollable: [''] }
   };

   /** ID of the selected quest. */
   #selectedId = PREVIEW_QUESTS[0].id;

   /** @override */
   async _prepareContext(options)
   {
      const context = await super._prepareContext(options);

      const quests = PREVIEW_QUESTS.map((quest) => ({
         ...quest,
         statusIcon: STATUSES[quest.status].icon,
         statusLabel: game.i18n.localize(`FHQL.Status.${quest.status}`),
         selected: quest.id === this.#selectedId,
         doneCount: quest.objectives.filter((o) => o.done).length
      }));

      return {
         ...context,
         preview: true,
         quests,
         selected: quests.find((quest) => quest.selected) ?? null
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
   }

   /**
    * @this {QuestLog}
    * @param {PointerEvent} event - The click.
    * @param {HTMLElement} target - The clicked quest row.
    */
   static #onSelectQuest(event, target)
   {
      this.#selectedId = target.dataset.questId;
      this.render();
   }
}
