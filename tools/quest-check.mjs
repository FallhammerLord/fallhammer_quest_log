/**
 * Checks quest family rules in src/data/quests.js with Foundry mocked: a subquest is created in its
 * parent's folder, setting a parent moves the quest there, and moving a quest moves its subquests.
 * Usage: npm run quests
 */
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
   abstract: { TypeDataModel: class {} },
   data: { fields: {} },
   utils: { getProperty, setProperty, deepClone: structuredClone, randomID: () => Math.random().toString(36).slice(2, 10) }
};
globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 }, SORT_INTEGER_DENSITY: 100000 };
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
      getFlag: (scope, key) => (key === 'quests' ? quests : undefined)
   };
   folders.set(id, folder);
   return folder;
}

function makeEntry({ name, folder, pages })
{
   const id = `q${nextId++}`;
   const page = { type: QUEST_TYPE, system: structuredClone(pages[0].system) };
   page.system.parent ??= '';
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

globalThis.Folder = { implementation: { create: async (data) => makeFolder(`f${nextId++}`, data.name, null, true) } };
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
check(quests.questPage(child).system.parent === parent.id, 'a new subquest names its parent');
check(child.folder?.id === act1.id, "a new subquest is created in its parent's folder");
check(quests.subquests(parent).some((e) => e.id === child.id), "the subquest lists under its parent");

const loose = await quests.createQuest({ name: 'Loose' });
check(loose.folder?.id === root.id, 'a plain new quest goes to the top level');
await quests.setParent(loose, parent.id);
check(quests.questPage(loose).system.parent === parent.id, 'setting a parent records it');
check(loose.folder?.id === act1.id, "setting a parent moves the quest into the parent's folder");

const grandchild = await quests.createSubquest(child);
await quests.moveQuestToFolder(parent, act2.id);
check([parent, child, loose, grandchild].every((e) => e.folder?.id === act2.id), 'moving a quest moves all its subquests with it');

await quests.setParent(parent, grandchild.id);
check(quests.questPage(parent).system.parent === '', 'a parent below the quest is refused (no loops)');

if (failures) { console.log(`${failures} failed`); process.exit(1); }
console.log('Quest family rules hold.');
