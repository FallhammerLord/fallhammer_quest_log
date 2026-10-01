import { MODULE_ID, MODULE_PATH, THEMES } from './constants.js';
import { registerFont, tidyBannerColor } from './compat.js';

const THEME_CLASSES = Object.values(THEMES).map((theme) => `fhql-theme-${theme}`);

/** Open fhql windows, so a theme change can restyle them without a re-render. */
const openApps = new Set();

/**
 * Unsaved choices from the open settings window, shown on open windows as a live preview.
 * Keys are setting names (`theme`, `worldTheme`, `textureStrength`, `headingFont`, ...). Cleared when that window closes.
 *
 * @type {Record<string, string|boolean>}
 */
let preview = {};

/** @param {string} key - A theme or font setting. @returns {string|boolean} Its previewed value, else the saved one. */
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
   const strength = currentStrength();
   // Smooth panels at 0: textures and images off, the theme's small shapes stay.
   element.classList.toggle('fhql-no-texture', strength === 0);
   element.style.setProperty('--fhql-strength', String(strength));
   element.classList.toggle('fhql-portrait-square', setting('portraitFrame') === 'square');
   applyOverlay(element);
   applyFonts(element);
   applyBanner(element);
}

/**
 * Texture strength in effect for this client: their own choice, else the GM's table setting.
 *
 * @returns {number} 0 (smooth) to 100; 50 shows each theme as designed.
 */
export function currentStrength()
{
   const own = setting('textureStrength');
   const value = Number(own === 'world' ? setting('worldTextureStrength') : own);
   return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 50;
}

/** Our own washes, drawn by tools/make-washes.mjs. */
const OWN_WASH = { top: `${MODULE_PATH}/styles/textures/wash-top.webp`, bottom: `${MODULE_PATH}/styles/textures/wash-bottom.webp` };

/** D&D 5e's grey ink washes, used when that system is running (not copied: read from the system). */
const DND5E_WASH = { top: 'systems/dnd5e/ui/texture-gray1.webp', bottom: 'systems/dnd5e/ui/texture-gray2.webp' };

/** Themes that show a wash unless the GM picks otherwise: the paper-like ones. */
const WASHED_THEMES = new Set([THEMES.light, THEMES.ledger]);

/**
 * The default overlay for a theme: D&D 5e's washes when that system runs, else ours, on paper-like
 * themes; none on the others (their own patterns carry them).
 *
 * @param {string} theme - A key of THEMES.
 * @returns {{top: string, bottom: string}} Image paths, '' for none.
 */
export function defaultOverlay(theme)
{
   if (!WASHED_THEMES.has(theme)) { return { top: '', bottom: '' }; }
   return game.system?.id === 'dnd5e' ? { ...DND5E_WASH } : { ...OWN_WASH };
}

/**
 * The overlay images in effect for a theme: the GM's uploads, each falling back to the default.
 *
 * @param {string} theme - A key of THEMES.
 * @returns {{top: string, bottom: string}} Image paths, '' for none.
 */
export function currentOverlay(theme)
{
   const chosen = setting('textureImages')?.[theme] ?? {};
   if (chosen.off) { return { top: '', bottom: '' }; }
   const fallback = defaultOverlay(theme);
   return { top: chosen.top || fallback.top, bottom: chosen.bottom || fallback.bottom };
}

/** @param {string} path - An image path. @returns {string} A CSS url() for it. */
const cssUrl = (path) => `url("${encodeURI(path).replace(/"/g, '%22')}")`;

/**
 * Sets the overlay images on a themed element: a top wash for headers, a lower wash for scrolling
 * areas (styles/fhql.css, "Texture strength and image overlay").
 *
 * @param {HTMLElement} element - A themed element.
 */
function applyOverlay(element)
{
   let theme = currentTheme();
   // "Follow Foundry" looks like Light or Dark, so it takes that theme's images (same test as the CSS).
   if (theme === THEMES.auto)
   {
      const dark = element.classList.contains('theme-dark') || (document.body.classList.contains('theme-dark') && !element.classList.contains('theme-light'));
      theme = dark ? THEMES.dark : THEMES.light;
   }
   const { top, bottom } = currentOverlay(theme);
   element.style.setProperty('--fhql-overlay-top', top ? cssUrl(top) : 'none');
   element.style.setProperty('--fhql-overlay-bottom', bottom ? cssUrl(bottom) : 'none');
}

/**
 * Ledger theme: takes its banner color from Tidy 5e Sheets when Tidy is active, with text in white
 * or near-black, whichever reads better on it. Clears the override otherwise.
 *
 * @param {HTMLElement} element - A themed element.
 */
