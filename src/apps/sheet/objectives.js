import { confirmPopover, openPanel } from '../../ui/popover.js';
import {
   clearRequirement, defaultDepositChoice, depositCandidates, depositedTotal, depositLabel, hasRequirement, requestDeposit,
   stillNeeded, undoDeposit
} from '../../data/deposits.js';
import { addObjective, cycleObjective, deleteObjective, questPage, updateQuest } from '../../data/quests.js';
import { objectiveFor } from './rows.js';

/**
 * Quest sheet: objectives, their item requirements, and deposits. Render data and actions.
 * See docs/SCOPE.md 5.11.
 */

const OBJECTIVE_ICONS = { open: 'fa-regular fa-square', done: 'fa-solid fa-square-check', failed: 'fa-solid fa-square-xmark' };

/**
 * Render data for the objectives a viewer may see.
 *
 * @param {object} system - Quest data.
 * @param {object} access - From questAccess.
 * @param {boolean} editing - Edit mode.
 * @returns {object[]} Objectives.
 */
export function objectivesContext(system, access, editing)
{
   if (!access.full) { return []; }
   const open = !['completed', 'failed'].includes(system.status);
   return system.objectiveList
    .filter((o) => access.gm || !o.hidden)
    .map((o) => ({
       ...o,
       icon: OBJECTIVE_ICONS[o.state],
       stateLabel: game.i18n.localize(`FHQL.Objective.${o.state}`),
       ...requirementContext(o, { open, gm: access.gm, editing })
    }));
}

/**
 * Render data for an objective's item requirement and deposits.
 *
 * @param {object} objective - Objective data.
 * @param {{ open: boolean, gm: boolean, editing: boolean }} state - Quest open, viewer is GM, edit mode.
 * @returns {object} Fields merged into the objective's context.
 */
function requirementContext(objective, { open, gm, editing })
{
   if (!hasRequirement(objective)) { return { requirement: null }; }
   const localize = (key) => game.i18n.localize(key);
   const { requirement } = objective;
   const total = depositedTotal(objective);
   const give = requirement.mode === 'give';
   const verb = localize(give ? 'FHQL.Deposit.Give' : 'FHQL.Deposit.Show');
   return {
      requirement: {
         ...requirement,
         progress: `${total}/${requirement.count}`,
         fill: `${Math.min(100, Math.round((total / requirement.count) * 100))}%`,
         met: total >= requirement.count,
         modeLabel: localize(give ? 'FHQL.Deposit.ModeGive' : 'FHQL.Deposit.ModeShow'),
         modeOptions: ['give', 'show'].map((mode) => ({
            value: mode, selected: mode === requirement.mode,
            label: localize(mode === 'give' ? 'FHQL.Deposit.ModeGive' : 'FHQL.Deposit.ModeShow')
         }))
      },
      canDeposit: open && !editing && !objective.hidden && stillNeeded(objective) > 0,
      depositVerb: verb,
      depositAria: game.i18n.format('FHQL.Deposit.ActionLabel', { verb, item: requirement.name }),
      depositIcon: give ? 'fa-hand-holding-hand' : 'fa-eye',
      depositsList: objective.deposits.map((d, index) => ({ index, label: depositLabel(d), held: !!d.item, gm }))
   };
}

/**
 * Asks which actor to take from and how many, before anything is handed over or shown. Opens as a
 * child panel by the button (or the drop target). The source starts on the player's assigned
 * character when it carries the item; the amount starts at what's still needed, capped by the stack.
 *
 * @param {object} app - The quest sheet.
 * @param {HTMLElement} anchor - Where the panel opens.
 * @param {object} objective - Objective data.
 * @param {object[]} choices - From depositCandidates.
 * @param {object|null} preselect - The source to start on.
 * @returns {Promise<{ choice: object, qty: number }|null>} The confirmed deposit, or null.
 */
