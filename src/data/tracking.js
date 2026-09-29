import { MODULE_ID } from '../constants.js';
import { questPage, visibleQuests } from './quests.js';

/**
 * Personal quest tracking. Each user marks quests to follow on their own Quest Beacon, separate from
 * the party-wide In Progress marker the GM sets. Stored as flags on the user's own User document, so
 * it follows them between devices and needs no GM. See docs/SCOPE.md 7.2.
 */

/** @returns {string[]} IDs of quests the current user tracks. */
export function trackedIds()
{
   return game.user.getFlag(MODULE_ID, 'tracked') ?? [];
}

/**
 * @param {JournalEntry} entry - A quest entry.
 * @returns {boolean} Whether the current user tracks it.
 */
export function isTracked(entry)
{
   return trackedIds().includes(entry.id);
}

/**
 * Starts or stops tracking a quest for the current user.
 *
 * @param {JournalEntry} entry - The quest entry.
 */
export async function toggleTracked(entry)
{
   const ids = trackedIds();
   const next = ids.includes(entry.id) ? ids.filter((id) => id !== entry.id) : [...ids, entry.id];
   await game.user.setFlag(MODULE_ID, 'tracked', next);
}

/**
 * Quests shown on the current user's Beacon: party In Progress quests plus their own tracked ones,
 * limited to quests they can see. Party quests come first.
 *
 * @returns {{ entry: JournalEntry, party: boolean, tracked: boolean }[]} Marked quests.
 */
export function beaconQuests()
{
   const tracked = new Set(trackedIds());
   return visibleQuests()
    .map((entry) => ({ entry, party: questPage(entry).system.inProgress, tracked: tracked.has(entry.id) }))
    .filter((q) => q.party || q.tracked)
    .sort((a, b) => Number(b.party) - Number(a.party));
}

/** @returns {string|null} The quest the current user chose to show on their Beacon. */
export function beaconChoice()
{
   return game.user.getFlag(MODULE_ID, 'beaconQuest') ?? null;
}

/** @param {string} id - Quest to show on the current user's Beacon. */
export async function setBeaconChoice(id)
{
   await game.user.setFlag(MODULE_ID, 'beaconQuest', id);
}
