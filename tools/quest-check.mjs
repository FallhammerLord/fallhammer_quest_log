/**
 * Checks quest family rules in src/data/quests.js with Foundry mocked (including `system.parent` being
 * the owning page, as on every Foundry data model): a subquest is created in its
 * parent's folder, setting a parent moves the quest there, and moving a quest moves its subquests.
 * Usage: npm run quests
 */
import './templates.mjs';
const QUEST_TYPE = 'fhql.quest';

class Collection extends Map
{
   [Symbol.iterator]() { return this.values(); }
   find(fn) { return [...this.values()].find(fn); }
   filter(fn) { return [...this.values()].filter(fn); }
}

const getProperty = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
const setProperty = (obj, path, value) =>
{
   const keys = path.split('.');
   const last = keys.pop();
   keys.reduce((o, k) => (o[k] ??= {}), obj)[last] = value;
};

globalThis.foundry = {
   applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: (B) => B, DialogV2: class {} },
      sheets: { journal: { JournalEntryPageHandlebarsSheet: class {} } }, apps: {}, ux: {} },
   abstract: { TypeDataModel: class { static migrateData(source) { return source; } } },
   data: { fields: {} },
   utils: { getProperty, setProperty, deepClone: structuredClone, randomID: () => Math.random().toString(36).slice(2, 10) }
};
globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 }, SORT_INTEGER_DENSITY: 100000, FOLDER_MAX_DEPTH: 4 };
globalThis.CONFIG = { queries: {} };
globalThis.Hooks = { on() {}, once() {} };

const folders = new Collection();
const journal = new Collection();
let nextId = 1;

function makeFolder(id, name, parent = null, quests = false)
{
   const folder = {
      id, name, type: 'JournalEntry', folder: parent,
      get ancestors() { const list = []; for (let f = this.folder; f; f = f.folder) { list.push(f); } return list; },
      getFlag: (scope, key) => (key === 'quests' ? quests : undefined),
      update: async (data) => { if ('folder' in data) { folder.folder = folders.get(data.folder) ?? null; } if (data.name) { folder.name = data.name; } },
      delete: async () => { folders.delete(id); }
   };
   folders.set(id, folder);
   return folder;
}

function makeEntry({ name, folder, pages })
{
   const id = `q${nextId++}`;
   const page = { type: QUEST_TYPE, system: structuredClone(pages[0].system) };
   page.system.parentQuest ??= '';
   // As in Foundry: every data model's `parent` is its owning document, so a field by that name is hidden.
   Object.defineProperty(page.system, 'parent', { value: page, writable: false, enumerable: false });
   page.update = async (changes) => { for (const [k, v] of Object.entries(changes)) { setProperty(page, k, v); } };
   const entry = {
      id, name, pages: [page],
      get folder() { return folders.get(this._folder) ?? null; },
      _folder: folder,
      testUserPermission: () => true,
      canUserModify: () => true
   };
   journal.set(id, entry);
   return entry;
}

globalThis.Folder = { implementation: {
   create: async (data) => makeFolder(`f${nextId++}`, data.name, folders.get(data.folder) ?? null, !data.folder),
   updateDocuments: async (list) => { for (const { _id, folder } of list) { folders.get(_id).folder = folders.get(folder) ?? null; } }
} };
globalThis.JournalEntry = {
   implementation: {
      create: async (data) => makeEntry(data),
      updateDocuments: async (list) => { for (const { _id, folder } of list) { journal.get(_id)._folder = folder; } }
   }
};
globalThis.game = {
   user: { id: 'gm', isGM: true },
   journal,
   folders,
   settings: { get: () => 2 },
   i18n: { localize: (key) => key }
};

const quests = await import('../src/data/quests.js');
const root = makeFolder('root', 'FHQL Quests', null, true);
const act1 = makeFolder('act1', 'Act One', root);
const act2 = makeFolder('act2', 'Act Two', root);

let failures = 0;
const check = (ok, label) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); if (!ok) { failures++; } };

const parent = await quests.createQuest({ name: 'Parent', folder: act1.id });
check(parent.folder?.id === act1.id, 'a quest can be created in a folder');

