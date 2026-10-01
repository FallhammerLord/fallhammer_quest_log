import { playerRowElement, playersElement } from '../compat.js';
import { MODULE_ID, THEMES } from '../constants.js';
import { BELL_HTML, eggFor } from './eggs.js';
import { openQuestLog, showInOpenLog, toggleQuestLog } from '../api.js';
import { questAccess, questPage } from '../data/quests.js';
import { beaconChoice, beaconQuests, setBeaconChoice } from '../data/tracking.js';
import { menuPopover } from './popover.js';
import { questLogAvailable } from '../data/playerActions.js';
import { playerOwned } from '../data/rewards.js';
import { applyTheme } from '../theme.js';
import { depositedTotal, hasRequirement } from '../data/deposits.js';
import { isUnseen } from '../data/seen.js';

const WIDGET_ID = 'fhql-beacon';

/** Keeps the widget sized to the players list as that list resizes or expands. */
let resizeObserver;

const OBJECTIVE_ICONS = { open: 'fa-regular fa-square', done: 'fa-solid fa-square-check', failed: 'fa-solid fa-square-xmark' };

/**
 * The Quest Beacon, above Foundry's players list. Always present (unless the player turns it off): it
 * shows one marked quest (party In Progress or personally tracked) with its objectives, a switcher
 * when several are marked, and an empty-state button that opens the Quest Log. See docs/SCOPE.md 7.2.
 * Our own element, inserted beside core's, never inside it. If the players list is missing, we skip.
 */
