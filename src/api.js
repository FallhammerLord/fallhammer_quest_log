import { QuestLog } from './apps/QuestLog.js';
import { QuestSheetApp } from './apps/QuestSheetApp.js';
import { debugInProgressWidget } from './ui/InProgressWidget.js';

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

/**
 * Opens a quest in its own window.
 *
 * @param {string} questId - JournalEntry ID.
 * @returns {QuestSheetApp|undefined} The window.
 */
export function openQuestSheet(questId)
{
   return QuestSheetApp.open(questId);
}

/** Public API, exposed as `game.modules.get('fhql').api`. Usable from macros. */
export const api = Object.freeze({ openQuestLog, openQuestSheet, debugWidget: debugInProgressWidget });
