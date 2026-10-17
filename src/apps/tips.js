import { renderTemplateNow, windowHeader } from '../compat.js';
import { TEMPLATES } from '../constants.js';
import { openPanel } from '../ui/popover.js';

/**
 * The Quest Log's tips: a ? in its title bar opens a short panel of the things that are easy to miss
 * (right-click menus, Alt-click, drag and drop, shortcuts). GM-only tips show to GMs only.
 */

/** Each tip: an icon, a key under FHQL.Tips, and whether only GMs see it. */
const TIPS = [
   { icon: 'fa-solid fa-star', key: 'Primary' },
   { icon: 'fa-solid fa-ellipsis-vertical', key: 'Families' },
   { icon: 'fa-solid fa-magnifying-glass', key: 'Search' },
   { icon: 'fa-solid fa-keyboard', key: 'Keys' },
   { icon: 'fa-solid fa-hand-holding-hand', key: 'HandOver' },
   { icon: 'fa-solid fa-left-right', key: 'Widen' },
   { icon: 'fa-solid fa-computer-mouse', key: 'RightClick', gm: true },
   { icon: 'fa-solid fa-arrows-up-down-left-right', key: 'Drop', gm: true },
   { icon: 'fa-solid fa-grip-vertical', key: 'Reorder', gm: true }
];

/**
 * Puts the ? button in a window's title bar, after its title. Safe to call on every render.
 *
 * @param {object} app - The Quest Log.
 */
export function addTipsButton(app)
{
   const header = windowHeader(app.element);
   if (!header || header.querySelector('[data-action="showTips"]')) { return; }
   const label = game.i18n.localize('FHQL.Tips.Open');
   const button = document.createElement('button');
   button.type = 'button';
   button.className = 'header-control fhql-tips-button';
   button.dataset.action = 'showTips';
   button.dataset.tooltip = label;
   button.setAttribute('aria-label', label);
   const icon = document.createElement('i');
   icon.className = 'fa-solid fa-circle-question';
   icon.inert = true;
   button.append(icon);
   (header.querySelector('.window-title') ?? header.firstElementChild)?.after(button);
}

/** @this {object} The Quest Log. */
export function onShowTips(event, target)
{
   const tips = TIPS.filter((tip) => game.user.isGM || !tip.gm)
    .map((tip) => ({ icon: tip.icon, text: game.i18n.localize(`FHQL.Tips.${tip.key}`) }));
   const html = renderTemplateNow(TEMPLATES.tips, { tips });
   return openPanel(this, target, html, (panel, done) =>
   {
      panel.addEventListener('click', (e) => { if (e.target.closest('[data-answer]')) { done(null); } });
   }, { label: game.i18n.localize('FHQL.Tips.Title') });
}
