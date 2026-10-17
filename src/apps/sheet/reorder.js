import { reorderQuestList } from '../../data/quests.js';

/**
 * Sheet feature: put objectives and rewards in order (edit mode). Drag a row by its handle, or focus
 * the handle and press the up or down arrow. Reorder drags stay apart from item drops: an item
 * dropped on an objective still becomes its requirement.
 */

/** The drag in progress: which window, list, and row. Drag data can't be read until the drop. */
let dragging = null;

/**
 * @param {DragEvent} event - A drag event over a quest sheet.
 * @returns {boolean} Whether it is one of our reorder drags.
 */
export function isReorderDrag(event)
{
   return !!dragging && event.dataTransfer?.types.includes('application/x-fhql-reorder');
}

/** @param {HTMLElement} handle - A reorder handle. @returns {HTMLElement[]} The rows of its list, in order. */
function rowsOf(handle)
{
   const row = handle.closest('[data-objective-id], [data-reward-id]');
   return row ? [...row.parentElement.children].filter((li) => li.querySelector('[data-reorder]')) : [];
}

/** @param {HTMLElement} row - An objective or reward row. @returns {string} Its ID. */
const rowId = (row) => row.dataset.objectiveId ?? row.dataset.rewardId;

/**
 * Saves a new order and tells screen readers where the row went.
 *
 * @param {object} app - The quest sheet.
 * @param {string} list - 'objectives' or 'rewards'.
 * @param {string[]} ids - The new order.
 * @param {string} movedId - The row that moved.
 */
async function saveOrder(app, list, ids, movedId)
{
   await reorderQuestList(app.questEntry, list, ids);
   app._announce(game.i18n.format('FHQL.Reorder.Moved', { position: ids.indexOf(movedId) + 1, count: ids.length }));
}

/** @param {HTMLElement} el - The sheet root. */
function clearMarks(el)
{
   el.querySelectorAll('.is-reorder-before, .is-reorder-after').forEach((row) => row.classList.remove('is-reorder-before', 'is-reorder-after'));
}

/**
 * Attaches the drag and key listeners. Call before the sheet's own drop listeners, so a reorder drag
 * never reaches them.
 *
 * @param {object} app - The quest sheet.
 * @param {HTMLElement} el - The sheet root.
 */
export function wireReorder(app, el)
{
   el.addEventListener('dragstart', (event) =>
   {
      const handle = event.target.closest?.('[data-reorder]');
      if (!handle) { return; }
      event.stopImmediatePropagation();
      const row = handle.closest('[data-objective-id], [data-reward-id]');
      dragging = { app, list: handle.dataset.reorder, id: rowId(row) };
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-fhql-reorder', dragging.id);
      event.dataTransfer.setDragImage(row, 16, row.offsetHeight / 2);
      row.classList.add('is-dragging');
   });

   el.addEventListener('dragover', (event) =>
   {
      if (!isReorderDrag(event)) { return; }
      event.stopImmediatePropagation();
      const row = event.target.closest?.('[data-objective-id], [data-reward-id]');
      const handle = row?.querySelector(`[data-reorder="${dragging.list}"]`);
      clearMarks(el);
      if (dragging.app !== app || !handle) { return; }
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      const box = row.getBoundingClientRect();
      row.classList.add(event.clientY < box.top + (box.height / 2) ? 'is-reorder-before' : 'is-reorder-after');
   });

   el.addEventListener('drop', async (event) =>
   {
      if (!isReorderDrag(event)) { return; }
      event.stopImmediatePropagation();
      event.preventDefault();
      const row = event.target.closest?.('[data-objective-id], [data-reward-id]');
      const before = row?.classList.contains('is-reorder-before');
      clearMarks(el);
      const { list, id } = dragging;
      dragging = null;
      const handle = row?.querySelector(`[data-reorder="${list}"]`);
      if (!handle || rowId(row) === id) { return; }
      const ids = rowsOf(handle).map(rowId).filter((other) => other !== id);
      ids.splice(ids.indexOf(rowId(row)) + (before ? 0 : 1), 0, id);
      await saveOrder(app, list, ids, id);
   });

   el.addEventListener('dragend', () =>
   {
      dragging = null;
      clearMarks(el);
      el.querySelectorAll('.is-dragging').forEach((row) => row.classList.remove('is-dragging'));
   });

   el.addEventListener('keydown', async (event) =>
   {
      const handle = event.target.closest?.('[data-reorder]');
      if (!handle || !['ArrowUp', 'ArrowDown'].includes(event.key)) { return; }
      event.preventDefault();
      const ids = rowsOf(handle).map(rowId);
      const id = rowId(handle.closest('[data-objective-id], [data-reward-id]'));
      const from = ids.indexOf(id);
      const to = from + (event.key === 'ArrowUp' ? -1 : 1);
      if (to < 0 || to >= ids.length) { return; }
      ids.splice(from, 1);
      ids.splice(to, 0, id);
      await saveOrder(app, handle.dataset.reorder, ids, id);
   });
}

/** Clicking a handle does nothing by itself; it is there to drag, or to focus for the arrow keys. */
export const reorderActions = { moveRow: () => {} };
