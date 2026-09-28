import { QuestLog } from './apps/QuestLog.js';

/** Opens the Quest Log, or brings it to the front if already open. */
export function openQuestLog()
{
   const log = QuestLog.instance;
   if (log.rendered)
   {
      log.bringToFront();
      return log;
   }
   return log.render({ force: true });
}

/** Public API, exposed as `game.modules.get('fhql').api`. Usable from macros. */
export const api = Object.freeze({ openQuestLog });