function confirmDeposit(app, anchor, objective, choices, preselect)
{
   const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
   const escape = foundry.utils.escapeHTML;
   const { requirement } = objective;
   const give = requirement.mode === 'give';
   const need = stillNeeded(objective);
   const asGM = game.user.isGM;
   const start = Math.max(0, choices.indexOf(preselect));
   const hint = (c) => [
      c.assigned ? t(asGM ? 'FHQL.Deposit.PlayerCharacter' : 'FHQL.Deposit.YourCharacter') : '',
      c.shared ? t('FHQL.Deposit.Shared') : ''
   ].filter(Boolean).join(', ');
   const verb = t(give ? 'FHQL.Deposit.Give' : 'FHQL.Deposit.Show');
   const html = `<form class="fhql-popover-form fhql-deposit-form">
      <div class="fhql-popover-title">${escape(t('FHQL.Deposit.ConfirmTitle', { verb, item: requirement.name }))}</div>
      <label class="fhql-field"><span>${escape(t('FHQL.Deposit.From'))}</span>
        <select class="fhql-input" name="source">${choices.map((c, i) => `<option value="${i}" ${i === start ? 'selected' : ''}>${escape(c.label)}${hint(c) ? ` (${escape(hint(c))})` : ''}</option>`).join('')}</select></label>
      <label class="fhql-field"><span>${escape(t(give ? 'FHQL.Deposit.HowManyGive' : 'FHQL.Deposit.HowManyShow'))}</span>
        <input class="fhql-input fhql-count-input" type="number" name="qty" min="1" step="1"></label>
      <p class="fhql-hint" data-deposit-note></p>
      <div class="fhql-popover-buttons">
        <button type="button" class="fhql-button" data-answer="cancel">${escape(t('FHQL.Popover.Cancel'))}</button>
        <button type="submit" class="fhql-button fhql-primary">${escape(verb)}</button>
      </div></form>`;

   return openPanel(app, anchor, html, (panel, done) =>
   {
      const form = panel.querySelector('form');
      const { source, qty } = form.elements;
      const note = panel.querySelector('[data-deposit-note]');
      // Each source caps the amount at its stack and at what's still needed.
      const limit = () => Math.max(1, Math.min(choices[Number(source.value)].count, need));
      const refresh = () =>
      {
         const max = limit();
         qty.max = String(max);
         qty.value = String(max);
         note.textContent = t('FHQL.Deposit.ConfirmNote', { need, have: choices[Number(source.value)].count });
      };
      refresh();
      source.addEventListener('change', refresh);
      form.addEventListener('submit', (event) =>
      {
         event.preventDefault();
         const amount = Math.min(limit(), Math.max(1, Math.floor(Number(qty.value)) || 1));
         done({ choice: choices[Number(source.value)], qty: amount });
      });
      panel.addEventListener('click', (event) => { if (event.target.closest('[data-answer="cancel"]')) { done(null); } });
      (choices.length > 1 ? source : qty).setAttribute('autofocus', '');
   }, { label: t('FHQL.Deposit.ConfirmTitle', { verb, item: requirement.name }) });
}

/**
 * Hand over or show: always confirms the source and amount first.
 *
 * @param {object} app - The quest sheet.
 * @param {HTMLElement} anchor - Where the confirm panel opens.
 * @param {string} objectiveId - Objective ID.
 * @param {string} [itemUuid] - A dropped item to start on.
 */
async function startDeposit(app, anchor, objectiveId, itemUuid)
{
   const entry = app.questEntry;
   const objective = questPage(entry)?.system.objectives[objectiveId];
   if (!objective) { return; }
   const { requirement } = objective;
   const asGM = game.user.isGM;
   const choices = depositCandidates(objective, asGM);
   if (!choices.length)
   {
      ui.notifications.warn(game.i18n.format(asGM ? 'FHQL.Deposit.NoneAnywhere' : 'FHQL.Deposit.NoneCarried', { item: requirement.name }));
      return;
   }
   const dropped = itemUuid ? choices.find((c) => c.itemUuid === itemUuid) : null;
   if (itemUuid && !dropped)
   {
      ui.notifications.warn(game.i18n.format('FHQL.Deposit.Error.WrongItem', { item: requirement.name }));
      return;
   }
   const confirmed = await confirmDeposit(app, anchor, objective, choices, dropped ?? (asGM ? null : defaultDepositChoice(choices)));
   if (confirmed) { await requestDeposit(entry, objectiveId, confirmed.choice, confirmed.qty); }
}

