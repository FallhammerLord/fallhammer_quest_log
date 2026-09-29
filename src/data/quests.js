import { DialogV2, deleteKeyUpdate } from '../compat.js';
import { MODULE_ID, OBJECTIVE_STATES, QUEST_TYPE, STATUSES } from '../constants.js';

const { NONE, LIMITED, OBSERVER } = CONST.DOCUMENT_OWNERSHIP_LEVELS;

/**
 * Quest storage. Each quest is a JournalEntry holding one `fhql.quest` page (docs/SCOPE.md 5.2).
 * The entry holds the name and ownership; the page holds everything else.
 */

/**
 * @param {JournalEntry} entry - A journal entry.
 * @returns {JournalEntryPage|undefined} Its quest page, if it is a quest.
 */
export function questPage(entry)
{
   return entry?.pages.find((page) => page.type === QUEST_TYPE);
}

/**
 * @param {string} id - JournalEntry ID.
 * @returns {JournalEntry|undefined} The quest entry, if it exists and is a quest.
 */
export function getQuestEntry(id)
{
   const entry = game.journal.get(id);
   return questPage(entry) ? entry : undefined;
}

/**
 * What a user may see and do with a quest. See the permission map in docs/SCOPE.md 5.6.
 * Hidden status removes player ownership (see setStatus), so Foundry itself enforces hiding.
 *
 * @param {JournalEntry} entry - The quest entry.
 * @param {User} [user] - Defaults to the current user.
 * @returns {{ visible: boolean, full: boolean, editable: boolean, gm: boolean }} Access flags.
 */
export function questAccess(entry, user = game.user)
{
   const gm = user.isGM;
   return {
      gm,
      visible: gm || entry.testUserPermission(user, LIMITED),
      full: gm || entry.testUserPermission(user, OBSERVER),
      editable: entry.canUserModify(user, 'update')
   };
}

/**
 * @param {User} [user] - Defaults to the current user.
 * @returns {JournalEntry[]} Quest entries the user can see, by status order then name.
 */
export function visibleQuests(user = game.user)
{
   const order = Object.keys(STATUSES);
   return game.journal
    .filter((entry) => questPage(entry) && questAccess(entry, user).visible)
    .sort((a, b) =>
    {
       const byStatus = order.indexOf(questPage(a).system.status) - order.indexOf(questPage(b).system.status);
       return byStatus || a.name.localeCompare(b.name);
    });
}

/** @returns {number} Ownership level players get when a quest is revealed. */
function revealedOwnership()
{
   return game.settings.get(MODULE_ID, 'defaultOwnership');
}

/* ---------- Folders ---------- */

/**
 * The root journal folder for quests ("FHQL Quests"), found by flag so renaming it is safe.
 * Quests and quest subfolders all live inside it.
 *
 * @returns {Folder|undefined} The root folder, if it exists.
 */
export function questRootFolder()
{
   return game.folders.find((folder) => folder.type === 'JournalEntry' && folder.getFlag(MODULE_ID, 'quests'));
}

/**
 * Finds or creates the root quest folder. GM only.
 *
 * @returns {Promise<Folder|undefined>} The root folder.
 */
async function questFolder()
{
   return questRootFolder() ?? Folder.implementation.create({
      name: game.i18n.localize('FHQL.Folder'),
      type: 'JournalEntry',
      sorting: 'a',
      flags: { [MODULE_ID]: { quests: true } }
   });
}

/** Renames the root folder from the early default "Quests" to "FHQL Quests". GM only, runs once on ready. */
export async function renameLegacyRootFolder()
{
   const root = questRootFolder();
   if (game.user.isGM && root?.name === 'Quests') { await root.update({ name: game.i18n.localize('FHQL.Folder') }); }
}

/**
 * @param {Folder} folder - A journal folder.
 * @returns {boolean} Whether it is the root quest folder or inside it.
 */
function inQuestTree(folder)
{
   const root = questRootFolder();
   if (!folder || !root) { return false; }
   return folder.id === root.id || folder.ancestors.some((ancestor) => ancestor.id === root.id);
}

/**
 * @returns {Folder[]} Every folder inside the root quest folder, excluding the root.
 */
export function questSubfolders()
{
   const root = questRootFolder();
   return root ? game.folders.filter((folder) => folder.type === 'JournalEntry' && folder.id !== root.id && inQuestTree(folder)) : [];
}

