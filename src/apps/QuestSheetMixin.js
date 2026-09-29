import { DocumentOwnershipConfig, textEditor } from '../compat.js';
import { confirmPopover, menuPopover } from '../ui/popover.js';
import { isTracked, toggleTracked } from '../data/tracking.js';
import { MODULE_ID, STATUSES } from '../constants.js';
import {
   claimLabel, claimedItem, claimsExhausted, claimTargets, isClaimable, recipientOptions, requestClaim, undoClaim
} from '../data/rewards.js';
import {
   addObjective, addRewardFromDocument, addTextReward, clearGiver, createSubquest, cycleObjective, deleteObjective,
   deleteQuest, deleteReward, getQuestEntry, gmNotesPage, moveQuestToFolder, parentCandidates, questAccess, questPage,
   questRootFolder, questSubfolders, renameQuest, setGiverFromDocument, setGmNotes, setParent, setStatus, subquests,
   updateQuest
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
            toggleTracked: QuestSheet.#onToggleTracked,
            addObjective: QuestSheet.#onAddObjective,
            cycleObjective: QuestSheet.#onCycleObjective,
            deleteObjective: QuestSheet.#onDeleteObjective,
            addTextReward: QuestSheet.#onAddTextReward,
            claimReward: QuestSheet.#onClaimReward,
            giveReward: QuestSheet.#onGiveReward,
            undoClaim: QuestSheet.#onUndoClaim,
            toggleRewardLock: QuestSheet.#onToggleRewardLock,
            toggleRewardHidden: QuestSheet.#onToggleRewardHidden,
            toggleObjectiveHidden: QuestSheet.#onToggleObjectiveHidden,
            deleteReward: QuestSheet.#onDeleteReward,
            openDocument: QuestSheet.#onOpenDocument,
            clearGiver: QuestSheet.#onClearGiver,
            showQuest: QuestSheet.#onShowQuest,
            addSubquest: QuestSheet.#onAddSubquest,
            questMenu: QuestSheet.#onQuestMenu
         }
      };

      /** Whether the shown quest is in edit mode. Edits save as each field changes; Done returns to view. */
      _editing = false;

      /** Focused control and unsaved typing, captured before a re-render and restored after it. */
      #pendingFocus = null;

      /** Last save outcome shown in edit mode: '', 'saving', 'saved', or 'failed'. */
      #saveState = '';

      /**
       * Shows save progress in the edit bar without a re-render.
       *
       * @param {string} state - 'saving', 'saved', or 'failed'.
       */
      #setSaveState(state)
      {
         this.#saveState = state;
         const label = this.#saveStateLabel();
         const node = this.element?.querySelector('[data-save-state]');
         if (node) { node.textContent = label; node.classList.toggle('is-failed', state === 'failed'); }
      }

      /** @returns {string} Label for the current save state. */
      #saveStateLabel()
      {
         const keys = { saving: 'FHQL.QuestLog.Saving', saved: 'FHQL.QuestLog.Saved', failed: 'FHQL.QuestLog.SaveFailed' };
         return keys[this.#saveState] ? game.i18n.localize(keys[this.#saveState]) : '';
      }

      /**
       * Announces a change to screen readers through a live region that survives re-renders.
       *
       * @param {string} message - What changed.
       */
      _announce(message)
      {
         let region = this.element?.querySelector(':scope > .fhql-live');
         if (!region && this.element)
         {
            region = document.createElement('div');
            region.className = 'fhql-live sr-only';
            region.setAttribute('aria-live', 'polite');
            region.setAttribute('role', 'status');
            this.element.append(region);
         }
         if (region) { region.textContent = ''; setTimeout(() => { region.textContent = message; }, 50); }
      }

      /** @override */
      async _preRender(context, options)
      {
         await super._preRender(context, options);
         this.#pendingFocus = this.#captureFocus();
      }

      /** @override */
      _onRender(context, options)
      {
         super._onRender(context, options);
         this.#restoreFocus(this.#pendingFocus);
         this.#pendingFocus = null;
      }

      /** @override */
      async _preClose(options)
      {
         await this._flushEdits();
         return super._preClose(options);
      }

      /**
       * Saves anything typed but not yet saved: the focused text field, and any open rich-text editor
       * with changes. Called before closing and before leaving edit mode.
       */
      async _flushEdits()
      {
         const active = document.activeElement;
         if (this.element?.contains(active) && active.dataset?.field && 'defaultValue' in active
          && active.value !== active.defaultValue)
         {
            await this.#onFieldChange({ target: active });
         }
         // Saving an editor fires its change event, which the change listener turns into an update.
         for (const editor of this.element?.querySelectorAll('prose-mirror') ?? [])
         {
            if (editor.isDirty?.()) { editor.save(); }
         }
      }

      /** @returns {boolean} Whether a rich-text editor here holds unsaved changes. */
      _hasUnsavedEditor()
      {
         return [...(this.element?.querySelectorAll('prose-mirror') ?? [])].some((editor) => editor.isDirty?.());
      }

      /**
       * Describes the focused control so the same control can be found after a re-render.
       *
       * @returns {object|null} Focus description.
       */
      #captureFocus()
      {
         const el = document.activeElement;
         if (!el || el === document.body || !this.element?.contains(el) || el.closest('.fhql-popover')) { return null; }
         const typed = 'defaultValue' in el && el.value !== el.defaultValue;
         return {
            name: el.getAttribute('name'),
            action: el.dataset?.action ?? null,
            status: el.dataset?.status ?? null,
            questId: el.dataset?.questId ?? null,
            objectiveId: el.closest('[data-objective-id]')?.dataset.objectiveId ?? null,
            rewardId: el.closest('[data-reward-id]')?.dataset.rewardId ?? null,
            value: typed ? el.value : null,
            start: typed ? el.selectionStart : null,
            end: typed ? el.selectionEnd : null
         };
      }

      /**
       * Refocuses the matching control after a re-render and puts back any unsaved typing.
       *
       * @param {object|null} focus - From #captureFocus.
       */
      #restoreFocus(focus)
      {
         if (!focus || !this.element) { return; }
         let target = null;
         if (focus.name)
         {
            target = this.element.querySelector(`[name="${CSS.escape(focus.name)}"]`);
         }
         else if (focus.action)
         {
            target = [...this.element.querySelectorAll(`[data-action="${CSS.escape(focus.action)}"]`)].find((el) =>
               (!focus.questId || el.dataset.questId === focus.questId)
               && (!focus.status || el.dataset.status === focus.status)
               && (!focus.objectiveId || el.closest('[data-objective-id]')?.dataset.objectiveId === focus.objectiveId)
               && (!focus.rewardId || el.closest('[data-reward-id]')?.dataset.rewardId === focus.rewardId));
         }
         if (!target) { return; }
         if (focus.value !== null && 'value' in target)
         {
            target.value = focus.value;
            try { target.setSelectionRange(focus.start, focus.end); }
            catch { /* not a text input */ }
         }
         target.focus({ preventScroll: true });
      }

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

         const userId = game.user.id;
         const rewards = access.full ? Object.entries(system.rewards)
          .map(([id, r]) =>
          {
             const claimable = isClaimable(r);
             const exhaustedForAll = claimable && r.claimLimit === 'once' && r.claims.length > 0;
             const mine = claimable && claimsExhausted(r, userId);
             return {
                id, ...r,
                icon: REWARD_ICONS[r.type] ?? REWARD_ICONS.text,
                linked: !!r.uuid,
                claimable,
                struck: exhaustedForAll || (!access.gm && mine && r.type === 'item'),
                claimsList: r.claims.map((c, index) => ({ index, label: claimLabel(c) })),
                perPlayer: r.claimLimit === 'perPlayer',
                canClaim: !access.gm && claimable && !r.locked && !mine
                 && (r.type === 'actor' || claimTargets(game.user).length > 0),
                showLocked: !access.gm && claimable && r.locked,
                canGive: access.gm && claimable && !exhaustedForAll,
                draggable: claimable && r.type === 'item' && (access.gm ? !exhaustedForAll : (!r.locked && !mine)),
                claimVerb: game.i18n.localize(r.type === 'actor' ? 'FHQL.Reward.Recruit' : 'FHQL.Reward.Claim')
             };
          })
          .filter((r) => access.gm || !r.hidden)
          .sort((a, b) => a.sort - b.sort) : [];
         const claimableRewards = rewards.filter((r) => r.claimable);
         const claimedCount = claimableRewards.filter((r) => r.claims.length > 0).length;

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
            tracked: isTracked(entry),
            saveStateLabel: editing ? this.#saveStateLabel() : '',
            image: system.image,
            dateLine: QuestSheet.#dateLine(system),
            giver: { ...system.giver, linked: !!system.giver.uuid },
            parent,
            description: system.description,
            descriptionHTML: access.full ? await enrich(system.description) : '',
            objectives,
            doneCount: objectives.filter((o) => o.state === 'done').length,
            rewards,
            rewardSummary: claimableRewards.length
             ? game.i18n.format('FHQL.Reward.Summary', { claimed: claimedCount, total: claimableRewards.length }) : '',
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

      /**
       * "Started 3 Oct 2026 · Completed 9 Oct 2026", from whichever dates are recorded.
       *
       * @param {object} system - Quest data.
       * @returns {string} The line, or '' if nothing is recorded.
       */
      static #dateLine(system)
      {
         const format = (ts) => new Date(ts).toLocaleDateString(game.i18n.lang, { day: 'numeric', month: 'short', year: 'numeric' });
         const parts = [];
         if (system.dates.started) { parts.push(game.i18n.format('FHQL.Quest.Started', { date: format(system.dates.started) })); }
         if (system.dates.ended && ['completed', 'failed'].includes(system.status))
         {
            parts.push(game.i18n.format(`FHQL.Quest.Ended.${system.status}`, { date: format(system.dates.ended) }));
         }
         return parts.join(' · ');
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
         el.addEventListener('dragstart', (event) =>
         {
            const row = event.target.closest?.('[data-reward-drag]');
            if (!row || !this.questEntry) { return; }
            event.dataTransfer.setData('text/plain', JSON.stringify({
               type: 'Item', uuid: row.dataset.uuid, fhqlReward: { entryId: this.questId, rewardId: row.dataset.rewardId }
            }));
         });
         el.addEventListener('toggle', (event) =>
         {
            if (event.target.matches?.('details.fhql-gm-notes') && !this._editing)
            {
               game.settings.set(MODULE_ID, 'gmNotesOpen', event.target.open);
            }
         }, true);
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
         if (!input.dataset?.field || !this.questEntry) { return; }
         this.#setSaveState('saving');
         try
         {
            await this.#saveField(input);
            this.#setSaveState('saved');
         }
         catch (err)
         {
            console.error(`${MODULE_ID} | Save failed`, err);
            this.#setSaveState('failed');
         }
      }

      /**
       * Writes one edited field to the quest.
       *
       * @param {HTMLElement} input - The changed field, carrying `data-field`.
       */
      async #saveField(input)
      {
         const field = input.dataset.field;
         const entry = this.questEntry;

         const value = input.type === 'checkbox' ? input.checked : input.value;
         const objectiveId = input.closest('[data-objective-id]')?.dataset.objectiveId;
         const rewardId = input.closest('[data-reward-id]')?.dataset.rewardId;

         switch (field)
         {
            case 'name': return renameQuest(entry, value, QUIET);
            case 'status': return setStatus(entry, value);
            case 'inProgress': return updateQuest(entry, { 'system.inProgress': value });
            case 'giver.name': return updateQuest(entry, { 'system.giver.name': value }, QUIET);
            case 'image': return updateQuest(entry, { 'system.image': value });
            case 'description':
            case 'playerNotes': return updateQuest(entry, { [`system.${field}`]: value });
            case 'gmNotes': return setGmNotes(entry, value);
            case 'objective.name': return updateQuest(entry, { [`system.objectives.${objectiveId}.name`]: value }, QUIET);
            case 'objective.hidden': return updateQuest(entry, { [`system.objectives.${objectiveId}.hidden`]: value });
            case 'reward.name': return updateQuest(entry, { [`system.rewards.${rewardId}.name`]: value }, QUIET);
            case 'reward.hidden': return updateQuest(entry, { [`system.rewards.${rewardId}.hidden`]: value });
            case 'reward.claimLimit': return updateQuest(entry, { [`system.rewards.${rewardId}.claimLimit`]: value });
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
         this.#saveState = '';
         this.render();
      }

      /** @this {QuestSheet} */
      static async #onFinishEditing()
      {
         await this._flushEdits();
         this._editing = false;
         this.render();
      }

      /** @this {QuestSheet} */
      static async #onSetQuestStatus(event, target)
      {
         if (!this.questEntry) { return; }
         await setStatus(this.questEntry, target.dataset.status);
         this._announce(game.i18n.format('FHQL.Announce.Status', { status: game.i18n.localize(`FHQL.Status.${target.dataset.status}`) }));
      }

      /** @this {QuestSheet} */
      static async #onToggleInProgress()
      {
         const entry = this.questEntry;
         if (!entry) { return; }
         const on = !questPage(entry).system.inProgress;
         await updateQuest(entry, { 'system.inProgress': on });
         this._announce(game.i18n.localize(on ? 'FHQL.Announce.FocusOn' : 'FHQL.Announce.FocusOff'));
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
         if (!this.questEntry || !id) { return; }
         await cycleObjective(this.questEntry, id);
         const objective = questPage(this.questEntry)?.system.objectives[id];
         if (objective)
         {
            this._announce(game.i18n.format('FHQL.Announce.Objective', {
               objective: objective.name, state: game.i18n.localize(`FHQL.Objective.State.${objective.state}`)
            }));
         }
      }

      /** @this {QuestSheet} */
      static async #onToggleTracked()
      {
         if (!this.questEntry) { return; }
         const on = !isTracked(this.questEntry);
         await toggleTracked(this.questEntry);
         this._announce(game.i18n.localize(on ? 'FHQL.Announce.TrackOn' : 'FHQL.Announce.TrackOff'));
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

      /** @returns {object|undefined} Reward data for the row containing `target`. */
      #rewardFor(target)
      {
         const id = target.closest('[data-reward-id]')?.dataset.rewardId;
         const reward = id ? questPage(this.questEntry)?.system.rewards[id] : undefined;
         return reward ? { id, reward } : undefined;
      }




      /** @this {QuestSheet} */
      static async #onToggleRewardLock(event, target)
      {
         const found = this.#rewardFor(target);
         if (found) { await updateQuest(this.questEntry, { [`system.rewards.${found.id}.locked`]: !found.reward.locked }); }
      }

      /** @this {QuestSheet} */
      static async #onToggleRewardHidden(event, target)
      {
         const found = this.#rewardFor(target);
         if (found) { await updateQuest(this.questEntry, { [`system.rewards.${found.id}.hidden`]: !found.reward.hidden }); }
      }

      /** @this {QuestSheet} */
      static async #onToggleObjectiveHidden(event, target)
      {
         const id = target.closest('[data-objective-id]')?.dataset.objectiveId;
         const objective = id ? questPage(this.questEntry)?.system.objectives[id] : undefined;
         if (objective) { await updateQuest(this.questEntry, { [`system.objectives.${id}.hidden`]: !objective.hidden }); }
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




      /* ---------- Quest menu (⋮ button and right-click on list rows) ---------- */

      /**
       * @param {JournalEntry} entry - The quest the menu acts on.
       * @returns {object[]} Menu items. GM only.
       */
      _questMenuItems(entry)
      {
         const t = (key) => game.i18n.localize(key);
         return [
            ...(this.options.questId === entry.id ? [] : [{ value: 'popOut', label: t('FHQL.Menu.PopOut'), icon: 'fa-solid fa-up-right-from-square' }]),
            { value: 'access', label: t('FHQL.Menu.Access'), icon: 'fa-solid fa-user-lock' },
            { value: 'move', label: t('FHQL.Menu.Move'), icon: 'fa-solid fa-folder-open' },
            { value: 'parent', label: t('FHQL.Menu.Parent'), icon: 'fa-solid fa-diagram-project' },
            { value: 'delete', label: t('FHQL.Menu.Delete'), icon: 'fa-solid fa-trash', danger: true }
         ];
      }

      /**
       * Opens the quest menu for a quest and runs the chosen action.
       *
       * @param {JournalEntry} entry - The quest.
       * @param {HTMLElement|{ x: number, y: number }} anchor - Where to open the menu.
       */
      async _openQuestMenu(entry, anchor)
      {
         if (!entry || !game.user.isGM) { return; }
         const choice = await menuPopover(this, anchor, { items: this._questMenuItems(entry) });
         const control = anchor instanceof HTMLElement ? anchor : null;
         switch (choice)
         {
            case 'popOut': return game.modules.get(MODULE_ID).api.openQuestSheet(entry.id);
            case 'access': return new DocumentOwnershipConfig({ document: entry }).render({ force: true });
            case 'move': return this.#chooseFolder(entry, control ?? anchor);
            case 'parent': return this.#chooseParent(entry, control ?? anchor);
            case 'delete': return this.#confirmDelete(entry, control ?? anchor);
         }
      }

      /** @this {QuestSheet} */
      static #onQuestMenu(event, target)
      {
         this._openQuestMenu(this.questEntry, target);
      }

      /** Picks a folder in the quest tree and moves the quest there. */
      async #chooseFolder(entry, anchor)
      {
         const root = questRootFolder();
         const current = entry.folder?.id === root?.id ? '' : entry.folder?.id ?? '';
         const path = (folder) => [...folder.ancestors.filter((a) => a.id !== root?.id).reverse(), folder].map((f) => f.name).join(' / ');
         const items = [
            { value: '', label: game.i18n.localize('FHQL.Folders.TopLevel'), current: current === '' },
            ...questSubfolders().map((f) => ({ value: f.id, label: path(f), current: f.id === current }))
             .sort((a, b) => a.label.localeCompare(b.label))
         ];
         const choice = await menuPopover(this, anchor, { title: game.i18n.localize('FHQL.Folders.MoveTo'), items });
         if (choice !== null) { await moveQuestToFolder(entry, choice); }
      }

      /** Picks a parent quest (or none). Quests below this one are left out to prevent loops. */
      async #chooseParent(entry, anchor)
      {
         const current = questPage(entry).system.parent;
         const items = [
            { value: '', label: game.i18n.localize('FHQL.Quest.NoParent'), current: !current },
            ...parentCandidates(entry).map((e) => ({ value: e.id, label: e.name, current: e.id === current }))
         ];
         const choice = await menuPopover(this, anchor, { title: game.i18n.localize('FHQL.Quest.SetParent'), items });
         if (choice !== null) { await setParent(entry, choice); }
      }

      /** Confirms, then deletes the quest. */
      async #confirmDelete(entry, anchor)
      {
         const ok = await confirmPopover(this, anchor, {
            message: `<p>${game.i18n.format('FHQL.Quest.DeleteConfirm', { name: foundry.utils.escapeHTML(entry.name) })}</p>`,
            yes: game.i18n.localize('FHQL.Menu.Delete'),
            danger: true
         });
         if (!ok) { return; }
         if (entry.id === this.questId) { this._editing = false; }
         await deleteQuest(entry);
      }

      /* ---------- Claiming ---------- */

      /**
       * Chooses a recipient in a child panel. A player with an assigned character skips the choice.
       *
       * @param {object} reward - Reward data.
       * @param {boolean} asGM - Whether the GM is giving it.
       * @param {HTMLElement} anchor - The Claim or Give button.
       * @returns {Promise<object|null>} The chosen recipient.
       */
      async #chooseRecipient(reward, asGM, anchor)
      {
         const options = recipientOptions(reward, asGM);
         if (!options.length)
         {
            ui.notifications.warn(game.i18n.localize(asGM ? 'FHQL.Reward.NoRecipients' : 'FHQL.Reward.NoCharacter'));
            return null;
         }
         if (!asGM && (options.length === 1 || options[0].assigned)) { return options[0]; }
         const choice = await menuPopover(this, anchor, {
            title: game.i18n.format(asGM ? 'FHQL.Reward.GiveTo' : 'FHQL.Reward.ClaimFor', { reward: reward.name }),
            items: options.map((o, i) => ({
               value: String(i), label: o.label, icon: reward.type === 'actor' ? 'fa-solid fa-user' : 'fa-solid fa-user-shield',
               hint: o.assigned && !asGM ? game.i18n.localize('FHQL.Reward.Assigned') : ''
            }))
         });
         return choice === null ? null : options[Number(choice)];
      }

      /** @this {QuestSheet} */
      static async #onClaimReward(event, target)
      {
         const found = this.#rewardFor(target);
         if (!found) { return; }
         const recipient = await this.#chooseRecipient(found.reward, false, target);
         if (recipient) { await requestClaim(this.questEntry, found.id, recipient); }
      }

      /** @this {QuestSheet} */
      static async #onGiveReward(event, target)
      {
         const found = this.#rewardFor(target);
         if (!found) { return; }
         const recipient = await this.#chooseRecipient(found.reward, true, target);
         if (recipient) { await requestClaim(this.questEntry, found.id, recipient); }
      }

      /** @this {QuestSheet} */
      static async #onUndoClaim(event, target)
      {
         const found = this.#rewardFor(target);
         if (!found) { return; }
         const index = Number(target.dataset.claimIndex);
         const item = found.reward.type === 'item' ? await claimedItem(this.questEntry, found.id, index) : null;
         let removeItem = false;
         if (item)
         {
            const answer = await confirmPopover(this, target, {
               message: `<p>${game.i18n.format('FHQL.Reward.UndoItem', {
                  item: foundry.utils.escapeHTML(item.name), actor: foundry.utils.escapeHTML(item.parent?.name ?? '')
               })}</p>`,
               yes: game.i18n.localize('FHQL.Reward.RemoveItem'),
               no: game.i18n.localize('FHQL.Reward.KeepItem'),
               danger: true
            });
            if (answer === null) { return; }
            removeItem = answer;
         }
         await undoClaim(this.questEntry, found.id, index, { removeItem });
      }

   };
}
