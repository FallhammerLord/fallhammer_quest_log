import { playerRowElement, playersElement } from '../compat.js';
import { MODULE_ID } from '../constants.js';
import { openQuestLog } from '../api.js';
import { questAccess, questPage, visibleQuests } from '../data/quests.js';
import { applyTheme } from '../theme.js';

const WIDGET_ID = 'fhql-beacon';

/** Keeps the widget sized to the players list as that list resizes or expands. */
let resizeObserver;

const OBJECTIVE_ICONS = { open: 'fa-regular fa-square', done: 'fa-solid fa-square-check', failed: 'fa-solid fa-square-xmark' };

/**
 * The Quest Beacon: the In Progress quest and its objectives, above Foundry's players list.
 * See docs/SCOPE.md 7.2.
 * Our own element, inserted beside core's, never inside it. If the players list is missing, we skip.
 */
export function refreshQuestBeacon()
{
   const players = playersElement();
   let widget = document.getElementById(WIDGET_ID);

   const quests = game.settings.get(MODULE_ID, 'showInProgress')
    ? visibleQuests().filter((entry) => questPage(entry).system.inProgress)
    : [];

   if (!players || !quests.length)
   {
      widget?.remove();
      return;
   }

   if (!widget)
   {
      widget = document.createElement('section');
      widget.id = WIDGET_ID;
      widget.className = 'fhql-app fhql-beacon';
      widget.addEventListener('click', (event) =>
      {
         const id = event.target.closest('[data-quest-id]')?.dataset.questId;
         if (id) { openQuestLog(id); }
      });
   }
   if (widget.nextElementSibling !== players) { players.before(widget); }

   applyTheme(widget);
   widget.innerHTML = renderWidget(quests);
   matchPlayersSize(widget, players);

   if (!resizeObserver)
   {
      resizeObserver = new ResizeObserver(() =>
      {
         const current = document.getElementById(WIDGET_ID);
         if (current) { matchPlayersSize(current, playersElement()); }
      });
   }
   resizeObserver.disconnect();
   resizeObserver.observe(players);
}

/**
 * Sets the widget's width to the players list and its minimum height to one player row.
 *
 * @param {HTMLElement} widget - Our widget.
 * @param {HTMLElement} players - Core's players list.
 */
function matchPlayersSize(widget, players)
{
   const row = playerRowElement(players);
   const width = visibleWidth(players, row);
   const rowHeight = row?.getBoundingClientRect().height;
   const head = widget.querySelector('.fhql-beacon-head');

   // Inline sizes, so no stylesheet can shrink the Beacon. The header matches one player row; the
   // objectives list below it grows as needed.
   if (width) { widget.style.width = `${width}px`; }
   if (head && rowHeight) { head.style.minHeight = `${rowHeight}px`; }
   if (head) { head.style.height = 'auto'; }
   widget.dataset.fhqlMeasured = `${Math.round(width ?? 0)}x${Math.round(rowHeight ?? 0)}`;
}

/**
 * Width of the players list as drawn. UI modules can let the list's contents spill past its box,
 * so take the widest of the box, its scroll width, and a player row.
 *
 * @param {HTMLElement} players - Core's players list.
 * @param {HTMLElement|null} row - One player row.
 * @returns {number} Width in pixels.
 */
function visibleWidth(players, row)
{
   if (!players) { return 0; }
   return Math.max(players.getBoundingClientRect().width, players.scrollWidth, row?.getBoundingClientRect().width ?? 0);
}

/**
 * Diagnostic for the Beacon's sizing. Run `game.modules.get('fhql').api.debugBeacon()` in the console.
 *
 * @returns {object} What the widget measured and what the browser applied.
 */
export function debugQuestBeacon()
{
   const widget = document.getElementById(WIDGET_ID);
   const players = playersElement();
   const button = widget?.querySelector('.fhql-beacon-head');
   const size = (el) => (el ? `${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}` : null);
   const info = {
      widgetFound: !!widget,
      playersFound: !!players,
      playersTag: players ? `${players.tagName.toLowerCase()}#${players.id}` : null,
      playerRowFound: !!playerRowElement(players),
      measured: widget?.dataset.fhqlMeasured ?? null,
      playersSize: size(players),
      playersScrollWidth: players?.scrollWidth ?? null,
      playerRowSize: size(playerRowElement(players)),
      objectivesShown: widget?.querySelectorAll('.fhql-beacon-objectives li').length ?? 0,
      showNextObjectiveSetting: game.settings.get(MODULE_ID, 'showNextObjective'),
      widgetSize: size(widget),
      buttonSize: size(button),
      widgetParent: widget?.parentElement ? `${widget.parentElement.tagName.toLowerCase()}#${widget.parentElement.id}` : null,
      parentDisplay: widget?.parentElement ? getComputedStyle(widget.parentElement).display : null,
      stylesheetLoaded: !!widget && getComputedStyle(widget).getPropertyValue('--fhql-surface').trim() !== ''
   };
   console.table(info);
   return info;
}

/**
 * @param {JournalEntry[]} quests - In Progress quests the user can see. The first is shown.
 * @returns {string} Beacon HTML.
 */
function renderWidget(quests)
{
   const [entry] = quests;
   const system = questPage(entry).system;
   const access = questAccess(entry);
   const escape = foundry.utils.escapeHTML;
   const localize = (key) => game.i18n.localize(key);

   const objectives = access.full && game.settings.get(MODULE_ID, 'showNextObjective')
    ? system.objectiveList.filter((objective) => access.gm || !objective.hidden)
    : [];

   const hiddenMark = system.status === 'hidden'
    ? `<i class="fa-solid fa-eye-slash" data-tooltip="${localize('FHQL.Status.hidden')}"></i>` : '';
   const more = quests.length > 1
    ? `<span class="fhql-beacon-more" data-tooltip="${escape(quests.slice(1).map((q) => q.name).join(', '))}">+${quests.length - 1}</span>`
    : '';
   const label = game.i18n.format('FHQL.Beacon.Label', { name: entry.name });

   const list = objectives.length ? `<ol class="fhql-beacon-objectives" aria-label="${localize('FHQL.Quest.Objectives')}">
      ${objectives.map((o) => `<li class="is-${o.state}">
        <i class="fhql-state-icon ${OBJECTIVE_ICONS[o.state]}" aria-label="${localize(`FHQL.Objective.State.${o.state}`)}"></i>
        <span>${escape(o.name)}</span>
        ${o.hidden ? `<i class="fa-solid fa-eye-slash fhql-muted" aria-label="${localize('FHQL.Objective.Hidden')}"></i>` : ''}
      </li>`).join('')}
    </ol>` : '';

   return `<div class="fhql-beacon-panel" data-quest-id="${entry.id}">
      <button type="button" class="fhql-beacon-head" aria-label="${escape(label)}">
        <i class="fa-solid fa-star fhql-in-progress" inert></i>
        <span class="fhql-beacon-name" data-tooltip="${escape(entry.name)}">${escape(entry.name)}</span>
        ${hiddenMark}${more}
      </button>
      ${list}
    </div>`;
}