/**
 * Creates a folder inside the quest tree. GM only.
 *
 * @param {string} name - Folder name.
 * @param {string} [parentId] - Parent folder ID; defaults to the root quest folder.
 * @returns {Promise<Folder>} The new folder.
 */
export async function createQuestFolder(name, parentId)
{
   const root = await questFolder();
   const parent = parentId && inQuestTree(game.folders.get(parentId)) ? parentId : root.id;
   return Folder.implementation.create({ name: name.trim() || game.i18n.localize('FHQL.Folders.NewName'), type: 'JournalEntry', folder: parent });
}

/**
 * Moves a quest into a folder in the quest tree. Refuses folders outside it.
 *
 * @param {JournalEntry} entry - The quest entry.
 * @param {string} folderId - Target folder ID; '' or the root ID means the top level.
 */
export async function moveQuestToFolder(entry, folderId)
{
   const root = await questFolder();
   const target = folderId && inQuestTree(game.folders.get(folderId)) ? folderId : root.id;
   if (entry.folder?.id !== target) { await entry.update({ folder: target }); }
}

/**
 * Creates a quest. GM only in milestone 2; player creation arrives with player workflows.
 *
 * @param {object} [data] - Initial values.
 * @param {string} [data.name] - Quest name.
 * @param {object} [data.system] - Initial quest page system data.
 * @returns {Promise<JournalEntry>} The new quest entry.
 */
export async function createQuest({ name, system = {} } = {})
{
   name ||= game.i18n.localize('FHQL.Quest.NewName');
   const status = system.status ?? 'hidden';
   const folder = await questFolder();

   return JournalEntry.implementation.create({
      name,
      folder: folder?.id,
      ownership: { default: status === 'hidden' ? NONE : revealedOwnership() },
      pages: [{
         name,
         type: QUEST_TYPE,
         system: { ...system, status, dates: { created: Date.now(), ...system.dates } }
      }]
   });
}

/**
 * Updates one or more quest page fields.
 *
 * @param {JournalEntry} entry - The quest entry.
 * @param {object} changes - Update data for the page, e.g. `{ 'system.description': '...' }`.
 * @param {object} [options] - Update options passed to Foundry.
 * @returns {Promise<void>}
 */
export async function updateQuest(entry, changes, options = {})
{
   await questPage(entry)?.update(changes, options);
}

/**
 * Renames a quest. Entry and page names stay in sync so the journal sidebar matches.
 *
 * @param {JournalEntry} entry - The quest entry.
 * @param {string} name - New name.
 * @param {object} [options] - Update options passed to Foundry.
 */
export async function renameQuest(entry, name, options = {})
{
   name = name.trim();
   if (!name || name === entry.name) { return; }
   await entry.update({ name }, options);
   await questPage(entry)?.update({ name }, options);
}

/**
 * Sets status, stamps dates, and syncs ownership: hidden removes player access, revealing restores it.
 *
 * @param {JournalEntry} entry - The quest entry.
 * @param {string} status - A key of STATUSES.
 */
export async function setStatus(entry, status)
{
   const page = questPage(entry);
   if (!page || !(status in STATUSES) || page.system.status === status) { return; }

   const now = Date.now();
   const changes = { 'system.status': status };
   if (status === 'active') { Object.assign(changes, { 'system.dates.started': now, 'system.dates.ended': null }); }
   if (status === 'completed' || status === 'failed') { changes['system.dates.ended'] = now; }

   await page.update(changes);

   if (!game.user.isGM) { return; }
   const wasHidden = entry.ownership.default === NONE;
   if (status === 'hidden' && !wasHidden) { await entry.update({ 'ownership.default': NONE }); }
   else if (status !== 'hidden' && wasHidden) { await entry.update({ 'ownership.default': revealedOwnership() }); }
}

/**
 * Adds an objective at the end of the list.
 *
 * @param {JournalEntry} entry - The quest entry.
 * @param {string} [name] - Objective text.
 */
export async function addObjective(entry, name = '')
{
   const page = questPage(entry);
   const sorts = Object.values(page.system.objectives).map((o) => o.sort);
   const sort = (sorts.length ? Math.max(...sorts) : 0) + CONST.SORT_INTEGER_DENSITY;
   await page.update({ [`system.objectives.${foundry.utils.randomID()}`]: { name, sort } });
}

/**
 * Advances an objective open → done → failed → open.
 *
 * @param {JournalEntry} entry - The quest entry.
 * @param {string} id - Objective ID.
 */
