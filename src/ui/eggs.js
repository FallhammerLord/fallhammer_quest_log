import { renderTemplateNow } from '../compat.js';
import { QUEST_TYPE, TEMPLATES, THEMES } from '../constants.js';
import { currentTheme } from '../theme.js';
import { getSetting } from '../setting.js';

/**
 * Easter eggs: rare, purely visual moments, one per theme. Never interactive, never announced, never
 * in the way (pointer-events: none), and a plain fade for reduced motion (the CSS lives in each theme's
 * file). The GM can turn them all off (setting `easterEggs`). See docs/SCOPE.md 7.4f.
 *
 * - Gothic: the Beacon's bell tolls when a quest's last open objective is completed, and with three or
 *   more marked quests the switcher reminds you that a hunter is never alone.
 * - Cabaret: the third quest completed in a session gets a curtain call.
 * - Sci-fi: a passive click (a row, a panel, a title, the Beacon; never a button, link, field, or
 *   menu) glitches the clicked element for 400ms, 1 time in 20, at most once every 10 seconds.
 */

/**
 * @param {string} theme - A key of THEMES.
 * @returns {boolean} Whether that theme's easter egg may play for this client.
 */
export function eggFor(theme)
{
   try { return getSetting('easterEggs') && currentTheme() === theme; }
   catch { return false; } // Settings not registered yet (a click before init finished): no egg.
}

/** Quests completed this session, as this client saw them. */
let completions = 0;

/** Sci-fi glitch: odds per passive click, silent cooldown, and how long it plays (ms). */
const GLITCH_ODDS = 1 / 20;
const GLITCH_COOLDOWN = 10000;
const GLITCH_MS = 400;
/** The reduced-motion readout's fade, as in styles/themes/scifi.css. */
const GLITCH_STILL_MS = 900;
/** The curtain call's run (3.2s in styles/themes/cabaret.css), plus a moment's margin. */
const CURTAIN_MS = 3400;
const READOUTS = ['SYNC 0x3F…OK', 'GHOST// ACK', 'PKT LOSS 0.02%', 'NODE 7 ⟶ RELINK', 'CRC 9A1F OK'];
let lastGlitch = -Infinity;

/** Clicks that never glitch: anything that does something, and anything you type into. */
const ACTIVE = 'button, a, input, select, textarea, [contenteditable], prose-mirror, [data-action], .fhql-popover';
/** What can glitch: our rows, panels, titles, and the Beacon. */
const PASSIVE = '.fhql-app .fhql-row, .fhql-app .fhql-card, .fhql-app .fhql-heading, .fhql-beacon-panel';

/**
 * A passive click in the Sci-fi theme may glitch what was clicked.
 *
 * @param {MouseEvent} event - The click.
 */
function maybeGlitch(event)
{
   if (!(event.target instanceof Element) || event.target.closest(ACTIVE)) { return; }
   const el = event.target.closest(PASSIVE);
   if (!el?.closest('.fhql-theme-scifi') || !eggFor(THEMES.scifi)) { return; }
   // Editing panels hold editors and fields that must never be copied.
   if (el.querySelector('prose-mirror, input, select, textarea')) { return; }
   const now = performance.now();
   if (now - lastGlitch < GLITCH_COOLDOWN || Math.random() >= GLITCH_ODDS) { return; }
   lastGlitch = now;
   glitch(el);
}

/**
 * Two tinted copies of the element, cut into bands that jump sideways, a one-pixel shiver, and a
 * readout in the corner (CSS in styles/themes/scifi.css). The copies sit inside the same themed
 * window, so they keep its styling, and take no clicks.
 *
 * @param {HTMLElement} el - The clicked element.
 */
function glitch(el)
{
   const host = el.closest('.fhql-app');
   if (!host) { return; }
   const a = el.getBoundingClientRect();
   const h = host.getBoundingClientRect();
   const layer = document.createElement('div');
   layer.className = 'fhql-egg-glitch';
   layer.setAttribute('aria-hidden', 'true');
   Object.assign(layer.style, { left: `${a.left - h.left}px`, top: `${a.top - h.top}px`, width: `${a.width}px`, height: `${a.height}px` });
   for (const tint of ['is-cyan', 'is-magenta'])
   {
      const copy = el.cloneNode(true);
      copy.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
      copy.removeAttribute('id');
      copy.classList.add('fhql-egg-copy', tint);
      Object.assign(copy.style, { width: `${a.width}px`, height: `${a.height}px`, flexBasis: 'auto' });
      layer.append(copy);
   }
   const readout = document.createElement('span');
   readout.className = 'fhql-egg-readout';
   readout.textContent = READOUTS[Math.floor(Math.random() * READOUTS.length)];
   layer.append(readout);
   host.append(layer);
   el.classList.add('fhql-egg-shiver');
   // Long enough for the reduced-motion readout too.
   setTimeout(() => { layer.remove(); el.classList.remove('fhql-egg-shiver'); }, Math.max(GLITCH_MS, GLITCH_STILL_MS) + 100);
}

/** Counts completions for the Cabaret curtain call; listens for Sci-fi glitch clicks. Called on init. */
export function registerEggs()
{
   document.addEventListener('click', maybeGlitch);
   Hooks.on('updateJournalEntryPage', (page, changes) =>
   {
      if (page.type !== QUEST_TYPE || changes.system?.status !== 'completed') { return; }
      completions += 1;
      if (completions === 3 && eggFor(THEMES.cabaret)) { curtainCall(); }
   });
}

/** Velvet curtains sweep over the open Quest Log (or a quest window), a marquee lights, they part. */
function curtainCall()
{
   const host = document.querySelector('.fhql-quest-log:not(.minimized)') ?? document.querySelector('.fhql-quest-sheet:not(.minimized)');
   if (!host) { return; }
   const overlay = document.createElement('div');
   overlay.className = 'fhql-egg-curtain';
   overlay.setAttribute('aria-hidden', 'true');
   overlay.innerHTML = renderTemplateNow(TEMPLATES.curtain, {});
   host.append(overlay);
   setTimeout(() => overlay.remove(), CURTAIN_MS);
}
