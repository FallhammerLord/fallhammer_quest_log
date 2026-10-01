import { confirmPopover, menuPopover } from '../../ui/popover.js';
import {
   clearRequirement, defaultDepositChoice, depositCandidates, depositedTotal, depositLabel, hasRequirement, requestDeposit,
   stillNeeded, undoDeposit
} from '../../data/deposits.js';
import { claimTargets } from '../../data/rewards.js';
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
      // A player with more than one actor (a second character, a shared party inventory) can pick the source.
      depositChoose: !gm && claimTargets(game.user).length > 1,
      depositChooseLabel: game.i18n.format('FHQL.Deposit.ChooseSource', { verb, item: requirement.name }),
      depositVerb: verb,
      depositAria: game.i18n.format('FHQL.Deposit.ActionLabel', { verb, item: requirement.name }),
      depositIcon: give ? 'fa-hand-holding-hand' : 'fa-eye',
      depositsList: objective.deposits.map((d, index) => ({ index, label: depositLabel(d), held: !!d.item, gm }))
   };
}

/**
 * Deposits an item dragged from a character sheet onto an objective.
 *
 * @param {JournalEntry} entry - The quest.
 * @param {string} objectiveId - Objective ID.
 * @param {Document|null} doc - The dropped document.
 */
export async function depositDropped(entry, objectiveId, doc)
{
   const objective = questPage(entry)?.system.objectives[objectiveId];
   if (!objective) { return; }
   if (doc?.documentName !== 'Item' || doc.parent?.documentName !== 'Actor')
   {
      ui.notifications.warn(game.i18n.localize('FHQL.Deposit.FromCharacter'));
      return;
   }
   const choice = depositCandidates(objective, game.user.isGM).find((c) => c.itemUuid === doc.uuid);
   if (!choice)
   {
      ui.notifications.warn(game.i18n.format('FHQL.Deposit.Error.WrongItem', { item: objective.requirement.name }));
      return;
   }
   await requestDeposit(entry, objectiveId, choice);
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

/**
 * Hand over or show an item. A player's click takes it from their assigned character when that
 * character carries it, else from the only actor that does; otherwise, and always for the GM, a child
 * panel lists every actor carrying it.
 *
 * @param {Event} event - The click.
 * @param {HTMLElement} target - The button.
 * @param {boolean} [choose] - Always list the sources (the ▾ button).
 */
async function onDepositItem(event, target, choose = false)
{
   const found = objectiveFor(this, target);
   if (!found) { return; }
   const { requirement } = found.objective;
   const asGM = game.user.isGM;
   const choices = depositCandidates(found.objective, asGM);
   if (!choices.length)
   {
      ui.notifications.warn(game.i18n.format(asGM ? 'FHQL.Deposit.NoneAnywhere' : 'FHQL.Deposit.NoneCarried', { item: requirement.name }));
      return;
   }
   let choice = !choose && !asGM ? defaultDepositChoice(choices) : null;
   if (!choice && choices.length === 1 && !choose) { choice = choices[0]; }
   if (!choice)
   {
      const hint = (c) => [
         c.assigned ? game.i18n.localize(asGM ? 'FHQL.Deposit.PlayerCharacter' : 'FHQL.Deposit.YourCharacter') : '',
         c.shared ? game.i18n.localize('FHQL.Deposit.Shared') : ''
      ].filter(Boolean).join(' · ');
      const picked = await menuPopover(this, target, {
         title: game.i18n.format('FHQL.Deposit.Choose', { item: requirement.name }),
         items: choices.map((c, i) => ({ value: String(i), label: c.label, icon: 'fa-solid fa-box', hint: hint(c) }))
      });
      if (picked === null) { return; }
      choice = choices[Number(picked)];
   }
   await requestDeposit(this.questEntry, found.id, choice);
}

/** The ▾ beside Hand over: always choose which actor it comes from. */
function onDepositItemFrom(event, target)
{
   return onDepositItem.call(this, event, target, true);
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
   depositItemFrom: onDepositItemFrom,
   undoDeposit: onUndoDeposit,
   clearRequirement: onClearRequirement
};