export async function cycleObjective(entry, id)
{
   const objective = questPage(entry)?.system.objectives[id];
   if (!objective) { return; }
   const next = OBJECTIVE_STATES[(OBJECTIVE_STATES.indexOf(objective.state) + 1) % OBJECTIVE_STATES.length];
   await updateQuest(entry, { [`system.objectives.${id}.state`]: next });
}

/**
 * @param {JournalEntry} entry - The quest entry.
 * @param {string} id - Objective ID.
 */
export async function deleteObjective(entry, id)
{
   await updateQuest(entry, deleteKeyUpdate('system.objectives', id));
}

/**
 * Deletes a quest after confirmation. Subquests are kept and become top-level.
 *
 * @param {JournalEntry} entry - The quest entry.
 * @returns {Promise<boolean>} Whether it was deleted.
 */
export async function deleteQuest(entry)
{
   const confirmed = await DialogV2.confirm({
      window: { title: 'FHQL.Quest.DeleteTitle' },
      content: `<p>${game.i18n.format('FHQL.Quest.DeleteConfirm', { name: foundry.utils.escapeHTML(entry.name) })}</p>`
   });
   if (!confirmed) { return false; }

   for (const child of game.journal.filter((e) => questPage(e)?.system.parent === entry.id))
   {
      await updateQuest(child, { 'system.parent': '' });
   }
   await entry.delete();
   return true;
}

/* ---------- Quest giver ---------- */

/** Document types that can be a quest giver. */
const GIVER_TYPES = ['Actor', 'Item', 'JournalEntry', 'JournalEntryPage'];

/** Document types that can be a reward. */
const REWARD_DOC_TYPES = ['Item', 'Actor'];

/**
 * Sets the quest giver from a dropped document. Stores name and image so the giver still shows if the
 * document is later deleted or the viewer can't see it.
 *
 * @param {JournalEntry} entry - The quest entry.
 * @param {foundry.abstract.Document} doc - The dropped document.
 * @returns {Promise<boolean>} Whether it was accepted.
 */
export async function setGiverFromDocument(entry, doc)
{
   if (!GIVER_TYPES.includes(doc?.documentName)) { return false; }
   await updateQuest(entry, { 'system.giver': { uuid: doc.uuid, name: doc.name, img: doc.img ?? '' } });
   return true;
}

/** @param {JournalEntry} entry - The quest entry. */
export async function clearGiver(entry)
{
   await updateQuest(entry, { 'system.giver': { uuid: '', name: '', img: '' } });
}

/* ---------- Rewards ---------- */

/** @returns {number} A sort value after every existing entry. */
function nextSort(collection)
{
   const sorts = Object.values(collection).map((o) => o.sort ?? 0);
   return (sorts.length ? Math.max(...sorts) : 0) + CONST.SORT_INTEGER_DENSITY;
}

/**
 * Adds a dropped item or actor as a reward.
 *
 * @param {JournalEntry} entry - The quest entry.
 * @param {foundry.abstract.Document} doc - The dropped document.
 * @returns {Promise<boolean>} Whether it was accepted.
 */
export async function addRewardFromDocument(entry, doc)
{
   if (!REWARD_DOC_TYPES.includes(doc?.documentName)) { return false; }
   const rewards = questPage(entry).system.rewards;
   await updateQuest(entry, {
      [`system.rewards.${foundry.utils.randomID()}`]: {
         type: doc.documentName.toLowerCase(), uuid: doc.uuid, name: doc.name, img: doc.img ?? '', sort: nextSort(rewards)
      }
   });
   return true;
}

/** @param {JournalEntry} entry - The quest entry. */
export async function addTextReward(entry)
{
   const rewards = questPage(entry).system.rewards;
   await updateQuest(entry, { [`system.rewards.${foundry.utils.randomID()}`]: { type: 'text', name: '', sort: nextSort(rewards) } });
}

/**
 * @param {JournalEntry} entry - The quest entry.
 * @param {string} id - Reward ID.
 */
export async function deleteReward(entry, id)
{
   await updateQuest(entry, deleteKeyUpdate('system.rewards', id));
}

/* ---------- GM notes ---------- */

/**
 * GM notes live on their own text page with player ownership None, so they are never part of the quest
 * page's data (docs/SCOPE.md 5.6).
 *
 * @param {JournalEntry} entry - The quest entry.
 * @returns {JournalEntryPage|undefined} The GM notes page, if one exists.
 */
export function gmNotesPage(entry)
{
   return entry?.pages.find((page) => page.getFlag(MODULE_ID, 'gmNotes'));
}

