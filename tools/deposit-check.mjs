/**
 * Checks the deposit rules in src/data/deposits.js with Foundry mocked: two players racing for the
 * last slots never lose items, a full objective takes nothing, a failed take rolls back, and Undo
 * returns items. Document updates resolve after a delay, as they do over the network.
 * Usage: npm run deposits
 */
const tick = () => new Promise((resolve) => { setTimeout(resolve, 5); });
const getProperty = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
const setProperty = (obj, path, value) =>
{
   const keys = path.split('.');
   const last = keys.pop();
   const target = keys.reduce((o, k) => (o[k] ??= {}), obj);
   target[last] = value;
};
const deepClone = (value) => structuredClone(value);

globalThis.foundry = {
   applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: (B) => B, DialogV2: class {} },
      sheets: { journal: { JournalEntryPageHandlebarsSheet: class {} } }, apps: {}, ux: {} },
   abstract: { TypeDataModel: class {} },
   data: { fields: {} },
   utils: { getProperty, setProperty, deepClone, escapeHTML: String, randomID: () => Math.random().toString(36).slice(2) }
};
globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 }, SORT_INTEGER_DENSITY: 100000 };
globalThis.CONFIG = { queries: {} };
globalThis.Hooks = { on() {}, once() {} };
globalThis.ChatMessage = { implementation: { create: async () => {} } };
globalThis.ui = { notifications: { info() {}, warn() {} } };

const registry = new Map();
globalThis.fromUuid = async (uuid) => registry.get(uuid) ?? null;

const users = [
   { id: 'gm', name: 'GM', isGM: true },
   { id: 'p1', name: 'Rinn', isGM: false },
   { id: 'p2', name: 'Corvus', isGM: false }
];
users.forEach((u) => { u.character = null; });

/** Like Foundry's Collection: a Map that iterates its values. */
class Collection extends Map
{
   [Symbol.iterator]() { return this.values(); }
}

function makeActor(id, ownerId)
{
   const items = new Collection();
   const actor = {
      documentName: 'Actor', id, uuid: `Actor.${id}`, name: id, pack: null, items,
      testUserPermission: (user) => user.isGM || user.id === ownerId,
      createEmbeddedDocuments: async (type, list) =>
      {
         await tick();
         return list.map((data) => makeItem(actor, `new${items.size}`, data.name, getProperty(data, 'system.quantity')));
      }
   };
   registry.set(actor.uuid, actor);
   return actor;
}

function makeItem(actor, id, name, quantity, { failUpdate = false, cypher = false } = {})
{
   // Cypher System keeps quantity at system.basic.quantity; most systems at system.quantity.
   const system = cypher ? { basic: { quantity } } : { quantity };
   const item = {
      documentName: 'Item', id, uuid: `${actor.uuid}.Item.${id}`, name, parent: actor, _stats: {}, flags: {},
      system,
      toObject: () => ({ _id: id, name, system: structuredClone(item.system) }),
      update: async (changes) =>
      {
         await tick();
         if (failUpdate) { throw new Error('update refused'); }
         for (const [k, v] of Object.entries(changes)) { setProperty(item, k, v); }
      },
      delete: async () => { await tick(); actor.items.delete(id); registry.delete(item.uuid); }
   };
   actor.items.set(id, item);
   registry.set(item.uuid, item);
   return item;
}

function makeQuest(requirement)
{
   const page = {
      type: 'fhql.quest',
      system: { status: 'active', objectives: { o1: { name: 'Bring pelts', state: 'open', hidden: false, requirement, deposits: [] } } },
      update: async (changes) =>
      {
         await tick();
         for (const [k, v] of Object.entries(changes)) { setProperty(page, k, deepClone(v)); }
      }
   };
   const entry = { id: 'q1', name: 'Pelts', pages: [page], testUserPermission: () => true, canUserModify: () => false };
   return { entry, page, objective: () => page.system.objectives.o1 };
}

let quest;
globalThis.game = {
   user: users[0],
   users: Object.assign(users, { get: (id) => users.find((u) => u.id === id), activeGM: users[0] }),
   journal: { get: (id) => (id === quest.entry.id ? quest.entry : undefined) },
   i18n: { localize: (k) => k, format: (k, v) => `${k} ${JSON.stringify(v)}` },
   actors: []
};

const { registerDepositQueries, requestDeposit, undoDeposit, depositCandidates, defaultDepositChoice } = await import(new URL('../src/data/deposits.js', import.meta.url));
registerDepositQueries();
const deposit = (userId, item) => globalThis.CONFIG.queries['fhql.deposit']({ entryId: 'q1', objectiveId: 'o1', itemUuid: item.uuid, userId });

let failures = 0;
const expect = (label, ok) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); if (!ok) { failures++; } };
const pelt = { uuid: 'Item.pelt', name: 'Wolf pelt', img: '', count: 3, mode: 'give' };

