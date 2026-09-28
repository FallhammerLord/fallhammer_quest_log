import { MODULE_ID, THEMES } from './constants.js';

const THEME_CLASSES = Object.values(THEMES).map((theme) => `fhql-theme-${theme}`);

/** Open fhql windows, so a theme change can restyle them without a re-render. */
const openApps = new Set();

/** @returns {string} The current client's theme setting. */
export function currentTheme()
{
   const theme = game.settings.get(MODULE_ID, 'theme');
   return THEME_CLASSES.includes(`fhql-theme-${theme}`) ? theme : THEMES.auto;
}

/**
 * Sets the theme class on a window's root element. `auto` resolves in CSS against core's own
 * `.theme-light` / `.theme-dark` classes, so no core setting is read here.
 *
 * @param {HTMLElement} element - The window's root element.
 */
export function applyTheme(element)
{
   if (!element) { return; }
   element.classList.remove(...THEME_CLASSES);
   element.classList.add(`fhql-theme-${currentTheme()}`);
}

/** @param {foundry.applications.api.ApplicationV2} app - A window to keep themed while open. */
export function trackApp(app) { openApps.add(app); }

/** @param {foundry.applications.api.ApplicationV2} app - A window that has closed. */
export function untrackApp(app) { openApps.delete(app); }

/** Re-applies the theme to every open fhql window. Called when the setting changes. */
export function refreshOpenApps()
{
   for (const app of openApps) { applyTheme(app.element); }
}
