import { hideTooltip, renderTemplateNow, showTooltip } from '../compat.js';
import { STATUSES, TEMPLATES } from '../constants.js';
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
   const access = questAccess(entry);
   const system = questPage(entry).system;
   const objectives = access.full ? system.objectiveList.filter((o) => access.gm || !o.hidden) : [];
   const next = objectives.find((o) => o.state === 'open');
   return renderTemplateNow(TEMPLATES.preview, {
      image: system.image,
      name: entry.name,
      statusIcon: STATUSES[system.status].icon,
      statusLabel: game.i18n.localize(`FHQL.Status.${system.status}`),
      done: objectives.filter((o) => o.state === 'done').length,
      total: objectives.length,
      next: next ? game.i18n.format('FHQL.Preview.Next', { objective: next.name }) : ''
   });
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