function applyBanner(element)
{
   const color = currentTheme() === THEMES.ledger ? tidyBannerColor() : null;
   const rgb = color ? parseColor(color) : null;
   if (!rgb)
   {
      element.style.removeProperty('--fhql-banner');
      element.style.removeProperty('--fhql-banner-ink');
      return;
   }
   element.style.setProperty('--fhql-banner', `rgb(${rgb.join(' ')})`);
   element.style.setProperty('--fhql-banner-ink', bannerInk(rgb));
}

/**
 * @param {number[]} rgb - Background color, 0-255 channels.
 * @returns {string} White or near-black, whichever has more contrast on it.
 */
export function bannerInk(rgb)
{
   const channel = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
   const lum = (0.2126 * channel(rgb[0])) + (0.7152 * channel(rgb[1])) + (0.0722 * channel(rgb[2]));
   // Contrast against white (L=1) versus near-black #16171b (L≈0.008).
   return (1.05 / (lum + 0.05)) >= ((lum + 0.05) / 0.058) ? '#f8f4f1' : '#16171b';
}

/** Lets the browser parse any CSS color. */
let colorProbe = null;

/**
 * @param {string} color - Any CSS color.
 * @returns {number[]|null} Its RGB channels, or null if it isn't a color.
 */
function parseColor(color)
{
   colorProbe ??= document.createElement('canvas').getContext('2d');
   if (!colorProbe) { return null; }
   colorProbe.fillStyle = '#010203';
   colorProbe.fillStyle = color;
   const value = colorProbe.fillStyle;
   if (value === '#010203' && color.trim().toLowerCase() !== '#010203') { return null; }
   const hex = value.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
   if (hex) { return hex.slice(1).map((h) => parseInt(h, 16)); }
   const rgba = value.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
   return rgba ? rgba.slice(1, 4).map(Number) : null;
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

/** Theme style files, as listed in module.json `styles`. */
const THEME_FILES = ['light', 'dark', 'scifi', 'gothic', 'cabaret', 'hopefear', 'noir', 'ledger'];

/**
 * Foundry reads module.json's style list only when a world launches, so a theme added by an update
 * stays unstyled (looking like Light) until a relaunch. Loads any missing theme file now and says so.
 * Runs on ready.
 */
export function ensureThemeStyles()
{
   const missing = THEME_FILES.filter((name) => !document.querySelector(`link[href*="${MODULE_PATH}/styles/themes/${name}.css"]`));
   for (const name of missing)
   {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${MODULE_PATH}/styles/themes/${name}.css`;
      document.head.append(link);
   }
   if (missing.length) { console.warn(`${MODULE_ID} | Loaded theme styles Foundry had not (${missing.join(', ')}). Relaunch the world to load them normally.`); }
}

/** Fonts the module ships, for theme headings. */
const BUNDLED_FONTS = [
   { family: 'IM Fell English SC', url: `${MODULE_PATH}/styles/fonts/im-fell-english-sc/IMFellEnglishSC-Regular.woff2` },
   { family: 'Josefin Sans', url: `${MODULE_PATH}/styles/fonts/josefin-sans/JosefinSans-SemiBold.woff2`, weight: '400 700' },
   { family: 'Oxanium', url: `${MODULE_PATH}/styles/fonts/oxanium/Oxanium-SemiBold.woff2`, weight: '400 700' },
   { family: 'Limelight', url: `${MODULE_PATH}/styles/fonts/limelight/Limelight-Regular.woff2` },
   { family: 'Cinzel', url: `${MODULE_PATH}/styles/fonts/cinzel/Cinzel-SemiBold.woff2`, weight: '400 700' },
   { family: 'Courier Prime', url: `${MODULE_PATH}/styles/fonts/courier-prime/CourierPrime-Bold.woff2`, weight: '400 700' }
];

/**
 * Registers the module's own fonts: with Foundry (so they appear in font pickers, ours included), and
 * directly with the browser, so they load however Foundry serves the stylesheets. Runs on init.
 */
export function loadBundledFonts()
{
   for (const { family, url, weight = 'normal' } of BUNDLED_FONTS)
   {
      registerFont(family, url);
      if (typeof FontFace === 'undefined' || !document.fonts) { continue; }
      // One file per family; a weight range makes it serve bold headings without a synthesized bold.
      const face = new FontFace(family, `url("${url}")`, { display: 'swap', weight });
      document.fonts.add(face);
      face.load().catch((error) => console.warn(`${MODULE_ID} | Could not load the font ${family} from ${url}.`, error));
   }
}
