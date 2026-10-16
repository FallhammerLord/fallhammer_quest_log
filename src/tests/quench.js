import { MODULE_ID, MODULE_PATH, PARTIALS, QUEST_TYPE } from '../constants.js';
import {
   createQuest, createQuestFolder, createSubquest, deleteQuest, moveQuestToFolder, questPage, setParent, subquests
} from '../data/quests.js';

/**
 * In-world tests for Quench (https://github.com/Ethaks/FVTT-Quench), run by a GM from the Quench
 * window. Unlike tools/*-check.mjs, these use real Foundry documents and data models, which is where
 * the `parent` name clash and the item-drop crash hid. Every quest and folder made here is deleted
 * afterwards. Nothing registers unless Quench is installed and active.
 *
 * @param {object} quench - The Quench API, from its `quenchReady` hook.
 */
export function registerQuenchTests(quench)
{
   quench.registerBatch(`${MODULE_ID}.core`, (context) =>
   {
      const { describe, it, assert, before, after } = context;
      const made = [];
      let folder = null;
      const track = (entry) => { made.push(entry); return entry; };

      describe('Fallhammer Quest Log', function ()
      {
         before(async function ()
         {
            if (!game.user.isGM) { this.skip(); }
            folder = await createQuestFolder('FHQL test (safe to delete)');
         });

         after(async function ()
         {
            for (const entry of made.reverse()) { if (game.journal.get(entry.id)) { await deleteQuest(entry); } }
            await folder?.delete();
         });

         it('stores a subquest link in the real data model (parentQuest, not parent)', async function ()
         {
            const parent = track(await createQuest({ name: 'FHQL test parent', folder: folder.id }));
            const child = track(await createSubquest(parent));
            assert.strictEqual(typeof questPage(child).system.parentQuest, 'string');
            assert.strictEqual(questPage(child).system.parentQuest, parent.id);
            assert.include(subquests(parent).map((e) => e.id), child.id);
         });

         it('creates a subquest in its parent\'s folder and moves families together', async function ()
         {
            const parent = track(await createQuest({ name: 'FHQL test mover', folder: folder.id }));
            const child = track(await createSubquest(parent));
            assert.strictEqual(child.folder?.id, folder.id);
            const other = await createQuestFolder('FHQL test (safe to delete) 2', folder.id);
            await moveQuestToFolder(parent, other.id);
            assert.strictEqual(game.journal.get(child.id).folder?.id, other.id);
            await moveQuestToFolder(parent, folder.id);
            await other.delete();
         });

         it('refuses a parent loop', async function ()
         {
            const a = track(await createQuest({ name: 'FHQL test A', folder: folder.id }));
            const b = track(await createSubquest(a));
            await setParent(a, b.id);
            assert.strictEqual(questPage(game.journal.get(a.id)).system.parentQuest, '');
         });

         it('treats a real Item or Actor as not a quest (drops stay safe)', function ()
         {
            const item = game.items.contents[0] ?? new CONFIG.Item.documentClass({ name: 'FHQL test item', type: Object.keys(CONFIG.Item.dataModels ?? {})[0] ?? 'item' });
            assert.isUndefined(questPage(item));
            const actor = game.actors.contents[0];
            if (actor) { assert.isUndefined(questPage(actor)); }
         });

         it('has every theme stylesheet loaded', function ()
         {
            const missing = game.modules.get(MODULE_ID).styles
               ? [...game.modules.get(MODULE_ID).styles].filter((path) => !document.querySelector(`link[href*="${path}"]`))
               : [];
            assert.deepEqual(missing, [], 'theme files missing (relaunch the world after an update)');
         });

         it('registers its bundled fonts with Foundry and the browser', async function ()
         {
            for (const family of ['IM Fell English SC', 'Josefin Sans', 'Oxanium', 'Limelight', 'Cinzel', 'Courier Prime'])
            {
               assert.property(CONFIG.fontDefinitions, family);
               await document.fonts.load(`16px "${family}"`);
               assert.isTrue(document.fonts.check(`16px "${family}"`), `${family} did not load`);
            }
         });

         it('serves its own assets', async function ()
         {
            const response = await fetch(`${MODULE_PATH}/styles/textures/wash-top.webp`, { method: 'HEAD' });
            assert.isTrue(response.ok);
         });

         it('registers its template pieces', function ()
         {
            for (const path of PARTIALS) { assert.property(Handlebars.partials, path); }
         });

         it('uses the quest page type', function ()
         {
            assert.property(CONFIG.JournalEntryPage.dataModels, QUEST_TYPE);
         });
      });
   }, { displayName: 'Fallhammer Quest Log: core' });
}
