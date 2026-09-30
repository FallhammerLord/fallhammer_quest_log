import { MODULE_ID } from '../constants.js';
import { createQuest, getQuestEntry, questAccess, questPage, setStatus, updateQuest } from './quests.js';

/**
 * Player workflows that need GM rights: accepting a quest, proposing a new one, and editing shared
 * player notes on a quest the player doesn't own. Each is gated by a world setting and runs on the
 * active GM's client through `CONFIG.queries['fhql.playerAction']`. See docs/SCOPE.md 4.1.
 *
 * The query API doesn't identify the sender, so the GM side checks every request against the named
 * user and the world settings.
 */

const QUERY = `${MODULE_ID}.playerAction`;
const setting = (key) => game.settings.get(MODULE_ID, key);

/** Registers the GM-side handler. Called on `init`. */
export function registerPlayerActionQueries()
{
   CONFIG.queries[QUERY] = (data) => performPlayerAction(data);
}

/** @returns {boolean} Whether the Quest Log is available to the current user. */
export function questLogAvailable()
{
   return game.user.isGM || !setting('hideFromPlayers');
}

/**
 * @param {JournalEntry} entry - A quest entry.
 * @returns {boolean} Whether the current user may accept it now.
 */
export function canAccept(entry)
{
   return !game.user.isGM && setting('playersCanAccept') && questPage(entry)?.system.status === 'available'
    && questAccess(entry).visible;
}

/**
 * @param {JournalEntry} entry - A quest entry.
 * @returns {boolean} Whether the current user may edit its player notes through the GM.
 */
export function canEditNotesViaGM(entry)
{
   const access = questAccess(entry);
   return !access.editable && access.full && setting('playersEditNotes');
}

/** @returns {boolean} Whether the current user may propose new quests. */
export function canProposeQuests()
{
   return !game.user.isGM && setting('playersCanCreate');
}

/**
 * @param {JournalEntry} entry - A quest entry.
 * @returns {boolean} Whether the current user is a trusted owner allowed to change status.
 */
export function canChangeStatusAsPlayer(entry)
{
   return !game.user.isGM && setting('trustedCanChangeStatus') && game.user.isTrusted && questAccess(entry).editable;
}

/**
 * Sends a player action to the active GM's client, or runs it here if this is a GM.
 *
 * @param {object} data - Action data: { action, entryId?, name?, html? }.
 * @returns {Promise<{ ok: boolean, id?: string, message?: string }>} Outcome.
 */
export async function requestPlayerAction(data)
{
   const request = { ...data, userId: game.user.id };
   if (game.user.isGM) { return performPlayerAction(request); }
   const gm = game.users.activeGM;
   if (!gm)
   {
      ui.notifications.warn(game.i18n.localize('FHQL.Player.NeedGM'));
      return { ok: false };
   }
   try
   {
      const result = await gm.query(QUERY, request, { timeout: 15000 });
      if (!result?.ok && result?.message) { ui.notifications.warn(result.message); }
      return result ?? { ok: false };
   }
   catch (err)
   {
      console.error(`${MODULE_ID} | Player action failed`, err);
      ui.notifications.warn(game.i18n.localize('FHQL.Player.Failed'));
      return { ok: false };
   }
}

/**
 * GM side of a player action.
 *
 * @param {{ action: string, userId: string, entryId?: string, name?: string, html?: string }} data - Request.
 * @returns {Promise<{ ok: boolean, id?: string, message?: string }>} Outcome.
 */
async function performPlayerAction(data)
{
   const refuse = (key) => ({ ok: false, message: game.i18n.localize(`FHQL.Player.Refused.${key}`) });
   if (!game.user.isGM) { return refuse('NotGM'); }
   // Requests come from players and name their sender, which the query API can't verify. A request
   // naming a GM is never genuine (GMs act directly), and would pass every permission check.
   const user = game.users.get(data.userId);
   if (!user || user.isGM) { return refuse('NotAllowed'); }

   if (data.action === 'create')
   {
      if (!setting('playersCanCreate')) { return refuse('NotAllowed'); }
      const entry = await createQuest({
         name: String(data.name ?? '').slice(0, 200) || game.i18n.format('FHQL.Player.ProposedName', { user: user.name }),
         system: { status: 'available' }
      });
      await entry.update({ [`ownership.${user.id}`]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER });
      return { ok: true, id: entry.id };
   }

   const entry = getQuestEntry(data.entryId);
   if (!entry) { return refuse('NotFound'); }
   const access = questAccess(entry, user);

   if (data.action === 'accept')
   {
      if (!setting('playersCanAccept') || !access.visible || questPage(entry).system.status !== 'available') { return refuse('NotAllowed'); }
      await setStatus(entry, 'active');
      return { ok: true };
   }

   if (data.action === 'playerNotes')
   {
      if (!setting('playersEditNotes') || !access.full) { return refuse('NotAllowed'); }
      await updateQuest(entry, { 'system.playerNotes': String(data.html ?? '') });
      return { ok: true };
   }

   return refuse('NotAllowed');
}
