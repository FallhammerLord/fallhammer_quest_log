import { STATUSES } from '../constants.js';
import { questAccess, questPage } from '../data/quests.js';
import { isUnseen } from '../data/seen.js';

/**
 * Quest Log list: quest families. A parent quest folds like a folder to hide its subquests; its row
 * then sums up what is inside (how many are done, and any new, tracked, or party-focus subquest).
 * Rows carry their ancestors (folders, then parent quests) in data-chain, so one folded ancestor hides
 * a row, whichever kind it is.
 */

/** "Active subquests first" order; ties keep the list's own order. */
const STATUS_ORDER = { active: 0, available: 1, hidden: 2, completed: 3, failed: 4 };

/**
 * What the search box matches for a quest: its name, and for those who may read it in full, the
 * quest giver and the objectives they can see (players never match hidden objectives).
 *
 * @param {JournalEntry} entry - A quest.
 * @returns {string} Lower-case search text.
 */
function searchText(entry)
{
   const parts = [entry.name];
   const access = questAccess(entry);
   if (access.full)
   {
      const { giver, objectiveList } = questPage(entry).system;
      parts.push(giver.name, ...objectiveList.filter((o) => access.gm || !o.hidden).map((o) => o.name));
   }
   return parts.filter(Boolean).join('\n').toLowerCase();
}

/** Statuses that count as done in a family's summary. */
const FINISHED = new Set(['completed', 'failed']);

/**
 * Quest rows for one folder's quests, each followed by its subquests.
 *
 * @param {JournalEntry[]} entries - Visible quests in this folder.
 * @param {object} options - Row options.
 * @param {number} options.depth - Indent of top-level quests here.
 * @param {string[]} options.chain - Folder IDs containing these quests.
 * @param {string|null} options.selectedId - The quest shown beside the list.
 * @param {Set<string>} options.tracked - Quests this player tracks.
 * @param {boolean} options.activeFirst - Sort subquests active, available, then done.
 * @returns {object[]} Rows.
 */
export function questRows(entries, { depth, chain, selectedId, tracked, activeFirst })
{
   const ids = new Set(entries.map((e) => e.id));
   const childrenOf = new Map();
   const roots = [];
   for (const entry of entries)
   {
      const parent = questPage(entry).system.parentQuest;
      if (parent && ids.has(parent) && parent !== entry.id) { childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), entry]); }
      else { roots.push(entry); }
   }
   if (activeFirst)
   {
      const rank = (e) => STATUS_ORDER[questPage(e).system.status] ?? 9;
      for (const [id, children] of childrenOf) { childrenOf.set(id, children.map((e, i) => [e, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([e]) => e)); }
   }

   // Every descendant of a quest, once each (a broken loop in old data can't run forever).
   const descendants = (entry, seen = new Set([entry.id])) => (childrenOf.get(entry.id) ?? []).flatMap((child) =>
   {
      if (seen.has(child.id)) { return []; }
      seen.add(child.id);
      return [child, ...descendants(child, seen)];
   });

   const rows = [];
   const placed = new Set();
   const add = (entry, level, ancestors) =>
   {
      if (placed.has(entry.id)) { return; }
      placed.add(entry.id);
      const { status, inProgress } = questPage(entry).system;
      const below = descendants(entry);
      const done = below.filter((e) => FINISHED.has(questPage(e).system.status)).length;
      rows.push({
         id: entry.id,
         uuid: entry.uuid,
         name: entry.name,
         search: searchText(entry),
         status,
         inProgress,
         tracked: tracked.has(entry.id),
         depth: Math.min(depth + level, 8),
         level,
         chain: [...chain, ...ancestors].join(' '),
         parentId: ancestors.at(-1) ?? '',
         statusIcon: STATUSES[status].icon,
         statusLabel: game.i18n.localize(`FHQL.Status.${status}`),
         selected: entry.id === selectedId,
         unseen: entry.id !== selectedId && isUnseen(entry),
         family: below.length > 0,
         familyCount: below.length,
         familyDone: done,
         familyFinished: below.length > 0 && done === below.length,
         familyLabel: game.i18n.format('FHQL.Family.Summary', { done, count: below.length }),
         toggleLabel: game.i18n.format('FHQL.Family.Toggle', { name: entry.name }),
         familyUnseen: below.some((e) => e.id !== selectedId && isUnseen(e)),
         familyTracked: below.some((e) => tracked.has(e.id)),
         familyFocus: below.some((e) => questPage(e).system.inProgress)
      });
      for (const child of childrenOf.get(entry.id) ?? []) { add(child, level + 1, [...ancestors, entry.id]); }
   };
   for (const entry of roots) { add(entry, 0, []); }
   // Quests caught in a parent loop (old data) have no root above them: list them at the top level.
   for (const entry of entries) { add(entry, 0, []); }
   return rows;
}

/**
 * Which folders and quest families are folded for this player: those they folded, plus finished
 * families when "fold finished families" is on, unless they opened one.
 *
 * @param {HTMLElement} list - The rendered list.
 * @param {{ collapsed: string[], expanded: string[] }} filter - Saved list state.
 * @param {boolean} foldFinished - Whether finished families start folded.
 * @returns {Set<string>} Folded folder and quest IDs.
 */
export function foldedIds(list, filter, foldFinished)
{
   const folded = new Set(filter.collapsed);
   if (foldFinished)
   {
      for (const row of list.querySelectorAll('[data-row="quest"][data-family-finished]'))
      {
         if (!filter.expanded.includes(row.dataset.id)) { folded.add(row.dataset.id); }
      }
   }
   return folded;
}

/**
 * The folders and parent quests above a quest, nearest last.
 *
 * @param {JournalEntry} entry - A quest.
 * @param {(id: string) => JournalEntry|undefined} lookup - Finds a quest by ID.
 * @returns {{ folders: string[], quests: string[] }} Ancestor IDs.
 */
export function ancestorsOf(entry, lookup)
{
   const quests = [];
   const seen = new Set([entry.id]);
   let top = entry;
   for (let parent = lookup(questPage(top)?.system.parentQuest); parent && !seen.has(parent.id); parent = lookup(questPage(parent)?.system.parentQuest))
   {
      seen.add(parent.id);
      quests.unshift(parent.id);
      top = parent;
   }
   const folder = top.folder ?? entry.folder;
   const folders = folder ? [...folder.ancestors.map((f) => f.id).reverse(), folder.id] : [];
   return { folders, quests };
}
