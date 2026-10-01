import { textEditor } from '../compat.js';
import { isTracked, toggleTracked } from '../data/tracking.js';
import { addRequirementObjective, setRequirement } from '../data/deposits.js';
import { canAccept, canChangeStatusAsPlayer, canEditNotesViaGM, requestPlayerAction } from '../data/playerActions.js';
import { MODULE_ID, STATUSES } from '../constants.js';
import {
   addRewardFromDocument, clearGiver, getQuestEntry, gmNotesPage, parentCandidates, questAccess, questPage,
   renameQuest, setGiverFromDocument, setGmNotes, setParent, setStatus, subquests, updateQuest
} from '../data/quests.js';
import { editorUnsaved, guardActions } from './sheet/rows.js';
import { depositDropped, flashChangedObjectives, objectiveActions, objectivesContext } from './sheet/objectives.js';
import { rewardActions, rewardsContext } from './sheet/rewards.js';
import {
   notesActions, notesContext, openNotesIfAsked, rememberOpenNotes, savePlayerNotes, stopEditingNotes
} from './sheet/notes.js';
import { openQuestMenu, questMenuActions } from './sheet/questMenu.js';
import { shareActions } from './sheet/share.js';
import { subquestActions } from './sheet/subquests.js';
import { animateClose, animateOpen } from '../ui/motion.js';
import { markSeen } from '../data/seen.js';
import {
   applyCollapsed, capturePanelScroll, layoutPanels, onPanelHeadingClick, restorePanelScroll, watchPanels
} from './sheet/panels.js';

/** Update option marking a text edit made from this window, so it re-renders lightly and keeps focus. */
export const QUIET = { fhqlQuiet: true };

