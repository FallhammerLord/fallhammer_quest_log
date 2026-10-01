import { postChat } from '../compat.js';
import { itemQuantity, itemQuantityUpdate, itemSourceUuids } from './systemItems.js';
import { registerRelay, relay } from './relay.js';
import { MODULE_ID } from '../constants.js';
import { addObjective, getQuestEntry, questAccess, questPage, updateQuest } from './quests.js';
import { claimTargets } from './rewards.js';
import { actorsForGM, assignedToSomeone, playerFor, sharedActor } from './owners.js';

/**
 * Item requirements on objectives, and players depositing items toward them. See docs/SCOPE.md 5.11.
 *
 * An objective can require an item and a count. Players hand items over (they leave the character)
 * or only show them (they stay). Deposits run on the GM's client through the relay
 * (`fhql.deposit`), one at a time, and each takes only what is still needed at that moment, so two
 * players filling the last slot together never lose the difference.
 *
 * As with claims, the GM side isn't told who sent a request and re-checks everything against the
 * named user.
 */

const RELAY = 'deposit';
const { OWNER } = CONST.DOCUMENT_OWNERSHIP_LEVELS;

/** Registers the GM-side deposit handler. Called on `init`. */
export function registerDepositQueries()
{
   registerRelay(RELAY, depositNow);
}

/* ---------- Reading requirements ---------- */

/**
 * @param {object} objective - Objective data.
 * @returns {boolean} Whether it requires an item.
 */
export function hasRequirement(objective)
{
   return !!objective?.requirement?.uuid;
}

/**
 * @param {object} objective - Objective data.
 * @returns {number} How many items have been handed over or shown so far.
 */
export function depositedTotal(objective)
{
   return (objective?.deposits ?? []).reduce((sum, d) => sum + d.qty, 0);
}

/**
 * @param {object} objective - Objective data.
 * @returns {number} How many are still needed. Never below zero.
 */
export function stillNeeded(objective)
{
   return Math.max(0, (objective?.requirement?.count ?? 0) - depositedTotal(objective));
}

/**
 * @param {Item} item - An item on a character.
 * @returns {number} How many it counts as: its stack size, or 1 where the system has no quantity.
 */
export function itemCount(item)
{
   return itemQuantity(item) ?? 1;
}

/**
 * Whether an item satisfies a requirement: made from the required item (compendium or world copy),
 * or the same item, or failing those, the same name.
 *
 * @param {Item} item - A candidate item.
 * @param {object} requirement - Requirement data.
 * @returns {boolean} Whether it matches.
 */
export function itemMatches(item, requirement)
{
   if (!item || !requirement?.uuid) { return false; }
   if (item.uuid === requirement.uuid || itemSourceUuids(item).includes(requirement.uuid)) { return true; }
   const name = (value) => String(value ?? '').trim().toLocaleLowerCase();
   return !!name(requirement.name) && name(item.name) === name(requirement.name);
}

/**
 * Items that could be deposited toward an objective, best source first.
 *
 * Players see items on actors they own: their assigned character first, then the rest (a shared
 * party inventory, a second character). The GM sees items on any world actor, player characters
 * first; a deposit from an actor no player owns is recorded under the GM.
 *
 * @param {object} objective - Objective data.
 * @param {boolean} asGM - Whether the GM is depositing.
 * @returns {{ itemUuid: string, userId: string, actorId: string, label: string, count: number,
 *   assigned: boolean, shared: boolean }[]} Choices.
 */
export function depositCandidates(objective, asGM)
{
   if (!hasRequirement(objective)) { return []; }
   const shown = new Set(objective.deposits.map((d) => d.itemUuid));
   const actors = asGM ? actorsForGM() : claimTargets(game.user);
   const choices = [];
   for (const actor of actors)
   {
      const owner = asGM ? playerFor(actor) : game.user;
      for (const item of actor.items)
      {
         if (!itemMatches(item, objective.requirement)) { continue; }
         if (objective.requirement.mode === 'show' && shown.has(item.uuid)) { continue; }
         const count = itemCount(item);
         if (count < 1) { continue; }
         choices.push({
            itemUuid: item.uuid,
            userId: owner?.id ?? game.user.id,
            actorId: actor.id,
            label: `${actor.name}: ${item.name}${count > 1 ? ` ×${count}` : ''}`,
            count,
            assigned: asGM ? assignedToSomeone(actor) : actor.id === game.user.character?.id,
            shared: sharedActor(actor)
         });
      }
   }
   return choices;
}

/**
 * The source a one-click Hand over uses for a player: their assigned character if it carries the
 * item, else the only actor that does. Null when the player must choose.
 *
 * @param {object[]} choices - From depositCandidates, for a player.
 * @returns {object|null} The choice.
 */
export function defaultDepositChoice(choices)
{
   return choices.find((c) => c.assigned) ?? (choices.length === 1 ? choices[0] : null);
}

/* ---------- Depositing ---------- */