// Two players race for the last three slots.
quest = makeQuest({ ...pelt });
const a1 = makeActor('kestrel', 'p1');
const a2 = makeActor('corvus', 'p2');
const s1 = makeItem(a1, 'i1', 'Wolf pelt', 2);
const s2 = makeItem(a2, 'i2', 'Wolf pelt', 5);
const [r1, r2] = await Promise.all([deposit('p1', s1), deposit('p2', s2)]);
expect('both racing deposits succeed', r1.ok && r2.ok);
expect('first player hands over the whole stack of 2', !a1.items.has('i1'));
expect('second player gives only the 1 still needed and keeps 4', s2.system.quantity === 4);
expect('objective totals exactly 3', quest.objective().deposits.reduce((s, d) => s + d.qty, 0) === 3);
expect('objective marked done', quest.objective().state === 'done');

// A full objective takes nothing.
const r3 = await deposit('p2', s2);
expect('deposit to a full objective is refused', !r3.ok && r3.message.includes('Full'));
expect('refused deposit leaves the stack alone', s2.system.quantity === 4);

// Undo returns the item onto the stack it came from, and reopens the objective.
await undoDeposit(quest.entry, 'o1', 1, { returnItem: true });
expect('undo returns 1 pelt onto the remaining stack', s2.system.quantity === 5);
expect('undo reopens the objective', quest.objective().state === 'open');

// Undo of a fully handed-over stack recreates the item.
await undoDeposit(quest.entry, 'o1', 0, { returnItem: true });
expect('undo recreates a stack that was handed over whole', [...a1.items.values()].some((i) => i.system.quantity === 2));

// A failed take rolls the record back.
quest = makeQuest({ ...pelt });
const a3 = makeActor('brannoc', 'p1');
const s3 = makeItem(a3, 'i3', 'Wolf pelt', 5, { failUpdate: true });
// The rollback logs an error on purpose; keep it out of the check output.
const logError = console.error;
console.error = () => {};
const r4 = await deposit('p1', s3);
console.error = logError;
expect('deposit fails when the item cannot be taken', !r4.ok);
expect('failed deposit leaves no record', quest.objective().deposits.length === 0 && quest.objective().state === 'open');
expect('failed deposit leaves the stack alone', s3.system.quantity === 5);

// Requests naming a GM, or someone else's character, are refused.
const r5 = await deposit('gm', s2);
expect('a player request naming a GM is refused', !r5.ok);
const r6 = await deposit('p1', s2);
expect("depositing another player's item is refused", !r6.ok);

// The wrong item is refused.
const s4 = makeItem(a1, 'i4', 'Rabbit pelt', 1);
const r7 = await deposit('p1', s4);
expect('the wrong item is refused', !r7.ok && a1.items.has('i4'));

// Show-only keeps the item, and the same item can't be shown twice.
quest = makeQuest({ uuid: 'Item.ring', name: 'Signet ring', img: '', count: 2, mode: 'show' });
const ring = makeItem(a1, 'i5', 'Signet ring', null);
const r8 = await deposit('p1', ring);
const r9 = await deposit('p1', ring);
expect('showing keeps the item', r8.ok && a1.items.has('i5'));
expect('the same item cannot be shown twice', !r9.ok && quest.objective().deposits.length === 1);

// Completed quests take no deposits.
quest = makeQuest({ ...pelt });
quest.page.system.status = 'completed';
const r10 = await deposit('p2', s2);
expect('a completed quest refuses deposits', !r10.ok && s2.system.quantity === 5);

// Cypher System quantity: a stack of 5 against 3 needed hands over 3 and keeps 2.
quest = makeQuest({ uuid: 'Item.cache', name: 'Resource Cache', img: '', count: 3, mode: 'give' });
const a5 = makeActor('tiberius', 'p2');
const cache = makeItem(a5, 'i6', 'Resource Cache', 5, { cypher: true });
const r11 = await deposit('p2', cache);
expect('Cypher quantity: hands over only the 3 needed', r11.ok && cache.system.basic.quantity === 2);
expect('Cypher quantity: the record holds 3', quest.objective().deposits[0]?.qty === 3);

// The GM can hand over from an actor no player owns; it's recorded under the GM.
quest = makeQuest({ uuid: 'Item.cache', name: 'Resource Cache', img: '', count: 2, mode: 'give' });
const npc = makeActor('npc', 'nobody');
const npcCache = makeItem(npc, 'i7', 'Resource Cache', 4, { cypher: true });
const ok12 = await requestDeposit(quest.entry, 'o1', { itemUuid: npcCache.uuid, userId: 'gm' });
expect('GM hands over from an unowned actor', ok12 && npcCache.system.basic.quantity === 2);

// A player's one-click source: their assigned character, else the only actor carrying it.
quest = makeQuest({ uuid: 'Item.cache', name: 'Resource Cache', img: '', count: 9, mode: 'give' });
const pc = makeActor('kestrel2', 'p1');
const party = makeActor('party', 'p1');
makeItem(pc, 'i8', 'Resource Cache', 1);
makeItem(party, 'i9', 'Resource Cache', 6);
users[1].character = pc;
globalThis.game.user = users[1];
globalThis.game.actors = [pc, party];
const choices = depositCandidates(quest.objective(), false);
expect('player sees both their character and the party actor', choices.length === 2);
expect('one click takes from the assigned character', defaultDepositChoice(choices)?.actorId === 'kestrel2');
users[1].character = null;
const unassigned = depositCandidates(quest.objective(), false);
expect('with no assigned character and two sources, the player chooses', defaultDepositChoice(unassigned) === null);
globalThis.game.user = users[0];

process.exit(failures ? 1 : 0);
