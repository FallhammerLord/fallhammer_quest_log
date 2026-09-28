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

/**
 * Diagnostic for the rich text editors. Open an editor, click into it, then run
 * `game.modules.get('fhql').api.debugEditor()` in the console.
 *
 * @returns {object[]} One row per editor on screen.
 */
export function debugEditor()
{
   const rows = [...document.querySelectorAll('.fhql-app prose-mirror')].map((el) =>
   {
      const content = el.querySelector('[contenteditable]');
      const size = (node) => (node ? `${Math.round(node.getBoundingClientRect().width)}x${Math.round(node.getBoundingClientRect().height)}` : null);
      return {
         field: el.getAttribute('name'),
         open: el.open ?? el.hasAttribute('open'),
         editorSize: size(el),
         editableFound: !!content,
         editableAttr: content?.getAttribute('contenteditable') ?? null,
         editableSize: size(content),
         userSelect: content ? getComputedStyle(content).userSelect : null,
         focusedInside: el.contains(document.activeElement),
         activeElement: document.activeElement ? `${document.activeElement.tagName.toLowerCase()}.${[...document.activeElement.classList].join('.')}` : null
      };
   });
   console.table(rows);
   return rows;
}

/** Public API, exposed as `game.modules.get('fhql').api`. Usable from macros. */
export const api = Object.freeze({ openQuestLog, openQuestSheet, debugWidget: debugInProgressWidget, debugEditor });
