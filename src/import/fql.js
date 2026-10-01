import { readStoredWorldSetting } from '../compat.js';
import { MODULE_ID, QUEST_TYPE } from '../constants.js';
import { createQuestFolder, hideOwnershipUpdate, questPage, questRootFolder, questSubfolders, setGmNotes } from '../data/quests.js';

/**
 * Import from Forien's Quest Log. See docs/SCOPE.md section 8.
 *
 * FQL stores each quest as a JournalEntry with its data in `flags['forien-quest-log'].json`. Import adds
 * our quest page to that same entry, so entry IDs, and every link to them, stay the same. FQL's flag is
 * never modified.
 */

const FQL_ID = 'forien-quest-log';
const STATUS_MAP = { inactive: 'hidden', available: 'available', active: 'active', completed: 'completed', failed: 'failed' };
const IMPORT_FOLDER_FLAG = 'fqlImport';

/**
 * @param {JournalEntry} entry - A journal entry.
 * @returns {object|null} FQL's quest data, read directly so it works with FQL disabled.
 */
function fqlData(entry)
{
   const json = entry.flags?.[FQL_ID]?.json;
   return json && typeof json === 'object' ? json : null;
}

/**
 * Finds every FQL quest in the world.
 *
 * @returns {{ entry: JournalEntry, fql: object, imported: boolean }[]} FQL quests, by name.
 */
export function scanFqlQuests()
{
   return game.journal
    .map((entry) => ({ entry, fql: fqlData(entry) }))
    .filter(({ fql }) => fql)
    .map(({ entry, fql }) => ({ entry, fql, imported: questPage(entry)?.system.source.fqlId === entry.id }))
    .sort((a, b) => a.entry.name.localeCompare(b.entry.name));
}

/**
 * Works out each quest's parent, fixing FQL's two-sided parent/subquest records. The child's own
 * `parent` is the truth; a parent's `subquests` list only fills in children with no parent.
 *
 * @param {{ entry: JournalEntry, fql: object }[]} quests - Every FQL quest in the world.
 * @param {object[]} report - Fix messages are appended here.
 * @returns {Map<string, string>} Parent ID by quest ID ('' for none).
 */
function reconcileParents(quests, report)
{
   const byId = new Map(quests.map((q) => [q.entry.id, q]));
   const parents = new Map();
   const note = (q, key, data = {}) => report.push({ quest: q.entry.name, message: game.i18n.format(`FHQL.Import.Fix.${key}`, data) });

   for (const q of quests)
   {
      const parent = q.fql.parent ?? '';
      if (parent && !byId.has(parent)) { note(q, 'MissingParent'); parents.set(q.entry.id, ''); }
      else { parents.set(q.entry.id, parent); }
   }

   for (const q of quests)
   {
      for (const childId of q.fql.subquests ?? [])
      {
         const child = byId.get(childId);
         if (!child) { note(q, 'MissingSubquest'); continue; }
         const current = parents.get(childId);
         if (!current)
         {
            parents.set(childId, q.entry.id);
            note(child, 'AdoptedParent', { parent: q.entry.name });
         }
         else if (current !== q.entry.id)
         {
            note(child, 'ConflictingParent', { kept: byId.get(current)?.entry.name ?? '?', other: q.entry.name });
         }
      }
   }

   // Break any loop: walk up from each quest; if it returns to itself, clear its parent.
   for (const q of quests)
   {
      const seen = new Set([q.entry.id]);
      let cursor = parents.get(q.entry.id);
      while (cursor)
      {
         if (seen.has(cursor))
         {
            parents.set(q.entry.id, '');
            note(q, 'ParentLoop');
            break;
         }
         seen.add(cursor);
         cursor = parents.get(cursor);
      }
   }
   return parents;
}

/**
 * Converts FQL quest data to our quest page system data.
 *
 * @param {JournalEntry} entry - The FQL quest's entry.
 * @param {object} fql - FQL's data.
 * @param {string} parent - Reconciled parent ID.
 * @param {boolean} primary - Whether FQL marked it the primary quest.
 * @param {object[]} report - Notes are appended here.
 * @returns {object} System data.
 */
