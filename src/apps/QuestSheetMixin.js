import { DialogV2, DocumentOwnershipConfig, textEditor } from '../compat.js';
import { MODULE_ID, STATUSES } from '../constants.js';
import {
   addObjective, addRewardFromDocument, addTextReward, clearGiver, createSubquest, cycleObjective, deleteObjective,
   deleteQuest, deleteReward, getQuestEntry, gmNotesPage, parentCandidates, questAccess, questPage, renameQuest,
   setGiverFromDocument, setGmNotes, setParent, setStatus, subquests, updateQuest
} from '../data/quests.js';

/** Update option marking a text edit made from this window, so it re-renders lightly and keeps focus. */
export const QUIET = { fhqlQuiet: true };

const OBJECTIVE_ICONS = { open: 'fa-regular fa-square', done: 'fa-solid fa-square-check', failed: 'fa-solid fa-square-xmark' };
const REWARD_ICONS = { item: 'fa-solid fa-gem', actor: 'fa-solid fa-user', text: 'fa-solid fa-coins' };

/** One-click status changes in the read view, by current status. */
const STATUS_ACTIONS = {
   hidden: [['available', 'Reveal'], ['active', 'RevealActive']],
   available: [['active', 'Start'], ['completed', 'Complete'], ['failed', 'Fail'], ['hidden', 'Hide']],
   active: [['completed', 'Complete'], ['failed', 'Fail'], ['hidden', 'Hide']],
   completed: [['active', 'Reopen'], ['hidden', 'Hide']],
   failed: [['active', 'Reopen'], ['hidden', 'Hide']]
};

/**
 * Quest sheet behavior shared by the Quest Log's detail pane and the pop-out Quest Sheet window:
 * render context, read/edit mode, actions, field saves, and drag-and-drop. See docs/SCOPE.md 7.4.
 *
 * Subclasses provide `questId` (the quest shown) and `showQuest(id)` (navigate to another quest).
 *
 * @param {typeof foundry.applications.api.ApplicationV2} Base - Base application class.
 * @returns {typeof foundry.applications.api.ApplicationV2} The mixed class.
 */
