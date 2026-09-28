import { QuestLog } from './apps/QuestLog.js';

/**
 * Opens the Quest Log, or brings it to the front if already open.
 *
 * @param {string} [questId] - JournalEntry ID of a quest to select.
 * @returns {QuestLog|Promise<QuestLog>} The Quest Log.
 */
export function openQuestLog(questId)
{
   const log = QuestLog.instance;
   if (questId) { log.select(questId); }
   if (log.rendered)
   {
      if (questId) { log.render(); }
      log.bringToFront();
      return log;
   }
   return log.render({ force: true });
}

/** Public API, exposed as `game.modules.get('fhql').api`. Usable from macros. */
export const api = Object.freeze({ openQuestLog });
