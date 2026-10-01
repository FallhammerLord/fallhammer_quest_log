import { MODULE_ID } from '../constants.js';

/**
 * One editor at a time for a quest's player notes. See docs/SCOPE.md 5.12.
 *
 * Whoever is editing marks it on their own User document (`flags.fhql.editingNotes`), which every
 * player may write and every client sees. A mark from a user who is no longer connected doesn't
 * count, so a lost connection never leaves notes locked. If two people start within the same
 * moment, the earlier mark wins.
 */

const FLAG = 'editingNotes';

/**
 * @param {User} user - A user.
 * @returns {{ entryId: string, at: number }|null} What they're editing, if anything.
 */
function markOf(user)
{
   const mark = user.getFlag(MODULE_ID, FLAG);
   return mark?.entryId ? mark : null;
}

/** @returns {boolean} Whether `a` claimed before `b`; ties go to the lower user ID. */
function earlier(a, b)
{
   return a.mark.at < b.mark.at || (a.mark.at === b.mark.at && a.user.id < b.user.id);
}

/**
 * @param {JournalEntry} entry - A quest.
 * @returns {User|null} Another connected user editing this quest's player notes, if any.
 */
export function notesEditor(entry)
{
   const others = game.users
    .filter((u) => u.id !== game.user.id && u.active)
    .map((user) => ({ user, mark: markOf(user) }))
    .filter((o) => o.mark?.entryId === entry.id)
    .sort((a, b) => (earlier(a, b) ? -1 : 1));
   return others[0]?.user ?? null;
}

/**
 * @param {JournalEntry} entry - A quest.
 * @returns {boolean} Whether this user holds the notes lock for it.
 */
export function holdsNotes(entry)
{
   return markOf(game.user)?.entryId === entry.id;
}

/**
 * Claims the notes for this user. Refused while someone else holds them, unless `force` (GM).
 *
 * @param {JournalEntry} entry - A quest.
 * @param {{ force?: boolean }} [options] - Take over from another editor.
 * @returns {Promise<User|null>} null when claimed, else who holds them.
 */
export async function claimNotes(entry, { force = false } = {})
{
   const holder = notesEditor(entry);
   if (holder && !force) { return holder; }
   await game.user.setFlag(MODULE_ID, FLAG, { entryId: entry.id, at: Date.now() });
   // Someone may have claimed in the same moment; the earlier claim keeps it.
   const rival = notesEditor(entry);
   if (rival && !force && earlier({ user: rival, mark: markOf(rival) }, { user: game.user, mark: markOf(game.user) }))
   {
      await releaseNotes(entry);
      return rival;
   }
   return null;
}

/**
 * Releases this user's notes lock: for one quest, or whatever they hold.
 *
 * @param {JournalEntry} [entry] - Only release if it's for this quest.
 */
export async function releaseNotes(entry)
{
   const mark = markOf(game.user);
   if (!mark || (entry && mark.entryId !== entry.id)) { return; }
   await game.user.unsetFlag(MODULE_ID, FLAG);
}

/**
 * @param {object} changes - A User update.
 * @returns {boolean} Whether it changed someone's notes lock.
 */
export function touchesNotesLock(changes)
{
   return foundry.utils.hasProperty(changes, `flags.${MODULE_ID}.${FLAG}`)
    || foundry.utils.hasProperty(changes, `flags.${MODULE_ID}.-=${FLAG}`);
}
