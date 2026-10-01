import { modifiedTime } from '../compat.js';
import { MODULE_ID } from '../constants.js';
import { questPage, visibleQuests } from './quests.js';

/**
 * "New" markers: a dot on quests that changed since this user last looked at them. See docs/SCOPE.md 7.4e.
 *
 * Each user keeps `flags.fhql.seen` on their own User document: quest ID to the quest's last-change
 * time when they last saw it, plus `_base`, the newest change when they first used the feature (so an
 * existing world doesn't light up with dots). Times are the documents' own server timestamps, never
 * the local clock, so clocks that disagree can't keep a dot lit or cause repeated writes.
 */

const FLAG = 'seen';

/** @returns {Record<string, number>|null} This user's seen times, if they've started. */
function seenTimes()
{
   return game.user.getFlag(MODULE_ID, FLAG) ?? null;
}

/**
 * @param {JournalEntry} entry - A quest.
 * @returns {number} When the quest last changed: its entry or its quest page, whichever is newer.
 */
export function questModified(entry)
{
   return Math.max(modifiedTime(entry), modifiedTime(questPage(entry)));
}

/**
 * @param {JournalEntry} entry - A quest.
 * @returns {boolean} Whether it changed since this user last saw it.
 */
export function isUnseen(entry)
{
   const seen = seenTimes();
   if (!seen) { return false; }
   return questModified(entry) > (seen[entry.id] ?? seen._base ?? 0);
}

/** On first use, counts every quest this user can see as seen. Called on `ready`. */
export async function startSeenTracking()
{
   if (seenTimes()) { return; }
   const base = Math.max(0, ...visibleQuests().map(questModified));
   await game.user.setFlag(MODULE_ID, FLAG, { _base: base });
}

/** Quests marked seen but not yet written, batched into one write. */
const pending = new Map();
let timer = null;

/**
 * Marks a quest seen because it's on screen. Writes only when it was unseen, batched, so showing a
 * quest costs nothing once it's been seen.
 *
 * @param {JournalEntry} entry - A quest being shown.
 */
export function markSeen(entry)
{
   if (!entry || !isUnseen(entry)) { return; }
   pending.set(entry.id, questModified(entry));
   clearTimeout(timer);
   timer = setTimeout(() =>
   {
      const update = Object.fromEntries(pending);
      pending.clear();
      game.user.setFlag(MODULE_ID, FLAG, update);
   }, 400);
}

/**
 * @param {object} changes - A User update.
 * @returns {boolean} Whether it changed nothing of ours but seen times (so only dots need redrawing).
 */
export function onlySeenChanged(changes)
{
   const ours = changes?.flags?.[MODULE_ID];
   return !!ours && Object.keys(ours).every((key) => key === FLAG);
}