const child = await quests.createSubquest(parent);
check(quests.questPage(child).system.parentQuest === parent.id, 'a new subquest names its parent');
check(child.folder?.id === act1.id, "a new subquest is created in its parent's folder");
check(quests.subquests(parent).some((e) => e.id === child.id), "the subquest lists under its parent");

const loose = await quests.createQuest({ name: 'Loose' });
check(loose.folder?.id === root.id, 'a plain new quest goes to the top level');
await quests.setParent(loose, parent.id);
check(quests.questPage(loose).system.parentQuest === parent.id, 'setting a parent records it');
check(loose.folder?.id === act1.id, "setting a parent moves the quest into the parent's folder");

const grandchild = await quests.createSubquest(child);
await quests.moveQuestToFolder(parent, act2.id);
check([parent, child, loose, grandchild].every((e) => e.folder?.id === act2.id), 'moving a quest moves all its subquests with it');

await quests.setParent(parent, grandchild.id);
check(quests.questPage(parent).system.parentQuest === '', 'a parent below the quest is refused (no loops)');

// Renaming twice: Foundry writes into the options it is given (an embedded update records its parent).
// One options object shared across updates once made every second title save fail.
{
   const seen = [];
   const mutate = (doc, parent) => async (data, options = {}) =>
   {
      if (options.parent && options.parent !== parent) { throw new Error('JournalEntry is not a valid embedded Document within the JournalEntry Document'); }
      seen.push(options);
      options.parent = parent;
      Object.assign(doc, data);
   };
   const page = { type: QUEST_TYPE, system: {} };
   const entry = { id: 'rn', name: 'Old', pages: [page] };
   page.update = mutate(page, entry);
   entry.update = mutate(entry, null);
   const opts = { fhqlQuiet: true };
   let error = null;
   try
   {
      await quests.renameQuest(entry, 'First', opts);
      await quests.renameQuest(entry, 'Second', opts);
   }
   catch (err) { error = err; }
   check(!error && entry.name === 'Second' && page.name === 'Second', 'a quest can be renamed again (each update gets its own options)');
   check(!('parent' in opts) && new Set(seen).size === seen.length, 'renaming never hands Foundry the caller\'s options object, or one twice');
}

// Reordering: objectives take the new order; ids left out keep their place after it.
{
   const page = quests.questPage(parent);
   page.system.objectives = { a: { name: 'A', sort: 100 }, b: { name: 'B', sort: 200 }, c: { name: 'C', sort: 300 } };
   await quests.reorderQuestList(parent, 'objectives', ['c', 'a']);
   const order = Object.entries(page.system.objectives).sort((x, y) => x[1].sort - y[1].sort).map(([id]) => id).join('');
   check(order === 'cab', 'reordering objectives saves the new order');
   await quests.reorderQuestList(parent, 'nonsense', ['a']);
   check(!('nonsense' in page.system), 'only objectives and rewards can be reordered');
}