/**
 * Saves GM notes, creating the GM-only page on first save. GM only.
 *
 * @param {JournalEntry} entry - The quest entry.
 * @param {string} html - Notes content.
 */
export async function setGmNotes(entry, html)
{
   if (!game.user.isGM) { return; }
   const page = gmNotesPage(entry);
   if (page) { return page.update({ 'text.content': html }); }

   await entry.createEmbeddedDocuments('JournalEntryPage', [{
      name: game.i18n.localize('FHQL.Quest.GMNotes'),
      type: 'text',
      text: { content: html, format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML },
      ownership: { default: NONE },
      flags: { [MODULE_ID]: { gmNotes: true } }
   }]);
}

/* ---------- Parent and subquests ---------- */

/**
 * @param {JournalEntry} entry - A quest entry.
 * @param {User} [user] - Defaults to the current user.
 * @returns {JournalEntry[]} Subquests the user can see.
 */
export function subquests(entry, user = game.user)
{
   return visibleQuests(user).filter((e) => questPage(e).system.parent === entry.id);
}

/**
 * @param {JournalEntry} entry - A quest entry.
 * @returns {Set<string>} IDs of every quest below this one.
 */
function descendantIds(entry)
{
   const ids = new Set();
   const walk = (id) =>
   {
      for (const e of game.journal)
      {
         if (questPage(e)?.system.parent === id && !ids.has(e.id)) { ids.add(e.id); walk(e.id); }
      }
   };
   walk(entry.id);
   return ids;
}

/**
 * @param {JournalEntry} entry - A quest entry.
 * @returns {JournalEntry[]} Quests that may become its parent: not itself, not below it.
 */
export function parentCandidates(entry)
{
   const blocked = descendantIds(entry).add(entry.id);
   return visibleQuests().filter((e) => !blocked.has(e.id));
}

/**
 * Sets or clears the parent quest. Refuses a parent that would create a loop.
 *
 * @param {JournalEntry} entry - The quest entry.
 * @param {string} parentId - Parent JournalEntry ID, or '' for none.
 */
export async function setParent(entry, parentId)
{
   if (parentId && !parentCandidates(entry).some((e) => e.id === parentId)) { return; }
   await updateQuest(entry, { 'system.parent': parentId ?? '' });
}

/**
 * Creates a subquest of the given quest. Like any new quest, it starts Hidden.
 *
 * @param {JournalEntry} parent - The parent quest entry.
 * @returns {Promise<JournalEntry>} The new quest.
 */
export async function createSubquest(parent)
{
   return createQuest({ system: { parent: parent.id, status: 'hidden' } });
}

/** Sample quests covering every status, for testing layout and themes. */
const SAMPLES = [
   {
      name: 'The Ember Road', status: 'active', giver: 'Warden Hask',
      description: 'Escort the salt caravan through the burned pass before the rains close it.',
      objectives: [['Meet the caravan at Cinderford', 'done'], ['Clear the rockfall at the switchbacks', 'open'],
       ['Deliver the salt to Highmere', 'open']]
   },
   {
      name: 'A Very Long Quest Name That Should Truncate Cleanly In Narrow Layouts', status: 'available',
      giver: 'Notice board', description: 'Checks truncation and wrapping.', objectives: []
   },
   {
      name: 'Signal From the Deep Array', status: 'completed', giver: 'Station AI',
      description: 'Trace the repeating signal to its source.',
      objectives: [['Triangulate the signal', 'done'], ['Report to command', 'done']]
   },
   {
      name: 'Hold the Bridge', status: 'failed', giver: 'Captain Oro',
      description: 'The bridge fell. The pass is closed until spring.',
      objectives: [['Keep the bridge standing until dawn', 'failed']]
   },
   {
      name: 'Whispers in the Archive', status: 'hidden', giver: 'Unknown',
      description: 'Not yet revealed to players.', objectives: []
   }
];

/** Creates the sample quests. GM only. */
export async function createSampleQuests()
{
   for (const sample of SAMPLES)
   {
      const objectives = Object.fromEntries(sample.objectives.map(([name, state], i) =>
         [foundry.utils.randomID(), { name, state, sort: (i + 1) * CONST.SORT_INTEGER_DENSITY }]));

      await createQuest({
         name: sample.name,
         system: {
            status: sample.status,
            giver: { name: sample.giver },
            description: sample.description,
            objectives
         }
      });
   }
}