/**
 * Deposits an item: runs on this client if GM, otherwise asks the active GM's client.
 *
 * @param {JournalEntry} entry - The quest entry.
 * @param {string} objectiveId - Objective ID.
 * @param {{ itemUuid: string, userId: string }} choice - The item, and the player it's deposited for.
 * @param {number} [qty] - How many the player confirmed. The GM takes no more than this, the stack, or what's needed.
 * @returns {Promise<boolean>} Whether anything was deposited.
 */
export async function requestDeposit(entry, objectiveId, choice, qty)
{
   const result = await relay(RELAY, { entryId: entry.id, objectiveId, itemUuid: choice.itemUuid, userId: choice.userId, qty },
      { needGM: 'FHQL.Deposit.NeedGM', failed: 'FHQL.Deposit.Error.Failed' });
   return result.ok;
}

/**
 * GM side of a deposit, run through the relay queue. Validates against live data, records the deposit, then takes the item.
 * Takes only what is still needed; refuses when nothing is. If taking the item fails, the record is
 * rolled back, so an item is never lost to a half-finished step.
 *
 * @param {{ entryId: string, objectiveId: string, itemUuid: string, userId: string }} data - Request.
 * @param {{ force?: boolean }} [options] - `force`: the GM is depositing for a player.
 * @returns {Promise<{ ok: boolean, message: string }>} Outcome.
 */
async function depositNow(data, { force = false } = {})
{
   const fail = (key, values = {}) => ({ ok: false, message: game.i18n.format(`FHQL.Deposit.Error.${key}`, values) });
   if (!game.user.isGM) { return fail('NotGM'); }

   const entry = getQuestEntry(data.entryId);
   const page = questPage(entry);
   const objective = page?.system.objectives[data.objectiveId];
   const user = game.users.get(data.userId);
   if (!entry || !objective || !user || !hasRequirement(objective)) { return fail('NotFound'); }
   // Only the GM deposits for others (force). A request naming a GM can only be a player posing as one.
   if (!force && user.isGM) { return fail('NotOwner'); }
   if (!force && (!questAccess(entry, user).full || objective.hidden)) { return fail('Closed'); }
   if (['completed', 'failed'].includes(page.system.status)) { return fail('Closed'); }

   const requirement = objective.requirement;
   const item = await fromUuid(data.itemUuid);
   const actor = item?.parent;
   if (!item || item.documentName !== 'Item' || actor?.documentName !== 'Actor' || actor.pack
    || !actor.testUserPermission(user, OWNER)) { return fail('NotOwner'); }
   if (!itemMatches(item, requirement)) { return fail('WrongItem', { item: requirement.name }); }

   const give = requirement.mode === 'give';
   if (!give && objective.deposits.some((d) => d.itemUuid === item.uuid)) { return fail('AlreadyShown', { item: item.name }); }

   const have = itemCount(item);
   const need = stillNeeded(objective);
   if (need < 1) { return fail('Full', { item: requirement.name }); }
   // The confirmed amount caps the take; a missing or malformed amount means "as many as needed".
   const wanted = Number.isInteger(data.qty) && data.qty > 0 ? data.qty : have;
   const take = Math.min(have, need, wanted);
   if (take < 1) { return fail('NotOwner'); }

   let snapshot = null;
   if (give)
   {
      snapshot = item.toObject();
      if (itemQuantity(item) !== null)
      {
         for (const [key, value] of Object.entries(itemQuantityUpdate(item, take))) { foundry.utils.setProperty(snapshot, key, value); }
      }
   }
   const before = { deposits: [...objective.deposits], state: objective.state };
   const record = {
      userId: user.id, actorUuid: actor.uuid, actorName: actor.name, itemUuid: item.uuid, qty: take, at: Date.now(), item: snapshot
   };
   const path = `system.objectives.${data.objectiveId}`;
   const changes = { [`${path}.deposits`]: [...before.deposits, record] };
   if (before.state === 'open' && take >= need) { changes[`${path}.state`] = 'done'; }

   // Record first, then take the item; undo the record if taking fails.
   await page.update(changes);
   if (give)
   {
      try
      {
         if (have > take) { await item.update(itemQuantityUpdate(item, have - take)); }
         else { await item.delete(); }
      }
      catch (err)
      {
         console.error(`${MODULE_ID} | Taking a deposited item failed; rolling back`, err);
         await page.update({ [`${path}.deposits`]: before.deposits, [`${path}.state`]: before.state });
         return fail('Failed');
      }
   }

   const who = `${user.name} (${actor.name})`;
   const escape = foundry.utils.escapeHTML;
   await postChat(game.i18n.localize('FHQL.QuestLog.Title'), `<div class="fhql-chat-claim">
         ${requirement.img ? `<img src="${escape(requirement.img)}" alt="" width="36" height="36">` : ''}
         <p>${game.i18n.format(`FHQL.Deposit.Chat.${requirement.mode}`, {
            who: escape(who), qty: take, item: escape(item.name), quest: escape(entry.name)
         })}</p></div>`);

   const kept = give ? have - take : 0;
   const key = give ? (kept > 0 ? 'GaveKept' : 'Gave') : 'Shown';
   return { ok: true, message: game.i18n.format(`FHQL.Deposit.${key}`, { qty: take, item: item.name, kept }) };
}