/**
 * An item dragged from a character sheet onto an objective: confirms, starting on that item.
 *
 * @param {object} app - The quest sheet.
 * @param {HTMLElement} zone - The objective row it was dropped on.
 * @param {string} objectiveId - Objective ID.
 * @param {Document|null} doc - The dropped document.
 */
export async function depositDropped(app, zone, objectiveId, doc)
{
   if (doc?.documentName !== 'Item' || doc.parent?.documentName !== 'Actor')
   {
      ui.notifications.warn(game.i18n.localize('FHQL.Deposit.FromCharacter'));
      return;
   }
   await startDeposit(app, zone.querySelector('[data-action="depositItem"]') ?? zone, objectiveId, doc.uuid);
}

/* ---------- Actions (called with `this` as the quest sheet) ---------- */

async function onAddObjective()
{
   if (this.questEntry) { await addObjective(this.questEntry); }
}

async function onCycleObjective(event, target)
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

async function onDeleteObjective(event, target)
{
   const found = objectiveFor(this, target);
   if (!found) { return; }
   // Handed-over items live only in the deposit records; deleting them loses the way to return them.
   const held = found.objective.deposits.filter((d) => d.item).reduce((sum, d) => sum + d.qty, 0);
   if (held)
   {
      const ok = await confirmPopover(this, target, {
         message: `<p>${game.i18n.format('FHQL.Deposit.DeleteQuestion', {
            qty: held, item: foundry.utils.escapeHTML(found.objective.requirement.name)
         })}</p>`,
         yes: game.i18n.localize('FHQL.Objective.Delete'),
         danger: true
      });
      if (!ok) { return; }
   }
   await deleteObjective(this.questEntry, found.id);
}

async function onToggleObjectiveHidden(event, target)
{
   const found = objectiveFor(this, target);
   if (found) { await updateQuest(this.questEntry, { [`system.objectives.${found.id}.hidden`]: !found.objective.hidden }); }
}

/** Hand over or show: confirm the source and amount, then deposit. */
async function onDepositItem(event, target)
{
   const found = objectiveFor(this, target);
   if (found) { await startDeposit(this, target, found.id); }
}

async function onUndoDeposit(event, target)
{
   const found = objectiveFor(this, target);
   if (!found) { return; }
   const index = Number(target.dataset.depositIndex);
   const deposit = found.objective.deposits[index];
   if (!deposit) { return; }
   let returnItem = false;
   if (deposit.item)
   {
      const answer = await confirmPopover(this, target, {
         message: `<p>${game.i18n.format('FHQL.Deposit.UndoQuestion', {
            qty: deposit.qty, item: foundry.utils.escapeHTML(found.objective.requirement.name),
            actor: foundry.utils.escapeHTML(deposit.actorName)
         })}</p>`,
         yes: game.i18n.localize('FHQL.Deposit.Return'),
         no: game.i18n.localize('FHQL.Deposit.Keep')
      });
      if (answer === null) { return; }
      returnItem = answer;
   }
   await undoDeposit(this.questEntry, found.id, index, { returnItem });
}

async function onClearRequirement(event, target)
{
   const found = objectiveFor(this, target);
   if (!found) { return; }
   const error = await clearRequirement(this.questEntry, found.id);
   if (error) { ui.notifications.warn(game.i18n.localize(`FHQL.Deposit.Error.${error}`)); }
}

/** Objective and deposit actions, merged into the quest sheet's actions. */
export const objectiveActions = {
   addObjective: onAddObjective,
   cycleObjective: onCycleObjective,
   deleteObjective: onDeleteObjective,
   toggleObjectiveHidden: onToggleObjectiveHidden,
   depositItem: onDepositItem,
   undoDeposit: onUndoDeposit,
   clearRequirement: onClearRequirement
};