// Quest families in the list: a parent sums up its subquests; options sort and fold them.
{
   globalThis.game.user.getFlag = () => undefined;
   globalThis.game.i18n.format = (key, data) => `${key} ${JSON.stringify(data)}`;
   const { questRows, ancestorsOf } = await import('../src/apps/listTree.js');
   const fam = (name, status, parentQuest = '', more = {}) => ({
      id: name, uuid: `JournalEntry.${name}`, name, folder: act1,
      testUserPermission: () => true, canUserModify: () => false,
      pages: [{ type: QUEST_TYPE, system: { status, inProgress: false, parentQuest, giver: { name: '' }, objectiveList: [], ...more } }]
   });
   const top = fam('top', 'active');
   const kids = [fam('k1', 'completed', 'top'), fam('k2', 'active', 'top'), fam('k3', 'failed', 'top')];
   const grand = fam('g1', 'available', 'k2');
   const rows = questRows([top, ...kids, grand], { depth: 1, chain: ['act1'], selectedId: null, tracked: new Set(['g1']), activeFirst: false });
   const row = (id) => rows.find((r) => r.id === id);
   check(row('top').family && row('top').familyCount === 4 && row('top').familyDone === 2, 'a parent counts every subquest below it and how many are done');
   check(row('g1').chain === 'act1 top k2' && row('g1').parentId === 'k2', 'a subquest carries its folders and parent quests, nearest last');
   check(row('top').familyTracked && !row('k1').family, 'a tracked subquest shows on its parent; a quest with no subquests is no family');
   check(rows.map((r) => r.id).join() === 'top,k1,k2,g1,k3', 'by default subquests keep their order, each followed by its own');
   const sorted = questRows([top, ...kids, grand], { depth: 1, chain: [], selectedId: null, tracked: new Set(), activeFirst: true });
   check(sorted.map((r) => r.id).join() === 'top,k2,g1,k1,k3', 'active first puts active subquests before finished ones');
   const done = questRows([top, kids[0], kids[2]], { depth: 0, chain: [], selectedId: null, tracked: new Set(), activeFirst: false });
   check(done[0].familyFinished, 'a family whose subquests are all finished is marked finished');
   const loopA = fam('la', 'active', 'lb');
   const loopB = fam('lb', 'active', 'la');
   check(questRows([loopA, loopB], { depth: 0, chain: [], selectedId: null, tracked: new Set(), activeFirst: false }).length === 2, 'a parent loop in old data still lists each quest once');
   const { foldedIds } = await import('../src/apps/listTree.js');
   const fakeList = { querySelectorAll: () => [{ dataset: { id: 'done1' } }, { dataset: { id: 'done2' } }] };
   const filter = { collapsed: ['f9'], expanded: ['done2'] };
   check([...foldedIds(fakeList, filter, false)].join() === 'f9', 'only what the player folded is folded by default');
   check([...foldedIds(fakeList, filter, true)].sort().join() === 'done1,f9', 'with fold finished on, finished families fold unless opened by hand');
   // Search finds the giver and objectives; players never match a hidden objective.
   const searched = fam('Rescue', 'active', '', {
      giver: { name: 'Mayor Vell' }, objectiveList: [{ name: 'Find the mill' }, { name: 'Secret cellar', hidden: true }]
   });
   const searchFor = () => questRows([searched], { depth: 0, chain: [], selectedId: null, tracked: new Set(), activeFirst: false })[0].search;
   check(searchFor().includes('mayor vell') && searchFor().includes('find the mill'), 'search text holds the quest giver and objectives');
   check(searchFor().includes('secret cellar'), 'the GM can search hidden objectives');
   globalThis.game.user.isGM = false;
   check(!searchFor().includes('secret cellar') && searchFor().includes('find the mill'), 'players never match a hidden objective');
   searched.testUserPermission = (user, level) => level < globalThis.CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
   check(searchFor() === 'rescue', 'players with limited access match the name only');
   globalThis.game.user.isGM = true;
   const lookup = (id) => ({ top, k2: kids[1] })[id];
   const up = ancestorsOf(grand, lookup);
   check(up.quests.join() === 'top,k2' && up.folders.join() === 'root,act1', 'a quest\'s ancestors run from its top folder down to its parent');
}

// Nested folders: Foundry allows 4 levels counting FHQL Quests, so 3 below it.
{
   const deep = await quests.createQuestFolder('Chapter', act1.id);
   check(deep.folder?.id === act1.id, 'a subfolder is created inside its folder');
   check(quests.canHoldSubfolder(deep), 'a third level can still hold a subfolder');
   const deepest = await quests.createQuestFolder('Scene', deep.id);
   check(!quests.canHoldSubfolder(deepest), 'the fourth level holds no more subfolders');
   const targets = quests.folderMoveTargets(act1).map((f) => f.id);
   check(!targets.includes(act1.id) && !targets.includes(deep.id), 'a folder cannot move into itself or its own subfolders');
   check(!targets.includes(act2.id), 'a folder too tall to fit is refused (Act One holds two levels)');
   check(quests.folderMoveTargets(deepest).map((f) => f.id).includes(act2.id), 'a single folder can move into another');
   const stored = await quests.createQuest({ name: 'Stored', folder: deep.id });
   await quests.deleteQuestFolder(deep);
   check(!folders.has(deep.id), 'the folder is deleted');
   check(stored.folder?.id === act1.id && deepest.folder?.id === act1.id, 'its quests and subfolders move up a level, nothing lost');
   await quests.deleteQuestFolder(root);
   check(folders.has(root.id), 'FHQL Quests itself cannot be deleted');
}

