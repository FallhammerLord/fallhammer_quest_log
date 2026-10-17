import { getSetting, setSetting } from '../setting.js';

/**
 * The Quest Log's list pane can be widened: drag the line between the list and the quest, or focus
 * it and press the left or right arrow. Double-click resets. Each player's width is remembered.
 */

/** Narrowest and default list widths (px); the widest leaves the quest at least QUEST_MIN. */
const LIST_MIN = 200;
const LIST_DEFAULT = 250;
const QUEST_MIN = 320;

/** How far one arrow press moves the line (px). */
const KEY_STEP = 16;

/**
 * @param {HTMLElement} content - The window's content element.
 * @param {number} width - Wanted list width.
 * @returns {number} The width clamped to what the window allows.
 */
function clampWidth(content, width)
{
   const max = Math.max(LIST_MIN, content.clientWidth - QUEST_MIN);
   return Math.round(Math.min(Math.max(width, LIST_MIN), max));
}

/**
 * @param {HTMLElement} content - The window's content element.
 * @param {HTMLElement} handle - The divider.
 * @param {number} width - List width; 0 for the default.
 */
function setWidth(content, handle, width)
{
   const px = width ? clampWidth(content, width) : LIST_DEFAULT;
   content.style.setProperty('--fhql-list-width', `${px}px`);
   handle.setAttribute('aria-valuenow', String(px));
}

/**
 * Adds the divider to the Quest Log. Call once, after the first render.
 *
 * @param {object} app - The Quest Log.
 */
export function addListSplitter(app)
{
   const content = app.element?.querySelector('.window-content');
   if (!content || content.querySelector(':scope > .fhql-splitter')) { return; }
   const handle = document.createElement('div');
   handle.className = 'fhql-splitter';
   handle.tabIndex = 0;
   handle.setAttribute('role', 'separator');
   handle.setAttribute('aria-orientation', 'vertical');
   handle.setAttribute('aria-valuemin', String(LIST_MIN));
   handle.setAttribute('aria-label', game.i18n.localize('FHQL.ListResize.Label'));
   handle.dataset.tooltip = game.i18n.localize('FHQL.ListResize.Hint');
   content.append(handle);
   setWidth(content, handle, getSetting('listWidth'));

   const save = () => setSetting('listWidth', Number(handle.getAttribute('aria-valuenow')));
   handle.addEventListener('pointerdown', (event) =>
   {
      if (event.button !== 0) { return; }
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      const left = content.getBoundingClientRect().left;
      const move = (e) => setWidth(content, handle, e.clientX - left);
      const end = () =>
      {
         handle.removeEventListener('pointermove', move);
         handle.removeEventListener('pointerup', end);
         handle.removeEventListener('pointercancel', end);
         save();
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
   });
   handle.addEventListener('keydown', (event) =>
   {
      const step = { ArrowLeft: -KEY_STEP, ArrowRight: KEY_STEP }[event.key];
      if (!step) { return; }
      event.preventDefault();
      setWidth(content, handle, Number(handle.getAttribute('aria-valuenow')) + step);
      save();
   });
   handle.addEventListener('dblclick', () =>
   {
      setWidth(content, handle, 0);
      setSetting('listWidth', 0);
   });
}