export function refreshQuestBeacon()
{
   const players = playersElement();
   let widget = document.getElementById(WIDGET_ID);

   if (!players || !questLogAvailable() || !game.settings.get(MODULE_ID, 'showInProgress'))
   {
      widget?.remove();
      return;
   }

   if (!widget)
   {
      widget = document.createElement('section');
      widget.id = WIDGET_ID;
      widget.className = 'fhql-app fhql-beacon';
      widget.addEventListener('click', (event) => onBeaconClick(event, widget));
   }
   if (widget.nextElementSibling !== players) { players.before(widget); }

   const marked = beaconQuests();
   const choice = beaconChoice();
   const shown = marked.find((q) => q.entry.id === choice) ?? marked[0] ?? null;

   applyTheme(widget);
   widget.innerHTML = shown ? renderWidget(shown, marked) : renderEmpty();
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
 * Handles clicks on the Beacon: the switcher opens a panel of marked quests; the empty-state button
 * opens the Quest Log; anywhere else opens the shown quest.
 *
 * @param {MouseEvent} event - The click.
 * @param {HTMLElement} widget - The Beacon.
 */
async function onBeaconClick(event, widget)
{
   if (event.target.closest('.fhql-popover')) { return; }
   const switcher = event.target.closest('[data-beacon-switch]');
   if (switcher)
   {
      event.stopPropagation();
      const marked = beaconQuests();
      const current = widget.querySelector('[data-quest-id]')?.dataset.questId;
      const t = (key) => game.i18n.localize(key);
      const choice = await menuPopover(widget, switcher, {
         title: t('FHQL.Beacon.Choose'),
         items: [
            ...marked.map(({ entry, party, tracked }) => ({
               value: entry.id,
               label: entry.name,
               icon: entry.id === current ? 'fa-solid fa-check' : party ? 'fa-solid fa-star' : 'fa-solid fa-bookmark',
               hint: [party ? t('FHQL.Beacon.Party') : '', tracked ? t('FHQL.Beacon.Tracked') : ''].filter(Boolean).join(' · '),
               current: entry.id === current
            })),
            { value: '__log', label: t('FHQL.QuestLog.Open'), icon: 'fa-solid fa-scroll' }
         ]
      });
      if (choice === '__log') { openQuestLog(); }
      else if (choice)
      {
         await setBeaconChoice(choice);
         refreshQuestBeacon();
         // An open Quest Log follows the Beacon to its new quest.
         showInOpenLog(choice);
      }
      return;
   }
   // The Beacon is the log's toggle: open (from here), bring back if minimized, or close with every quest window.
   if (event.target.closest('[data-beacon-empty]')) { toggleQuestLog(null, widget); return; }
   const id = event.target.closest('[data-quest-id]')?.dataset.questId;
   if (id) { toggleQuestLog(id, widget); }
}

/** @returns {string} The Beacon with nothing marked: a button that opens the Quest Log. */
function renderEmpty()
{
   const t = (key) => game.i18n.localize(key);
   return `<div class="fhql-beacon-panel is-empty">
      <button type="button" class="fhql-beacon-head" data-beacon-empty aria-label="${t('FHQL.Beacon.EmptyLabel')}">
        <i class="fa-regular fa-bookmark fhql-muted" inert></i>
        <span class="fhql-beacon-name fhql-muted">${t('FHQL.Beacon.Empty')}</span>
        <i class="fa-solid fa-scroll fhql-beacon-gift" inert></i>
      </button>
    </div>`;
}

/**
 * @param {{ entry: JournalEntry, party: boolean, tracked: boolean }} shown - The quest to show.
 * @param {object[]} marked - Every marked quest, for the switcher.
 * @returns {string} Beacon HTML.
 */
/**
 * What the Beacon showed last time, so a changed objective (ticked, failed, a deposit) can glow once.
 * Keyed by objective: state and deposit progress.
 */
let lastShown = { entryId: null, keys: new Map(), status: null, allDone: null };

function renderWidget({ entry, party }, marked)
{
   const system = questPage(entry).system;
   const access = questAccess(entry);
   const escape = foundry.utils.escapeHTML;
   const localize = (key) => game.i18n.localize(key);

   const objectives = access.full && game.settings.get(MODULE_ID, 'showNextObjective')
    ? system.objectiveList.filter((objective) => access.gm || !objective.hidden)
    : [];

   const hiddenMark = system.status === 'hidden'
    ? `<i class="fa-solid fa-eye-slash" data-tooltip="${localize('FHQL.Status.hidden')}"></i>` : '';
   const switcher = marked.length > 1
    ? `<button type="button" class="fhql-beacon-switch" data-beacon-switch aria-haspopup="menu"
         aria-label="${escape(game.i18n.format('FHQL.Beacon.SwitchLabel', { count: marked.length }))}"
         data-tooltip="${localize('FHQL.Beacon.Choose')}${marked.length >= 3 && eggFor(THEMES.gothic) ? ` · ${localize('FHQL.Egg.Hunter')}` : ''}">${marked.length}<i class="fa-solid fa-chevron-up" inert></i></button>`
    : '';
   const label = game.i18n.format('FHQL.Beacon.Label', { name: entry.name });
   const hasRewards = !access.gm && access.full && !playerOwned(entry) && Object.values(system.rewards).some((r) =>
      (r.type === 'item' || r.type === 'actor') && r.uuid && !r.hidden && !r.locked
      && (r.claimLimit === 'perPlayer' ? !r.claims.some((c) => c.userId === game.user.id) : r.claims.length === 0));
   const gift = hasRewards
    ? `<i class="fa-solid fa-gift fhql-beacon-gift" data-tooltip="${localize('FHQL.Beacon.Rewards')}" aria-label="${localize('FHQL.Beacon.Rewards')}"></i>` : '';
   const markIcon = party
    ? `<i class="fa-solid fa-star fhql-in-progress" data-tooltip="${localize('FHQL.Beacon.Party')}" aria-label="${localize('FHQL.Beacon.Party')}"></i>`
    : `<i class="fa-solid fa-bookmark fhql-in-progress" data-tooltip="${localize('FHQL.Beacon.Tracked')}" aria-label="${localize('FHQL.Beacon.Tracked')}"></i>`;

   // Completion moments: a row whose state or deposit count changed since the last draw glows once,
   // and a count that rose ticks up. The first draw of a quest never glows.
   const same = lastShown.entryId === entry.id;
   const keys = new Map();
   const flash = (o) =>
   {
      const key = `${o.state}|${hasRequirement(o) ? depositedTotal(o) : ''}`;
      keys.set(o.id, key);
      return same && lastShown.keys.has(o.id) && lastShown.keys.get(o.id) !== key;
   };
   const celebrate = same && lastShown.status !== system.status && ['completed', 'failed'].includes(system.status);
   // Gothic easter egg: the bell tolls when the last open objective is completed.
   const allDone = objectives.length > 0 && objectives.every((o) => o.state === 'done');
   const toll = same && allDone && lastShown.allDone === false && eggFor(THEMES.gothic);
   const list = objectives.length ? `<ol class="fhql-beacon-objectives" aria-label="${localize('FHQL.Quest.Objectives')}">
      ${objectives.map((o) => `<li class="is-${o.state} ${flash(o) ? 'is-flash' : ''}">
        <i class="fhql-state-icon ${OBJECTIVE_ICONS[o.state]}" aria-label="${localize(`FHQL.Objective.State.${o.state}`)}"></i>
        <span>${escape(o.name)}${hasRequirement(o) ? ` <span class="fhql-beacon-progress"><span class="${same && lastShown.keys.get(o.id) && lastShown.keys.get(o.id) !== keys.get(o.id) ? 'fhql-tick' : ''}">${depositedTotal(o)}</span>/${o.requirement.count}</span>` : ''}</span>
        ${o.hidden ? `<i class="fa-solid fa-eye-slash fhql-muted" aria-label="${localize('FHQL.Objective.Hidden')}"></i>` : ''}
      </li>`).join('')}
    </ol>` : '';

   const dot = isUnseen(entry)
    ? `<span class="fhql-new-dot" data-tooltip="${localize('FHQL.Seen.New')}" aria-label="${localize('FHQL.Seen.New')}"></span>` : '';
   lastShown = { entryId: entry.id, keys, status: system.status, allDone };
   return `<div class="fhql-beacon-panel ${celebrate ? 'is-celebrate' : ''} ${toll ? 'is-tolling' : ''}" data-quest-id="${entry.id}">${dot}${toll ? BELL_HTML : ''}
      <div class="fhql-beacon-headrow">
        <button type="button" class="fhql-beacon-head" aria-label="${escape(label)}">
          ${markIcon}
          <span class="fhql-beacon-name" data-tooltip="${escape(entry.name)}">${escape(entry.name)}</span>
          ${gift}${hiddenMark}
        </button>
        ${switcher}
      </div>
      ${list}
    </div>`;
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