// Data saved before the rename (stored as `parent`) is carried over on load.
const { QuestData } = await import('../src/data/QuestData.js');
{
   const migrated = QuestData.migrateData({ parent: 'abc' });
   check(migrated.parentQuest === 'abc', 'old saved parent links migrate to parentQuest');
}

// An item or actor dropped on a quest sheet is not a quest, and asking must not throw.
check(quests.questPage({ documentName: 'Item', name: 'Sealed salt cask' }) === undefined, 'questPage of an item is undefined, not an error');

// A double-click on a data-changing action runs it once; another row still runs; menus are not locked.
{
   globalThis.ui = { notifications: { error() {} } };
   const { guardActions } = await import('../src/apps/sheet/rows.js');
   const calls = [];
   const slow = (tag) => async function () { calls.push(tag); await new Promise((r) => { setTimeout(r, 30); }); };
   const actions = guardActions({ addObjective: slow('add'), cycleObjective: slow('cycle'), questMenu: slow('menu') });
   const app = {};
   const row = (id) => ({ closest: () => ({ dataset: { objectiveId: id } }), classList: { add() {}, remove() {} }, setAttribute() {}, removeAttribute() {} });
   const button = { closest: () => null, classList: { add() {}, remove() {} }, setAttribute() {}, removeAttribute() {} };
   await Promise.all([actions.addObjective.call(app, {}, button), actions.addObjective.call(app, {}, button)]);
   check(calls.filter((c) => c === 'add').length === 1, 'a double-click on Add objective adds one');
   await Promise.all([actions.cycleObjective.call(app, {}, row('a')), actions.cycleObjective.call(app, {}, row('b'))]);
   check(calls.filter((c) => c === 'cycle').length === 2, 'ticking two different objectives quickly runs both');
   await Promise.all([actions.questMenu.call(app, {}, button), actions.questMenu.call(app, {}, button)]);
   check(calls.filter((c) => c === 'menu').length === 2, 'menu buttons are not locked (a second click closes the menu)');
   await actions.addObjective.call(app, {}, button);
   check(calls.filter((c) => c === 'add').length === 2, 'the lock clears once the action finishes');
}

// Data upgrades: old 'parent' links move to 'parentQuest' once; a finished step never runs again;
// a failure keeps the old version so the next launch retries.
{
   const store = { dataVersion: 0 };
   const savedGame = { ...globalThis.game };
   const page = (system, fail = false) =>
   {
      const p = { type: QUEST_TYPE, _source: { system }, updates: [] };
      p.update = async (data) => { if (fail) { throw new Error('offline'); } p.updates.push(data); };
      return p;
   };
   const oldLink = page({ parent: 'abc', parentQuest: '' });
   const modern = page({ parentQuest: 'xyz' });
   Object.assign(globalThis.game, {
      journal: [{ pages: [oldLink] }, { pages: [modern] }],
      users: { activeGM: { isSelf: true } },
      settings: { get: (m, k) => store[k], set: async (m, k, v) => { store[k] = v; } },
      i18n: { localize: (k) => k, format: (k) => k }
   });
   globalThis.ui = { notifications: { error() {} } };
   const { runMigrations } = await import('../src/data/migrations.js');
   await runMigrations();
   check(oldLink.updates.length === 1 && oldLink.updates[0]['system.parentQuest'] === 'abc', 'an old parent link is moved to parentQuest');
   check(modern.updates.length === 0, 'quests without old links are left alone');
   check(store.dataVersion === 1, 'the world records the upgrade');
   await runMigrations();
   check(oldLink.updates.length === 1, 'a finished upgrade never runs again');
   store.dataVersion = 0;
   globalThis.game.journal = [{ pages: [page({ parent: 'abc' }, true)] }];
   await runMigrations();
   check(store.dataVersion === 0, 'a failed upgrade keeps the old version, to retry next launch');
   Object.assign(globalThis.game, savedGame);
}

if (failures) { console.log(`${failures} failed`); process.exit(1); }
console.log('Quest family rules hold.');
