import { hideTooltip, showTooltip } from '../compat.js';
import { STATUSES } from '../constants.js';
import { getQuestEntry, questAccess, questPage } from '../data/quests.js';

/**
 * Hover previews: hovering a quest link (in chat, a journal, anywhere Foundry draws a content link)
 * shows a small card: image, name, status, objective progress, and the next open objective. Only
 * quests the viewer may see; objectives only with full access. See docs/SCOPE.md 7.4e.
 */

const DELAY = 300;

/**
 * @param {HTMLElement} link - A content link.
 * @returns {JournalEntry|null} The quest it points to, if it is one.
 */
function questFromLink(link)
{
   const uuid = link.dataset.uuid ?? '';
   const id = uuid.match(/^JournalEntry\.([^.]+)/)?.[1];
   return id ? (getQuestEntry(id) ?? null) : null;
}

/**
 * @param {JournalEntry} entry - A quest the viewer may see.
 * @returns {string} The card's HTML.
 */
function cardHTML(entry)
{
   const escape = foundry.utils.escapeHTML;
   const t = (key) => game.i18n.localize(key);
   const access = questAccess(entry);
   const system = questPage(entry).system;
   const objectives = access.full ? system.objectiveList.filter((o) => access.gm || !o.hidden) : [];
   const done = objectives.filter((o) => o.state === 'done').length;
   const next = objectives.find((o) => o.state === 'open');
   return `<div class="fhql-preview-card">
      ${system.image ? `<img src="${escape(system.image)}" alt="">` : ''}
      <strong>${escape(entry.name)}</strong>
      <span class="fhql-preview-status"><i class="${STATUSES[system.status].icon}" inert></i> ${t(`FHQL.Status.${system.status}`)}${objectives.length ? ` · ${done}/${objectives.length}` : ''}</span>
      ${next ? `<span class="fhql-preview-next">${escape(game.i18n.format('FHQL.Preview.Next', { objective: next.name }))}</span>` : ''}
   </div>`;
}

/** Registers the hover listener. Called on `ready`. */
export function registerQuestPreview()
{
   let timer = null;
   let current = null;
   const leave = () =>
   {
      clearTimeout(timer);
      if (!current) { return; }
      // Put back Foundry's own tooltip text for the link.
      if (current.dataset.fhqlTooltip !== undefined) { current.dataset.tooltip = current.dataset.fhqlTooltip; delete current.dataset.fhqlTooltip; }
      hideTooltip();
      current = null;
   };
   document.body.addEventListener('pointerover', (event) =>
   {
      const link = event.target.closest?.('a.content-link[data-uuid]');
      if (!link || link === current) { return; }
      leave();
      const entry = questFromLink(link);
      if (!entry || !questAccess(entry).visible) { return; }
      current = link;
      // Foundry's own "Journal Entry" tooltip would replace ours; hold it while hovering.
      if (link.dataset.tooltip !== undefined) { link.dataset.fhqlTooltip = link.dataset.tooltip; delete link.dataset.tooltip; }
      timer = setTimeout(() => { if (current === link) { showTooltip(link, cardHTML(entry), 'fhql-quest-preview'); } }, DELAY);
   });
   document.body.addEventListener('pointerout', (event) =>
   {
      if (current && !current.contains(event.relatedTarget)) { leave(); }
   });
}
