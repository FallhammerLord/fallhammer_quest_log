import { MODULE_ID, THEMES } from './constants.js';

const THEME_CLASSES = Object.values(THEMES).map((theme) => `fhql-theme-${theme}`);

/** Open fhql windows, so a theme change can restyle them without a re-render. */
const openApps = new Set();

/**
 * Unsaved choices from the open settings window, shown on open windows as a live preview.
 * Keys are setting names (`theme`, `worldTheme`, `headingFont`, ...). Cleared when that window closes.
 *
 * @type {Record<string, string>}
 */
let preview = {};

/** @param {string} key - A theme or font setting. @returns {string} Its previewed value, else the saved one. */
const setting = (key) => preview[key] ?? game.settings.get(MODULE_ID, key);

/**
 * The theme in effect for this client: their own choice, or the GM's world default when they chose
 * "Use world theme" (the default).
 *
 * @returns {string} A key of THEMES.
 */
export function currentTheme()
{
   const valid = (theme) => THEME_CLASSES.includes(`fhql-theme-${theme}`);
   const own = setting('theme');
   if (valid(own)) { return own; }
   const world = setting('worldTheme');
   return valid(world) ? world : THEMES.auto;
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
   applyFonts(element);
}

/**
 * The font in effect for one role: the player's own choice, else the GM's world choice, else the
 * theme's default ('').
 *
 * @param {'heading'|'body'} role - Which font.
 * @returns {string} Font family, or '' for the theme default.
 */
export function currentFont(role)
{
   const own = setting(`${role}Font`);
   if (own !== 'world') { return own; }
   return setting(`world${role === 'heading' ? 'Heading' : 'Body'}Font`);
}

/**
 * Sets chosen fonts as inline token overrides on a themed element, falling back to the theme's own
 * stack if the font can't load. Clears them when the theme default is in effect.
 *
 * @param {HTMLElement} element - A themed element.
 */
function applyFonts(element)
{
   for (const role of ['heading', 'body'])
   {
      const family = currentFont(role);
      const property = `--fhql-font-${role}`;
      if (family) { element.style.setProperty(property, `"${family.replace(/"/g, '')}", var(--fhql-font-${role}-theme))`); }
      else { element.style.removeProperty(property); }
   }
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

/**
 * Previews unsaved theme and font choices on open windows and the Beacon, or ends the preview.
 *
 * @param {Record<string, string>|null} values - Setting name to chosen value, or null to show saved settings.
 */
export function previewTheme(values)
{
   preview = values ?? {};
   refreshOpenApps();
   const beacon = document.getElementById(`${MODULE_ID}-beacon`);
   if (beacon) { applyTheme(beacon); }
}