export function QuestSheetMixin(Base)
{
   return class QuestSheet extends Base
   {
      static DEFAULT_OPTIONS = {
         actions: {
            editQuest: QuestSheet.#onEditQuest,
            finishEditing: QuestSheet.#onFinishEditing,
            setQuestStatus: QuestSheet.#onSetQuestStatus,
            toggleInProgress: QuestSheet.#onToggleInProgress,
            deleteQuest: QuestSheet.#onDeleteQuest,
            addObjective: QuestSheet.#onAddObjective,
            cycleObjective: QuestSheet.#onCycleObjective,
            deleteObjective: QuestSheet.#onDeleteObjective,
            addTextReward: QuestSheet.#onAddTextReward,
            deleteReward: QuestSheet.#onDeleteReward,
            openDocument: QuestSheet.#onOpenDocument,
            clearGiver: QuestSheet.#onClearGiver,
            showQuest: QuestSheet.#onShowQuest,
            addSubquest: QuestSheet.#onAddSubquest,
            setParent: QuestSheet.#onSetParent,
            manageAccess: QuestSheet.#onManageAccess,
            popOut: QuestSheet.#onPopOut
         }
      };

      /** Whether the shown quest is in edit mode. Edits save as each field changes; Done returns to view. */
      _editing = false;

      /** @returns {string|null} JournalEntry ID of the quest shown. Subclasses override. */
      get questId() { return null; }

      /**
       * Shows another quest. Subclasses override.
       *
       * @param {string} _id - Quest to show.
       */
      showQuest(_id) {}

      /** @returns {JournalEntry|undefined} The quest shown. */
      get questEntry() { return getQuestEntry(this.questId); }

      /**
       * Builds the render data for one quest.
       *
       * @param {JournalEntry} entry - The quest entry.
       * @returns {Promise<object|null>} Sheet context.
       */
      async _prepareSheet(entry)
      {
         if (!entry) { return null; }

         const page = questPage(entry);
         const system = page.system;
         const access = questAccess(entry);
         const editing = access.editable && this._editing;
         const enrich = (html) => textEditor().enrichHTML(html ?? '', { secrets: access.editable, relativeTo: page });
         const localize = (key) => game.i18n.localize(key);

         const objectives = access.full ? system.objectiveList
          .filter((o) => access.gm || !o.hidden)
          .map((o) => ({ ...o, icon: OBJECTIVE_ICONS[o.state], stateLabel: localize(`FHQL.Objective.${o.state}`) })) : [];

         const rewards = access.full ? Object.entries(system.rewards)
          .map(([id, r]) => ({ id, ...r, icon: REWARD_ICONS[r.type] ?? REWARD_ICONS.text, linked: !!r.uuid }))
          .filter((r) => access.gm || !r.hidden)
          .sort((a, b) => a.sort - b.sort) : [];

         const parentEntry = getQuestEntry(system.parent);
         const parent = parentEntry && questAccess(parentEntry).visible ? { id: parentEntry.id, name: parentEntry.name } : null;

         const children = subquests(entry).map((child) =>
         {
            const status = questPage(child).system.status;
            return { id: child.id, name: child.name, status, icon: STATUSES[status].icon, label: localize(`FHQL.Status.${status}`) };
         });

         const gmPage = access.gm ? gmNotesPage(entry) : null;
         const gmNotesRaw = gmPage?.text.content ?? '';

         return {
            id: entry.id,
            name: entry.name,
            ...access,
            editing,
            status: system.status,
            statusIcon: STATUSES[system.status].icon,
            statusLabel: localize(`FHQL.Status.${system.status}`),
            statusOptions: Object.keys(STATUSES).map((key) => ({
               value: key, label: localize(`FHQL.Status.${key}`), selected: key === system.status
            })),
            statusActions: access.gm ? (STATUS_ACTIONS[system.status] ?? []).map(([target, verb]) => ({
               status: target, icon: STATUSES[target].icon, label: localize(`FHQL.QuestLog.StatusAction.${verb}`)
            })) : [],
            inProgress: system.inProgress,
            giver: { ...system.giver, linked: !!system.giver.uuid },
            parent,
            description: system.description,
            descriptionHTML: access.full ? await enrich(system.description) : '',
            objectives,
            doneCount: objectives.filter((o) => o.state === 'done').length,
            rewards,
            subquests: children,
            showHiddenNotice: access.gm && system.status === 'hidden',
            showObjectives: objectives.length > 0 || editing,
            showRewards: rewards.length > 0 || editing,
            textRewardEditing: { text: editing },
            playerNotes: system.playerNotes,
            playerNotesHTML: access.full ? await enrich(system.playerNotes) : '',
            gmNotes: access.gm ? {
               raw: gmNotesRaw,
               html: await enrich(gmNotesRaw),
               open: editing || game.settings.get(MODULE_ID, 'gmNotesOpen')
            } : null
         };
      }

      /** @override */
      _onFirstRender(context, options)
      {
         super._onFirstRender(context, options);
         const el = this.element;
         el.addEventListener('change', (event) => this.#onFieldChange(event));
         el.addEventListener('dragover', (event) => this.#onDragOver(event));
         el.addEventListener('dragleave', (event) => event.target.closest?.('[data-drop]')?.classList.remove('is-drop-target'));
         el.addEventListener('drop', (event) => this.#onDrop(event));
         el.addEventListener('toggle', (event) =>
         {
            if (event.target.matches?.('details.fhql-gm-notes') && !this._editing)
            {
               game.settings.set(MODULE_ID, 'gmNotesOpen', event.target.open);
            }
         }, true);
         el.addEventListener('click', (event) =>
         {
            for (const menu of el.querySelectorAll('details.fhql-menu[open]'))
            {
               if (!menu.contains(event.target)) { menu.open = false; }
            }
         });
      }

      /**
       * Saves an edited field. Inputs carry `data-field`; objective and reward inputs sit inside rows
       * carrying `data-objective-id` or `data-reward-id`.
       *
       * @param {Event} event - The change event.
       */
      async #onFieldChange(event)
      {
         const input = event.target;
         const field = input.dataset?.field;
         const entry = this.questEntry;
         if (!field || !entry) { return; }

         const value = input.type === 'checkbox' ? input.checked : input.value;
         const objectiveId = input.closest('[data-objective-id]')?.dataset.objectiveId;
         const rewardId = input.closest('[data-reward-id]')?.dataset.rewardId;

         switch (field)
         {
            case 'name': return renameQuest(entry, value, QUIET);
            case 'status': return setStatus(entry, value);
            case 'inProgress': return updateQuest(entry, { 'system.inProgress': value });
            case 'giver.name': return updateQuest(entry, { 'system.giver.name': value }, QUIET);
            case 'description':
            case 'playerNotes': return updateQuest(entry, { [`system.${field}`]: value });
            case 'gmNotes': return setGmNotes(entry, value);
            case 'objective.name': return updateQuest(entry, { [`system.objectives.${objectiveId}.name`]: value }, QUIET);
            case 'objective.hidden': return updateQuest(entry, { [`system.objectives.${objectiveId}.hidden`]: value });
            case 'reward.name': return updateQuest(entry, { [`system.rewards.${rewardId}.name`]: value }, QUIET);
            case 'reward.hidden': return updateQuest(entry, { [`system.rewards.${rewardId}.hidden`]: value });
         }
      }

      /** @param {DragEvent} event - Drag over a drop zone. */
      #onDragOver(event)
      {
         const zone = event.target.closest?.('[data-drop]');
         if (!zone || !this.questEntry || !questAccess(this.questEntry).editable) { return; }
         event.preventDefault();
         zone.classList.add('is-drop-target');
      }

      /** @param {DragEvent} event - Drop onto the giver portrait or the rewards section. */
      async #onDrop(event)
      {
         const zone = event.target.closest?.('[data-drop]');
         const entry = this.questEntry;
         if (!zone || !entry || !questAccess(entry).editable) { return; }
         event.preventDefault();
         event.stopPropagation();
         zone.classList.remove('is-drop-target');

         const data = textEditor().getDragEventData(event);
         const doc = data?.uuid ? await fromUuid(data.uuid) : null;
         const accepted = zone.dataset.drop === 'giver'
          ? await setGiverFromDocument(entry, doc)
          : await addRewardFromDocument(entry, doc);

         if (!accepted) { ui.notifications.warn(game.i18n.localize(`FHQL.Drop.Rejected.${zone.dataset.drop}`)); }
      }

      /** @this {QuestSheet} */
      static #onEditQuest()
      {
         this._editing = true;
         this.render();
      }

      /** @this {QuestSheet} */
      static #onFinishEditing()
      {
         this._editing = false;
         this.render();
      }

      /** @this {QuestSheet} */
      static async #onSetQuestStatus(event, target)
      {
         if (this.questEntry) { await setStatus(this.questEntry, target.dataset.status); }
      }

      /** @this {QuestSheet} */
      static async #onToggleInProgress()
      {
         const entry = this.questEntry;
         if (entry) { await updateQuest(entry, { 'system.inProgress': !questPage(entry).system.inProgress }); }
      }

      /** @this {QuestSheet} */
      static async #onDeleteQuest()
      {
         const entry = this.questEntry;
         if (entry && await deleteQuest(entry)) { this._editing = false; }
      }

      /** @this {QuestSheet} */
      static async #onAddObjective()
      {
         if (this.questEntry) { await addObjective(this.questEntry); }
      }

      /** @this {QuestSheet} */
      static async #onCycleObjective(event, target)
      {
         const id = target.closest('[data-objective-id]')?.dataset.objectiveId;
         if (this.questEntry && id) { await cycleObjective(this.questEntry, id); }
      }

      /** @this {QuestSheet} */
      static async #onDeleteObjective(event, target)
      {
         const id = target.closest('[data-objective-id]')?.dataset.objectiveId;
         if (this.questEntry && id) { await deleteObjective(this.questEntry, id); }
      }

      /** @this {QuestSheet} */
      static async #onAddTextReward()
      {
         if (this.questEntry) { await addTextReward(this.questEntry); }
      }

      /** @this {QuestSheet} */
      static async #onDeleteReward(event, target)
      {
         const id = target.closest('[data-reward-id]')?.dataset.rewardId;
         if (this.questEntry && id) { await deleteReward(this.questEntry, id); }
      }

      /** Opens a linked giver or reward document's sheet, if the viewer may see it. */
      static async #onOpenDocument(event, target)
      {
         const doc = target.dataset.uuid ? await fromUuid(target.dataset.uuid) : null;
         if (!doc?.testUserPermission?.(game.user, 'LIMITED'))
         {
            ui.notifications.info(game.i18n.localize('FHQL.Drop.CannotOpen'));
            return;
         }
         doc.sheet?.render({ force: true });
      }

      /** @this {QuestSheet} */
      static async #onClearGiver()
      {
         if (this.questEntry) { await clearGiver(this.questEntry); }
      }

      /** @this {QuestSheet} */
      static #onShowQuest(event, target)
      {
         if (target.dataset.questId) { this.showQuest(target.dataset.questId); }
      }

      /** @this {QuestSheet} */
      static async #onAddSubquest()
      {
         const entry = this.questEntry;
         if (!entry) { return; }
         const child = await createSubquest(entry);
         this.showQuest(child.id);
         this._editing = true;
         this.render();
      }

      /** @this {QuestSheet} */
      static async #onSetParent()
      {
         const entry = this.questEntry;
         if (!entry) { return; }
         const current = questPage(entry).system.parent;
         const escape = foundry.utils.escapeHTML;
         const options = [`<option value="">${game.i18n.localize('FHQL.Quest.NoParent')}</option>`,
            ...parentCandidates(entry).map((e) =>
               `<option value="${e.id}" ${e.id === current ? 'selected' : ''}>${escape(e.name)}</option>`)];

         const parentId = await DialogV2.prompt({
            window: { title: 'FHQL.Quest.SetParent' },
            content: `<label class="fhql-dialog-field">${game.i18n.localize('FHQL.Quest.Parent')}
               <select name="parent">${options.join('')}</select></label>`,
            ok: { label: 'FHQL.Quest.SetParent', callback: (e, button) => button.form.elements.parent.value },
            rejectClose: false
         });
         if (parentId !== null && parentId !== undefined) { await setParent(entry, parentId); }
      }

      /** @this {QuestSheet} */
      static #onManageAccess()
      {
         const entry = this.questEntry;
         if (entry) { new DocumentOwnershipConfig({ document: entry }).render({ force: true }); }
      }

      /** @this {QuestSheet} */
      static #onPopOut()
      {
         if (this.questId) { game.modules.get(MODULE_ID).api.openQuestSheet(this.questId); }
      }
   };
}
