import { MODULE_ID, QUEST_TYPE, THEMES } from '../constants.js';
import { currentTheme } from '../theme.js';

/**
 * Easter eggs: rare, purely visual moments, one per theme. Never interactive, never announced, never
 * in the way (pointer-events: none), and a plain fade for reduced motion (the CSS lives in each theme's
 * file). The GM can turn them all off (setting `easterEggs`). See docs/SCOPE.md 7.4f.
 *
 * - Gothic: the Beacon's bell tolls when a quest's last open objective is completed, and with three or
 *   more marked quests the switcher reminds you that a hunter is never alone.
 * - Cabaret: the third quest completed in a session gets a curtain call.
 */

/**
 * @param {string} theme - A key of THEMES.
 * @returns {boolean} Whether that theme's easter egg may play for this client.
 */
export function eggFor(theme)
{
   try { return game.settings.get(MODULE_ID, 'easterEggs') && currentTheme() === theme; }
   catch { return false; }
}

/** The Gothic bell for the Beacon: an iron bell, a blood-red clapper, and three rings. */
export const BELL_HTML = `<span class="fhql-egg-bell" aria-hidden="true">
   <span class="fhql-egg-ring"></span><span class="fhql-egg-ring"></span><span class="fhql-egg-ring"></span>
   <svg viewBox="0 0 34 40"><path d="M17 1v4" stroke="var(--fhql-gothic-iron)" stroke-width="2"/>
     <path d="M9 26c0-10 2-17 8-17s8 7 8 17l3 5H6z" fill="var(--fhql-surface-raised)" stroke="var(--fhql-gothic-brass)" stroke-width="1.2"/>
     <circle cx="17" cy="34" r="3" fill="var(--fhql-accent)"/></svg></span>`;

/** Quests completed this session, as this client saw them. */
let completions = 0;

/** Counts completions for the Cabaret curtain call. Called on init. */
export function registerEggs()
{
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
   const bulbs = '<span class="fhql-egg-bulbs"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>';
   const overlay = document.createElement('div');
   overlay.className = 'fhql-egg-curtain';
   overlay.setAttribute('aria-hidden', 'true');
   overlay.innerHTML = `<span class="fhql-egg-drape is-left"></span><span class="fhql-egg-drape is-right"></span>
      <span class="fhql-egg-marquee">${bulbs}<span class="fhql-egg-line">${game.i18n.localize('FHQL.Egg.Curtain')}</span>
      <span class="fhql-egg-sub">${game.i18n.localize('FHQL.Egg.CurtainSub')}</span>${bulbs}</span>`;
   host.append(overlay);
   setTimeout(() => overlay.remove(), 3400);
}
