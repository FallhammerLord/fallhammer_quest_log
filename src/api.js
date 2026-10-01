import { QuestLog } from './apps/QuestLog.js';
import { QuestSheetApp } from './apps/QuestSheetApp.js';
import { FqlImportApp } from './apps/FqlImportApp.js';
import { debugQuestBeacon } from './ui/QuestBeacon.js';
import { questLogAvailable } from './data/playerActions.js';
import { systemSupportSummary } from './data/systemItems.js';

/**
 * Opens the Quest Log, or brings it to the front if already open.
 *
 * @param {string} [questId] - JournalEntry ID of a quest to select.
 * @returns {QuestLog|Promise<QuestLog>} The Quest Log.
 */
export function openQuestLog(questId, { from = null } = {})
{
   if (!questLogAvailable()) { return undefined; }
   const log = QuestLog.instance;
   log._motionFrom = from;
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
/**
 * The Beacon's toggle: opens the Quest Log (growing from the Beacon), brings a minimized log back, or,
 * when the log is open, closes it and every quest window with it.
 *
 * @param {string} [questId] - Quest to show when opening.
 * @param {HTMLElement} [from] - The Beacon, so the log grows from it.
 * @returns {Promise<unknown>|unknown} The log, or the closing.
 */
export function toggleQuestLog(questId, from = null)
{
   const log = QuestLog.instance;
   if (log.rendered && log.minimized) { log.bringToFront(); return log.maximize(); }
   if (log.rendered) { return Promise.all([log.close(), QuestSheetApp.closeAll()]); }
   return openQuestLog(questId, { from });
}

/**
 * Focuses the Quest Log's search box, if the log is open and showing.
 *
 * @returns {boolean} Whether it did (so the key is used up), else false to let the key pass.
 */
export function focusQuestSearch()
{
   const log = QuestLog.instance;
   const box = log.rendered && !log.minimized ? log.element?.querySelector('[data-list-search]') : null;
   if (!box) { return false; }
   log.bringToFront();
   box.focus();
   box.select();
   return true;
}

export function openQuestSheet(questId)
{
   if (!questLogAvailable()) { return undefined; }
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

/**
 * Opens the Forien's Quest Log import window. GM only.
 *
 * @returns {FqlImportApp|undefined} The window.
 */
export function openFqlImport()
{
   if (!game.user.isGM) { return undefined; }
   const app = new FqlImportApp();
   app.render({ force: true });
   return app;
}

/** Public API, exposed as `game.modules.get('fhql').api`. Usable from macros. */
export const api = Object.freeze({
   openQuestLog, openQuestSheet, openFqlImport, debugBeacon: debugQuestBeacon, debugEditor,
   /** Which game system the Quest Log detected, and where it reads item quantity. */
   systemSupport: systemSupportSummary
});
