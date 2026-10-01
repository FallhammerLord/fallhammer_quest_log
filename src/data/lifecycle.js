import { activeGM } from '../compat.js';
import { MODULE_ID, QUEST_TYPE } from '../constants.js';
import { questPage, updateQuest } from './quests.js';

/**
 * Keeps quest data consistent when journal entries are created or deleted outside the Quest Log:
 * Foundry's Duplicate, compendium imports, and deleting from the journal sidebar.
 */
export function registerLifecycleHooks()
{
   // A copied quest (Duplicate, compendium import) starts fresh: no claims, deposits, or import link. Claims
   // name users and characters that the copy never gave anything to.
   Hooks.on('preCreateJournalEntry', (entry) =>
   {
      const pages = entry.pages.filter((page) => page.type === QUEST_TYPE);
      if (!pages.length) { return; }
      const hasCopiedState = pages.some((page) => page.system.source.fqlId
       || Object.values(page.system.rewards).some((r) => r.claims.length)
       || Object.values(page.system.objectives).some((o) => o.deposits?.length));
      if (!hasCopiedState) { return; }

      entry.updateSource({
         pages: entry.pages.map((page) =>
         {
            const data = page.toObject();
            if (page.type !== QUEST_TYPE) { return data; }
            data.system.source = { fqlId: '' };
            for (const reward of Object.values(data.system.rewards ?? {})) { reward.claims = []; }
            // Deposits hold items handed over in the original; a copy would let Undo return them twice.
            for (const objective of Object.values(data.system.objectives ?? {})) { objective.deposits = []; }
            return data;
         })
      });
   });

   Hooks.on('deleteJournalEntry', (entry) =>
   {
      if (!questPage(entry)) { return; }

      // Each client tidies its own user's tracking and Beacon choice.
      const tracked = game.user.getFlag(MODULE_ID, 'tracked') ?? [];
      if (tracked.includes(entry.id)) { game.user.setFlag(MODULE_ID, 'tracked', tracked.filter((id) => id !== entry.id)); }
      if (game.user.getFlag(MODULE_ID, 'beaconQuest') === entry.id) { game.user.unsetFlag(MODULE_ID, 'beaconQuest'); }

      // One GM client releases the deleted quest's subquests, as the Quest Log's delete does.
      if (!activeGM()?.isSelf) { return; }
      for (const child of game.journal.filter((e) => questPage(e)?.system.parentQuest === entry.id))
      {
         updateQuest(child, { 'system.parentQuest': '' });
      }
   });
}