/** Narrow layout: objectives shown before "Show all". Matches the CSS cap in styles/fhql.css. */
const OBJECTIVE_CAP = 8;

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
         // Every action is guarded: a failure shows a notice instead of failing silently.
         actions: guardActions({
            editQuest: QuestSheet.#onEditQuest,
            finishEditing: QuestSheet.#onFinishEditing,
            setQuestStatus: QuestSheet.#onSetQuestStatus,
            toggleInProgress: QuestSheet.#onToggleInProgress,
            toggleTracked: QuestSheet.#onToggleTracked,
            acceptQuest: QuestSheet.#onAcceptQuest,
            openDocument: QuestSheet.#onOpenDocument,
            clearGiver: QuestSheet.#onClearGiver,
            showQuest: QuestSheet.#onShowQuest,
            showAllObjectives: QuestSheet.#onShowAllObjectives,
            ...objectiveActions,
            ...rewardActions,
            ...notesActions,
            ...questMenuActions,
            ...shareActions,
            ...subquestActions
         })
      };

      /** Whether the shown quest is in edit mode. Edits save as each field changes; Done returns to view. */
      _editing = false;

      /** Focused control and unsaved typing, captured before a re-render and restored after it. */
      #pendingFocus = null;

      /** Whether this user is editing the shown quest's player notes (read or edit view; one editor at a time). */
      _notesEditing = false;

      /** Open the notes editor after the next render, saving a second click. */
      _openNotesEditor = false;

      /** Narrow layout: show every objective instead of the first few. Reset when the quest changes. */
      _showAllObjectives = false;

      /** Narrow layout: panels the viewer collapsed, by panel key. Kept while the window is open. */
      _collapsedPanels = new Set();

      /** Panel scroll positions captured before a render, restored after it. */
      #pendingScroll = null;

      /** The control that opened this window (the Beacon), so it grows from there. Cleared after use. */
      _motionFrom = null;

      /** @returns {HTMLElement|null} Where this window settles when it closes; null for its own center. */
      _closeToward() { return null; }

      /* ---------- Window memory: each player's last size (and, for the log, place) ---------- */

      /** Key in the `windowMemory` client setting; null for no memory. Set by each window class. */
      static MEMORY_KEY = null;

      /** Whether the remembered place is restored too, or only the size (pop-outs, so they don't stack). */
      static MEMORY_PLACE = true;

      /** @override */
      _initializeApplicationOptions(options)
      {
         const resolved = super._initializeApplicationOptions(options);
         const key = this.constructor.MEMORY_KEY;
         let saved = null;
         // The window may be built before settings exist (early hooks); then it opens at its default size.
         try { saved = key ? game.settings.get(MODULE_ID, 'windowMemory')?.[key] : null; }
         catch { saved = null; }
         if (saved)
         {
            const { width, height, left, top } = saved;
            resolved.position = { ...resolved.position, width, height, ...(this.constructor.MEMORY_PLACE ? { left, top } : {}) };
         }
         return resolved;
      }

      #memoryTimer = null;

      /** Saves size and place after each move or resize, batched. @override */
      _onPosition(position)
      {
         super._onPosition?.(position);
         const key = this.constructor.MEMORY_KEY;
         if (!key || this.minimized || !this.rendered) { return; }
         clearTimeout(this.#memoryTimer);
         this.#memoryTimer = setTimeout(() =>
         {
            const { width, height, left, top } = this.position;
            const all = { ...(game.settings.get(MODULE_ID, 'windowMemory') ?? {}) };
            all[key] = { width, height, left, top };
            game.settings.set(MODULE_ID, 'windowMemory', all);
         }, 500);
      }

      /**
       * Closes with our settle motion instead of Foundry's own, so the two never play together.
       *
       * @override
       */
      async close(options = {})
      {
         if (options.animate !== false && this.rendered && !this.minimized && this.element)
         {
            await animateClose(this.element, this._closeToward());
         }
         return super.close({ ...options, animate: false });
      }

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
         this.#pendingScroll = capturePanelScroll(this.element);
         rememberOpenNotes(this);
      }

      /** @override */
      _onRender(context, options)
      {
         super._onRender(context, options);
         applyCollapsed(this);
         // Size panels first, so restored scroll positions land inside their final heights.
         layoutPanels(this.element);
         watchPanels(this);
         restorePanelScroll(this.element, this.#pendingScroll);
         this.#pendingScroll = null;
         this.#restoreFocus(this.#pendingFocus);
         this.#pendingFocus = null;
         openNotesIfAsked(this);
         flashChangedObjectives(this);
         // A quest on screen counts as seen (clears its "new" dot).
         if (!this.minimized) { markSeen(this.questEntry); }
      }

      /** @override */
      async _preClose(options)
      {
         await this._flushEdits();
         if (this.questEntry) { await stopEditingNotes(this, this.questEntry); }
         this._panelObserver?.disconnect();
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
            if (editorUnsaved(editor)) { editor.save(); }
         }
      }

      /** @returns {boolean} Whether a rich-text editor here holds unsaved changes. */
      _hasUnsavedEditor()
      {
         return [...(this.element?.querySelectorAll('prose-mirror') ?? [])].some((editor) => editorUnsaved(editor));
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
       * @param {{ edit?: boolean }} [_options] - Open it in edit mode.
       */
      showQuest(_id, _options) {}

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
         const trusted = canChangeStatusAsPlayer(entry);
         const notesViaGM = canEditNotesViaGM(entry);
         const enrich = (html) => textEditor().enrichHTML(html ?? '', { secrets: access.editable, relativeTo: page });
         const localize = (key) => game.i18n.localize(key);
         const allObjectives = objectivesContext(system, access, editing);
         // "Hide done" is the viewer's own choice; edit mode always shows everything.
         const hideDone = !editing && game.settings.get(MODULE_ID, 'hideDoneObjectives');
         const objectives = hideDone ? allObjectives.filter((o) => o.state !== 'done') : allObjectives;
         const doneCount = allObjectives.filter((o) => o.state === 'done').length;
         // Narrow layout shows the first few objectives with "Show all"; CSS applies the cap only when narrow.
         const objectivesCapped = !editing && !this._showAllObjectives && objectives.length > OBJECTIVE_CAP;
         const { rewards, rewardSummary } = rewardsContext(entry, system, access);

         const parentEntry = getQuestEntry(system.parentQuest);
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
            statusOptions: Object.keys(STATUSES).filter((key) => access.gm || key !== 'hidden').map((key) => ({
               value: key, label: localize(`FHQL.Status.${key}`), selected: key === system.status
            })),
            statusActions: (access.gm || trusted) ? (STATUS_ACTIONS[system.status] ?? [])
             .filter(([target]) => access.gm || target !== 'hidden')
             .map(([target, verb]) => ({
                status: target, icon: STATUSES[target].icon, label: localize(`FHQL.QuestLog.StatusAction.${verb}`)
             })) : [],
            canSetStatus: access.gm || trusted,
            canAccept: canAccept(entry),
            ...notesContext(this, entry, access, notesViaGM),
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
            doneCount,
            objectiveTotal: allObjectives.length,
            hideDone,
            hideDoneToggle: !editing && (doneCount > 0 || hideDone),
            allHidden: hideDone && allObjectives.length > 0 && objectives.length === 0,
            objectivesCapped,
            objectivesMoreLabel: game.i18n.format('FHQL.Objective.ShowAll', { count: objectives.length }),
            rewards,
            rewardSummary,
            subquests: children,
            showHiddenNotice: access.gm && system.status === 'hidden',
            showObjectives: allObjectives.length > 0 || editing,
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
         animateOpen(el, this._motionFrom);
         this._motionFrom = null;
         el.addEventListener('change', (event) =>
         {
            if (event.target.matches?.('[data-hide-done]'))
            {
               game.settings.set(MODULE_ID, 'hideDoneObjectives', event.target.checked).then(() => this.render());
               return;
            }
            this.#onFieldChange(event);
         });
         el.addEventListener('click', (event) => onPanelHeadingClick(this, event));
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
            case 'description': return updateQuest(entry, { 'system.description': value });
            case 'playerNotes': return savePlayerNotes(this, entry, value);
            case 'gmNotes': return setGmNotes(entry, value);
            case 'objective.name': return updateQuest(entry, { [`system.objectives.${objectiveId}.name`]: value }, QUIET);
            case 'objective.hidden': return updateQuest(entry, { [`system.objectives.${objectiveId}.hidden`]: value });
            case 'objective.count':
            {
               const count = Math.max(1, Math.floor(Number(value)) || 1);
               return updateQuest(entry, { [`system.objectives.${objectiveId}.requirement.count`]: count });
            }
            case 'objective.mode': return updateQuest(entry, { [`system.objectives.${objectiveId}.requirement.mode`]: value });
            case 'reward.name': return updateQuest(entry, { [`system.rewards.${rewardId}.name`]: value }, QUIET);
            case 'reward.hidden': return updateQuest(entry, { [`system.rewards.${rewardId}.hidden`]: value });
            case 'reward.claimLimit': return updateQuest(entry, { [`system.rewards.${rewardId}.claimLimit`]: value });
         }
      }

      /** @param {DragEvent} event - Drag over a drop zone. */
      #onDragOver(event)
      {
         const zone = event.target.closest?.('[data-drop], [data-deposit]');
         if (!zone || !this.questEntry) { return; }
         if (!('deposit' in zone.dataset) && !questAccess(this.questEntry).editable) { return; }
         event.preventDefault();
         zone.classList.add('is-drop-target');
      }

      /**
       * Drop onto the giver portrait, the rewards section, or the objectives. In edit mode an item
       * dropped on an objective becomes its requirement, and one dropped on the list adds an objective
       * requiring it. In the read view an item dropped on an objective is deposited.
       *
       * @param {DragEvent} event - The drop.
       */
      async #onDrop(event)
      {
         const zone = event.target.closest?.('[data-drop], [data-deposit]');
         const entry = this.questEntry;
         if (!zone || !entry) { return; }
         const depositing = 'deposit' in zone.dataset;
         if (!depositing && !questAccess(entry).editable) { return; }
         event.preventDefault();
         event.stopPropagation();
         zone.classList.remove('is-drop-target');

         const data = textEditor().getDragEventData(event);
         const doc = data?.uuid ? await fromUuid(data.uuid) : null;
         const objectiveId = zone.closest('[data-objective-id]')?.dataset.objectiveId;
         if (depositing) { return depositDropped(this, zone, objectiveId, doc); }

         // A quest dropped on Subquests or Objectives becomes a subquest (GM).
         if (questPage(doc) && ['subquests', 'objectives', 'requirement'].includes(zone.dataset.drop))
         {
            if (!game.user.isGM) { return; }
            const refused = doc.id === entry.id || !parentCandidates(doc).some((e) => e.id === entry.id);
            if (refused) { ui.notifications.warn(game.i18n.localize('FHQL.Subquest.CannotNest')); return; }
            await setParent(doc, entry.id);
            return;
         }

         let accepted;
         switch (zone.dataset.drop)
         {
            case 'giver': accepted = await setGiverFromDocument(entry, doc); break;
            case 'requirement':
            {
               const error = await setRequirement(entry, objectiveId, doc);
               if (error) { ui.notifications.warn(game.i18n.localize(`FHQL.Deposit.Error.${error}`)); }
               return;
            }
            case 'objectives': accepted = await addRequirementObjective(entry, doc); break;
            default: accepted = await addRewardFromDocument(entry, doc);
         }

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
      static async #onAcceptQuest()
      {
         if (!this.questEntry) { return; }
         const result = await requestPlayerAction({ action: 'accept', entryId: this.questEntry.id });
         if (result.ok)
         {
            ui.notifications.info(game.i18n.localize('FHQL.Player.Accepted'));
            this._announce(game.i18n.format('FHQL.Announce.Status', { status: game.i18n.localize('FHQL.Status.active') }));
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
      static #onShowAllObjectives()
      {
         this._showAllObjectives = true;
         this.render();
      }

      /**
       * Opens the quest menu (⋮, or right-click on a Quest Log row).
       *
       * @param {JournalEntry} entry - The quest.
       * @param {HTMLElement|{ x: number, y: number }} anchor - Where to open the menu.
       */
      _openQuestMenu(entry, anchor)
      {
         return openQuestMenu(this, entry, anchor);
      }
   };
}
