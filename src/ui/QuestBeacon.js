import { playerRowElement, playersElement, renderLoadedTemplate } from '../compat.js';
import { TEMPLATES, THEMES } from '../constants.js';
import { eggFor } from './eggs.js';
import { openQuestLog, showInOpenLog, toggleQuestLog } from '../api.js';
import { questAccess, questPage } from '../data/quests.js';
import { beaconChoice, beaconQuests, setBeaconChoice } from '../data/tracking.js';
import { menuPopover } from './popover.js';
import { questLogAvailable } from '../data/playerActions.js';
import { playerOwned } from '../data/rewards.js';
import { applyTheme } from '../theme.js';
import { depositedTotal, hasRequirement } from '../data/deposits.js';
import { isUnseen } from '../data/seen.js';
import { getSetting } from '../setting.js';

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

   if (!players || !questLogAvailable() || !getSetting('showInProgress'))
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
   const html = renderLoadedTemplate(TEMPLATES.beacon, shown ? beaconContext(shown, marked) : { empty: true });
   // Before the template has loaded (only during startup), keep what is there; the ready hook redraws.
   if (html !== null) { widget.innerHTML = html; }
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

/**
 * What the Beacon showed last time, so a changed objective (ticked, failed, a deposit) can glow once.
 * Keyed by objective: state and deposit progress.
 */
let lastShown = { entryId: null, keys: new Map(), status: null, allDone: null };

/** The Gothic bell: which quest it tolls for, since when, and how long it plays (ms). */
let tolling = { entryId: null, at: 0 };
const TOLL_MS = 2600;

/**
 * @param {{ entry: JournalEntry, party: boolean, tracked: boolean }} shown - The quest to show.
 * @param {object[]} marked - Every marked quest, for the switcher.
 * @returns {object} Data for templates/beacon.hbs.
 */
function beaconContext({ entry, party }, marked)
{
   const system = questPage(entry).system;
   const access = questAccess(entry);
   const localize = (key) => game.i18n.localize(key);

   const objectives = access.full && getSetting('showNextObjective')
    ? system.objectiveList.filter((objective) => access.gm || !objective.hidden)
    : [];

   const switcher = marked.length > 1 ? {
      count: marked.length,
      label: game.i18n.format('FHQL.Beacon.SwitchLabel', { count: marked.length }),
      tooltip: localize('FHQL.Beacon.Choose') + (marked.length >= 3 && eggFor(THEMES.gothic) ? ` · ${localize('FHQL.Egg.Hunter')}` : '')
   } : null;
   const gift = !access.gm && access.full && !playerOwned(entry) && Object.values(system.rewards).some((r) =>
      (r.type === 'item' || r.type === 'actor') && r.uuid && !r.hidden && !r.locked
      && (r.claimLimit === 'perPlayer' ? !r.claims.some((c) => c.userId === game.user.id) : r.claims.length === 0));

   // Completion moments: a row whose state or deposit count changed since the last draw glows once,
   // and a count that rose ticks up. The first draw of a quest never glows.
   const same = lastShown.entryId === entry.id;
   const keys = new Map();
   const rows = objectives.map((o) =>
   {
      const key = `${o.state}|${hasRequirement(o) ? depositedTotal(o) : ''}`;
      keys.set(o.id, key);
      const changed = same && lastShown.keys.has(o.id) && lastShown.keys.get(o.id) !== key;
      return {
         state: o.state,
         flash: changed,
         icon: OBJECTIVE_ICONS[o.state],
         stateLabel: localize(`FHQL.Objective.State.${o.state}`),
         name: o.name,
         hidden: o.hidden,
         progress: hasRequirement(o) ? { done: depositedTotal(o), count: o.requirement.count, tick: changed } : null
      };
   });
   const celebrate = same && lastShown.status !== system.status && ['completed', 'failed'].includes(system.status);
   // Gothic easter egg: the bell tolls when the last open objective is completed.
   const allDone = objectives.length > 0 && objectives.every((o) => o.state === 'done');
   if (same && allDone && lastShown.allDone === false && eggFor(THEMES.gothic)) { tolling = { entryId: entry.id, at: Date.now() }; }
   // The Beacon redraws on any change (the new-change dot clearing, a deposit); the bell carries on
   // from where it was instead of vanishing mid-swing.
   const tollElapsed = tolling.entryId === entry.id ? Date.now() - tolling.at : Infinity;
   lastShown = { entryId: entry.id, keys, status: system.status, allDone };

   return {
      entryId: entry.id,
      name: entry.name,
      label: game.i18n.format('FHQL.Beacon.Label', { name: entry.name }),
      party,
      gift,
      hiddenQuest: system.status === 'hidden',
      switcher,
      celebrate,
      objectives: rows,
      unseen: isUnseen(entry),
      bell: tollElapsed < TOLL_MS ? { elapsed: tollElapsed } : null
   };
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
      showNextObjectiveSetting: getSetting('showNextObjective'),
      widgetSize: size(widget),
      buttonSize: size(button),
      widgetParent: widget?.parentElement ? `${widget.parentElement.tagName.toLowerCase()}#${widget.parentElement.id}` : null,
      parentDisplay: widget?.parentElement ? getComputedStyle(widget.parentElement).display : null,
      stylesheetLoaded: !!widget && getComputedStyle(widget).getPropertyValue('--fhql-surface').trim() !== ''
   };
   console.table(info);
   return info;
}