/* ---------- GM: undo, requirements ---------- */

/**
 * Removes one deposit. GM only. Can return a handed-over item to the character it came from: back
 * onto its stack if that still exists, else as a new item. Reopens the objective if it falls short.
 *
 * @param {JournalEntry} entry - The quest entry.
 * @param {string} objectiveId - Objective ID.
 * @param {number} index - Index into the objective's deposits.
 * @param {{ returnItem?: boolean }} [options] - Whether to give the item back.
 * @returns {Promise<boolean>} Whether the deposit was removed.
 */
export async function undoDeposit(entry, objectiveId, index, { returnItem = false } = {})
{
   if (!game.user.isGM) { return false; }
   const page = questPage(entry);
   const objective = page?.system.objectives[objectiveId];
   const deposit = objective?.deposits[index];
   if (!deposit) { return false; }

   if (returnItem && deposit.item)
   {
      const actor = await fromUuid(deposit.actorUuid);
      if (!actor)
      {
         ui.notifications.warn(game.i18n.format('FHQL.Deposit.Error.ActorGone', { actor: deposit.actorName }));
         return false;
      }
      const stack = actor.items.get(deposit.item._id);
      if (stack && itemQuantity(stack) !== null && itemMatches(stack, objective.requirement))
      {
         await stack.update(itemQuantityUpdate(stack, itemQuantity(stack) + deposit.qty));
      }
      else
      {
         const data = foundry.utils.deepClone(deposit.item);
         delete data._id;
         await actor.createEmbeddedDocuments('Item', [data]);
      }
   }

   const deposits = objective.deposits.filter((d, i) => i !== index);
   const changes = { [`system.objectives.${objectiveId}.deposits`]: deposits };
   const total = deposits.reduce((sum, d) => sum + d.qty, 0);
   if (objective.state === 'done' && total < objective.requirement.count) { changes[`system.objectives.${objectiveId}.state`] = 'open'; }
   await page.update(changes);
   return true;
}

/**
 * @param {Document|null} doc - A dropped document.
 * @returns {object|null} Requirement fields for it, or null if it isn't an item.
 */
function requirementFrom(doc)
{
   if (doc?.documentName !== 'Item') { return null; }
   return { uuid: doc.uuid, name: doc.name, img: doc.img ?? '' };
}

/**
 * Makes an objective require an item. Refused while deposits of a different item are recorded.
 *
 * @param {JournalEntry} entry - The quest entry.
 * @param {string} objectiveId - Objective ID.
 * @param {Document|null} doc - The dropped item.
 * @returns {Promise<string>} '' on success, else an FHQL.Deposit.Error key.
 */
export async function setRequirement(entry, objectiveId, doc)
{
   const objective = questPage(entry)?.system.objectives[objectiveId];
   const fields = requirementFrom(doc);
   if (!objective || !fields) { return 'NotItem'; }
   if (objective.deposits.length && fields.uuid !== objective.requirement.uuid) { return 'HasDeposits'; }
   const changes = Object.fromEntries(Object.entries(fields).map(([k, v]) => [`system.objectives.${objectiveId}.requirement.${k}`, v]));
   if (!objective.name.trim()) { changes[`system.objectives.${objectiveId}.name`] = doc.name; }
   await updateQuest(entry, changes);
   return '';
}

/**
 * Adds a new objective requiring a dropped item, named after it.
 *
 * @param {JournalEntry} entry - The quest entry.
 * @param {Document|null} doc - The dropped item.
 * @returns {Promise<boolean>} Whether it was an item.
 */
export async function addRequirementObjective(entry, doc)
{
   const fields = requirementFrom(doc);
   if (!fields) { return false; }
   await addObjective(entry, doc.name, { requirement: { ...fields, count: 1, mode: 'give' } });
   return true;
}

/**
 * Removes an objective's requirement. Refused while deposits are recorded, so no deposit is orphaned.
 *
 * @param {JournalEntry} entry - The quest entry.
 * @param {string} objectiveId - Objective ID.
 * @returns {Promise<string>} '' on success, else an FHQL.Deposit.Error key.
 */
export async function clearRequirement(entry, objectiveId)
{
   const objective = questPage(entry)?.system.objectives[objectiveId];
   if (!objective) { return 'NotFound'; }
   if (objective.deposits.length) { return 'HasDeposits'; }
   await updateQuest(entry, { [`system.objectives.${objectiveId}.requirement`]: { uuid: '', name: '', img: '', count: 1, mode: 'give' } });
   return '';
}

/**
 * Describes a deposit for display: "Rinn (Kestrel): 2".
 *
 * @param {object} deposit - Deposit data.
 * @returns {string} Label.
 */
export function depositLabel(deposit)
{
   const user = game.users.get(deposit.userId)?.name ?? game.i18n.localize('FHQL.Reward.UnknownPlayer');
   return `${user} (${deposit.actorName}): ${deposit.qty}`;
}
