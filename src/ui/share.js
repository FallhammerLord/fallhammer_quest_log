import { queryUser, registerQuery } from '../compat.js';
import { MODULE_ID } from '../constants.js';
import { getQuestEntry, questAccess } from '../data/quests.js';

/**
 * Show to players: the GM opens a quest's window on players' screens, like Forien's Quest Log's Show
 * button. See docs/SCOPE.md 5.13.
 *
 * The GM's client asks each chosen player's client directly (`fhql.showQuest` query). A player's
 * client opens the quest only if that player may see it; nothing is revealed by showing.
 */

const QUERY = `${MODULE_ID}.showQuest`;

/** Registers the player-side handler. Called on `init`. */
export function registerShareQuery()
{
   registerQuery(QUERY, async ({ entryId } = {}) =>
   {
      const entry = getQuestEntry(entryId);
      if (!entry || !questAccess(entry).visible) { return { ok: false }; }
      // Loaded on demand: the quest window module imports the sheet, which imports this file.
      const { QuestSheetApp } = await import('../apps/QuestSheetApp.js');
      const app = QuestSheetApp.open(entryId);
      app?.bringToFront?.();
      return { ok: !!app };
   });
}

/**
 * @param {JournalEntry} entry - A quest.
 * @returns {User[]} Connected players who may see it, so showing it to them works.
 */
export function showablePlayers(entry)
{
   return game.users.filter((u) => !u.isGM && u.active && questAccess(entry, u).visible);
}

/**
 * Opens the quest on the given players' screens. GM only.
 *
 * @param {JournalEntry} entry - The quest.
 * @param {User[]} users - Who to show it to.
 * @returns {Promise<{ shown: User[], missed: User[] }>} Who saw it, and who couldn't be reached.
 */
export async function showToPlayers(entry, users)
{
   if (!game.user.isGM) { return { shown: [], missed: users }; }
   const results = await Promise.allSettled(users.map((u) => queryUser(u, QUERY, { entryId: entry.id })));
   const shown = users.filter((u, i) => results[i].status === 'fulfilled' && results[i].value?.ok);
   return { shown, missed: users.filter((u) => !shown.includes(u)) };
}
