import { activeGM } from '../compat.js';
import { MODULE_ID, QUEST_TYPE } from '../constants.js';
import { getSetting, setSetting } from '../setting.js';

/**
 * World data upgrades. The world remembers the last one applied (setting `dataVersion`); on ready, the
 * active GM's client runs any newer ones, in order, saving the version after each. A failure stops the
 * run and tells the GM; the next launch tries again from there. Add a step here whenever stored data
 * changes shape, and keep `QuestData.migrateData` for reading old data in the meantime.
 */
const MIGRATIONS = [
   {
      version: 1,
      name: 'Subquest links: parent → parentQuest',
      /** Stored `system.parent` (hidden by Foundry's own `parent`) becomes `system.parentQuest`. */
      async run()
      {
         let changed = 0;
         for (const entry of game.journal)
         {
            for (const page of entry.pages ?? [])
            {
               const source = page._source?.system;
               if (page.type !== QUEST_TYPE || typeof source?.parent !== 'string') { continue; }
               await page.update({ 'system.parentQuest': source.parentQuest || source.parent, 'system.-=parent': null });
               changed += 1;
            }
         }
         return changed;
      }
   }
];

/**
 * Runs pending migrations on the active GM's client. Called on ready.
 *
 * @returns {Promise<number>} The data version reached.
 */
export async function runMigrations()
{
   if (!activeGM()?.isSelf) { return getSetting('dataVersion'); }
   let version = getSetting('dataVersion');
   for (const step of MIGRATIONS.filter((m) => m.version > version).sort((a, b) => a.version - b.version))
   {
      try
      {
         const changed = await step.run();
         version = step.version;
         await setSetting('dataVersion', version);
         console.log(`${MODULE_ID} | Data upgrade ${step.version} (${step.name}): ${changed} changed.`);
      }
      catch (error)
      {
         console.error(`${MODULE_ID} | Data upgrade ${step.version} (${step.name}) failed`, error);
         ui.notifications.error(game.i18n.format('FHQL.Migration.Failed', { step: step.name }), { permanent: true });
         break;
      }
   }
   return version;
}