function convert(entry, fql, parent, primary, report)
{
   const note = (key, data = {}) => report.push({ quest: entry.name, message: game.i18n.format(`FHQL.Import.Fix.${key}`, data) });
   const density = CONST.SORT_INTEGER_DENSITY;

   const status = STATUS_MAP[fql.status];
   if (!status) { note('UnknownStatus', { status: String(fql.status) }); }

   const objectives = {};
   (fql.tasks ?? []).forEach((task, i) =>
   {
      objectives[foundry.utils.randomID()] = {
         name: String(task.name ?? ''),
         state: task.completed ? 'done' : task.failed ? 'failed' : 'open',
         hidden: !!task.hidden,
         sort: (i + 1) * density
      };
   });

   const rewards = {};
   (fql.rewards ?? []).forEach((reward, i) =>
   {
      const type = String(reward.type ?? '').toLowerCase();
      const data = reward.data ?? {};
      const linked = (type === 'item' || type === 'actor') && data.uuid;
      rewards[foundry.utils.randomID()] = {
         type: linked ? type : 'text',
         uuid: linked ? data.uuid : '',
         name: String(data.name ?? ''),
         img: data.img ?? '',
         hidden: !!reward.hidden,
         locked: reward.locked !== false,
         sort: (i + 1) * density
      };
   });

   const giverData = fql.giverData ?? {};
   const giverLinked = fql.giver && fql.giver !== 'abstract';

   const unmapped = ['location', 'priority', 'type'].filter((key) => fql[key] !== null && fql[key] !== undefined && fql[key] !== '' && fql[key] !== 0);
   if (unmapped.length) { note('Unmapped', { fields: unmapped.map((k) => `${k}: ${fql[k]}`).join(', ') }); }
   if (fql.name && fql.name !== entry.name) { note('NameDiffers', { name: fql.name }); }

   return {
      status: status ?? 'hidden',
      inProgress: primary,
      image: fql.splash ?? '',
      giver: { uuid: giverLinked ? fql.giver : '', name: giverData.name ?? '', img: giverData.img ?? '' },
      description: fql.description ?? '',
      playerNotes: fql.playernotes ?? '',
      objectives,
      rewards,
      parent,
      dates: {
         created: typeof fql.date?.create === 'number' ? fql.date.create : null,
         started: typeof fql.date?.start === 'number' ? fql.date.start : null,
         ended: typeof fql.date?.end === 'number' ? fql.date.end : null
      },
      source: { fqlId: entry.id }
   };
}

/** @returns {Promise<Folder>} The "Imported from FQL" folder inside FHQL Quests. */
async function importFolder()
{
   const existing = questSubfolders().find((folder) => folder.getFlag(MODULE_ID, IMPORT_FOLDER_FLAG));
   if (existing) { return existing; }
   const folder = await createQuestFolder(game.i18n.localize('FHQL.Import.FolderName'), questRootFolder()?.id);
   await folder.setFlag(MODULE_ID, IMPORT_FOLDER_FLAG, true);
   return folder;
}

/**
 * Imports FQL quests. GM only.
 *
 * @param {object} options - Import options.
 * @param {string[]} options.overwrite - IDs of already-imported quests to re-import, replacing edits.
 * @param {boolean} options.moveToFolder - Move imported quests into FHQL Quests / Imported from FQL.
 * @returns {Promise<{ imported: number, reimported: number, skipped: number, fixes: object[], errors: object[] }>} Report.
 */
export async function importFqlQuests({ overwrite = [], moveToFolder = true } = {})
{
   const result = { imported: 0, reimported: 0, skipped: 0, fixes: [], errors: [] };
   if (!game.user.isGM) { return result; }

   const quests = scanFqlQuests();
   const parents = reconcileParents(quests, result.fixes);
   const primaryId = readStoredWorldSetting(`${FQL_ID}.primaryQuest`);
   const folder = moveToFolder ? await importFolder() : null;
   const { NONE } = CONST.DOCUMENT_OWNERSHIP_LEVELS;

   for (const { entry, fql, imported } of quests)
   {
      const reimport = imported && overwrite.includes(entry.id);
      if (imported && !reimport) { result.skipped++; continue; }

      try
      {
         const system = convert(entry, fql, parents.get(entry.id) ?? '', entry.id === primaryId, result.fixes);

         const existing = questPage(entry);
         if (existing && !reimport)
         {
            // A quest page not made by this importer: never replace it.
            result.skipped++;
            result.fixes.push({ quest: entry.name, message: game.i18n.localize('FHQL.Import.Fix.HasQuestPage') });
            continue;
         }
         if (existing) { await existing.delete(); }

         const firstSort = Math.min(0, ...entry.pages.map((p) => p.sort)) - CONST.SORT_INTEGER_DENSITY;
         await entry.createEmbeddedDocuments('JournalEntryPage', [{ name: entry.name, type: QUEST_TYPE, sort: firstSort, system }]);

         if (fql.gmnotes) { await setGmNotes(entry, fql.gmnotes); }

         const update = {};
         if (folder && entry.folder?.id !== folder.id) { update.folder = folder.id; }
         const playerAccess = Object.entries(entry.ownership)
          .some(([id, level]) => level > NONE && (id === 'default' || !game.users.get(id)?.isGM));
         if (system.status === 'hidden' && playerAccess)
         {
            Object.assign(update, hideOwnershipUpdate(entry));
            result.fixes.push({ quest: entry.name, message: game.i18n.localize('FHQL.Import.Fix.HiddenAccess') });
         }
         if (Object.keys(update).length) { await entry.update(update); }

         if (reimport) { result.reimported++; }
         else { result.imported++; }
      }
      catch (err)
      {
         console.error(`${MODULE_ID} | Import failed for ${entry.name}`, err);
         result.errors.push({ quest: entry.name, message: err.message });
      }
   }
   return result;
}
